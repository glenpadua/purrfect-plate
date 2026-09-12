import { lookup } from "node:dns/promises"
import { fetchPublicPage, isPublicAddress, publicUrl } from "./http"
import { parsePage, parseTranscript, recipeFromCaption } from "./parse"
import { extractWithAI, metadataEvidence, readImageText, readVideoFrames, supadata, supplementRecipe, transcribeAudio, transcriptContent } from "./providers"
import { downloadImage, localMediaReady, processLocalMedia, retrieveLocalMedia } from "./local-media"
import { platformFor, recipeGaps, type ExtractionInput, type ExtractionJob } from "./types"

const errorText = (error: unknown) => error instanceof Error ? error.message : "Extraction failed."

export async function runExtraction(job: ExtractionJob, input: ExtractionInput) {
  const attempt = async <T>(stage: string, action: () => Promise<T>, summary: (value: T) => string) => {
    job.phase = stage
    const start = Date.now()
    try {
      const value = await action()
      job.attempts.push({ stage, outcome: "ok", detail: summary(value), elapsedMs: Date.now() - start })
      return value
    } catch (error) {
      job.attempts.push({ stage, outcome: "error", detail: errorText(error), elapsedMs: Date.now() - start })
      return undefined
    }
  }
  const skip = (stage: string, detail: string) => job.attempts.push({ stage, outcome: "skipped", detail, elapsedMs: 0 })
  const credit = (credits: number | null) => { if (credits !== null) job.providerCredits = (job.providerCredits ?? 0) + credits }
  const aiUsage = (usage: NonNullable<ExtractionJob["aiUsage"]>) => {
    job.aiUsage = { model: usage.model, inputTokens: (job.aiUsage?.inputTokens ?? 0) + usage.inputTokens, outputTokens: (job.aiUsage?.outputTokens ?? 0) + usage.outputTokens }
  }
  try {
    const page = await attempt("Read public page", async () => {
      const result = await fetchPublicPage(job.url)
      if (result.status !== 200) throw new Error(`Source returned HTTP ${result.status}.`)
      if (!result.contentType.includes("text/html")) throw new Error("The link did not return an HTML page.")
      job.finalUrl = result.url
      const finalPlatform = platformFor(new URL(result.url))
      if (job.platform !== "website" && finalPlatform !== job.platform) throw new Error("The social link redirected away from its source platform.")
      job.platform = finalPlatform
      return parsePage(result.text, job.platform)
    }, (result) => `${result.evidence.length} evidence block(s) retrieved${result.recipe ? "; publisher recipe found" : ""}.`)
    if (page) {
      job.title = page.title
      job.author = page.author
      job.evidence.push(...page.evidence)
      job.recipe = page.recipe
      job.warnings.push(...page.warnings)
    }

    if (job.platform === "youtube" && input.includeTranscript && page?.transcriptUrl) {
      const transcript = await attempt("Read native YouTube transcript", async () => {
        const url = new URL(page.transcriptUrl!)
        url.searchParams.set("fmt", "json3")
        const result = await fetchPublicPage(url.href)
        if (result.status !== 200) throw new Error(`Transcript returned HTTP ${result.status}.`)
        const text = parseTranscript(result.text)
        if (!text) throw new Error("YouTube advertised a caption track but returned no transcript text.")
        return text
      }, (text) => `${text.length} transcript characters retrieved.`)
      if (transcript) job.evidence.push({ id: "transcript-native", kind: "transcript", text: transcript, via: "YouTube native caption track" })
    }

    if (!job.recipe) {
      for (const evidence of job.evidence.filter((e) => e.kind === "caption")) {
        const recipe = recipeFromCaption(evidence)
        if (recipe) { job.recipe = recipe; break }
      }
    }
    if (job.platform !== "website" && input.useLocalMedia && (!job.recipe || recipeGaps(job.recipe).length)) {
      if (!localMediaReady()) skip("Local social retrieval", "Run node scripts/setup-extraction-worker.mjs to enable the open-source media worker.")
      else {
        const metadata = await attempt("Retrieve public social media locally", () => retrieveLocalMedia(job.finalUrl || job.url, input.includeTranscript), (r) => `${r.caption.length} caption characters, ${r.images.length} images, ${r.transcript.length} subtitle characters; video ${r.videoUrl ? "available" : "unavailable"}.`)
        if (metadata) {
          job.title = metadata.title || job.title
          job.author = metadata.author || job.author
          job.warnings.push(...metadata.warnings)
          if (metadata.caption) job.evidence.push({ id: "caption-local", kind: "caption", text: metadata.caption, via: "Anonymous open-source social adapter" })
          if (metadata.transcript) job.evidence.push({ id: "transcript-local", kind: "transcript", text: metadata.transcript, via: `youtube-transcript-api; language ${metadata.transcriptLanguage || "unknown"}` })
          if (process.env.OPENAI_API_KEY) {
            for (const image of metadata.images) {
              const result = await attempt(`Read local carousel image ${image.index}`, async () => readImageText(await downloadImage(image.url)), () => "Retrieved slide and transcribed its visible text.")
              if (result) {
                aiUsage(result.usage)
                if (result.text.trim() !== "[NO READABLE TEXT]") job.evidence.push({ id: `local-image-${image.index}`, kind: "image_text", text: result.text, via: `AI reading of original post slide ${image.index}; verify against source` })
              }
            }
            const needsAudio = input.includeTranscript && !job.evidence.some((e) => e.kind === "transcript")
            if ((needsAudio && (metadata.audioUrl || metadata.videoUrl)) || (input.includeFrames && metadata.videoUrl)) {
              const media = await attempt("Download and process source media", () => processLocalMedia(metadata, { audio: needsAudio, frames: input.includeFrames }), (r) => `${r.audio ? "Audio decoded" : "No new audio needed"}; ${r.frames.length} sampled frames. Temporary files removed.`)
              if (media) {
                job.warnings.push(...media.warnings)
                if (media.audio) {
                  const speech = await attempt("Transcribe downloaded audio", () => transcribeAudio(media.audio!), (text) => `${text.length} characters transcribed with gpt-4o-mini-transcribe; speech API usage billed separately from displayed extraction tokens.`)
                  if (speech) job.evidence.push({ id: "speech-local", kind: "transcript", text: speech, via: "OpenAI gpt-4o-mini-transcribe from downloaded source audio; may contain music or transcription errors" })
                }
                if (media.frames.length) {
                  const frames = await attempt("Read video frames", () => readVideoFrames(media.frames), (r) => `${r.printedText.length} printed-text blocks; ${r.observations.length} visual observations for review.`)
                  if (frames) {
                    aiUsage(frames.usage)
                    for (const [index, block] of frames.printedText.entries()) if (block.text.trim()) job.evidence.push({ id: `frame-text-${index + 1}`, kind: "image_text", text: block.text, via: `AI reading of ${block.frame}; verify against original video` })
                    if (frames.observations.length) job.evidence.push({ id: "visual-observations", kind: "visual_observation", text: frames.observations.join("\n"), via: "AI observations of sampled frames. Unverified; excluded from source-backed recipe fields." })
                  }
                }
              }
            }
          } else skip("Read source images and audio", "OPENAI_API_KEY is needed for local-media speech and vision analysis.")
        }
      }
    }

    if (job.platform !== "website" && input.useProvider && process.env.SUPADATA_API_KEY) {
      const metadata = await attempt("Read full social caption", async () => {
        const response = await supadata(`metadata?${new URLSearchParams({ url: job.url })}`)
        credit(response.credits)
        return metadataEvidence(response.data)
      }, (data) => `${data.caption.length} caption characters; media type: ${data.mediaType}.`)
      if (metadata) {
        if (metadata.title) job.title = metadata.title
        if (metadata.author) job.author = metadata.author
        if (metadata.caption) job.evidence.push({ id: "caption-provider", kind: "caption", text: metadata.caption, via: "Supadata full post description" })
      }
      if (metadata?.images.length) {
        if (!process.env.OPENAI_API_KEY) skip("Read carousel image text", "OPENAI_API_KEY is required to transcribe text on post images.")
        else {
          if (metadata.images.length > 10) job.warnings.push("Only the first 10 carousel images were read; later slides remain untested.")
          for (const [index, imageUrl] of metadata.images.slice(0, 10).entries()) {
            const imageText = await attempt(`Read image ${index + 1} text`, async () => {
              const url = publicUrl(imageUrl)
              const answers = await lookup(url.hostname, { all: true })
              if (!answers.length || answers.some((entry) => !isPublicAddress(entry.address))) throw new Error("Non-public image URL rejected.")
              return readImageText(url.href)
            }, () => "Image text transcribed; visual checking is still required.")
            if (imageText) {
              aiUsage(imageText.usage)
              if (imageText.text.trim() !== "[NO READABLE TEXT]") job.evidence.push({ id: `image-text-${index + 1}`, kind: "image_text", text: imageText.text, via: `AI transcription of post image ${index + 1}` })
            }
          }
          job.warnings.push("Image text was transcribed by AI. Check quantities against the original slides.")
        }
      }
      if (input.includeTranscript && !job.evidence.some((e) => e.kind === "transcript") && !["image", "carousel"].includes(metadata?.mediaType ?? "")) {
        const transcript = await attempt("Retrieve or transcribe video", async () => {
          let response = await supadata(`transcript?${new URLSearchParams({ url: job.url, text: "true", mode: "auto" })}`)
          credit(response.credits)
          if (typeof response.data.jobId === "string") {
            job.transcriptJobId = response.data.jobId
            const deadline = Date.now() + 8 * 60_000
            while (Date.now() < deadline) {
              job.phase = "Waiting for video transcription"
              await new Promise((resolve) => setTimeout(resolve, 2500))
              response = await supadata(`transcript/${encodeURIComponent(job.transcriptJobId)}`, AbortSignal.timeout(20000))
              credit(response.credits)
              if (response.data.status === "failed") throw new Error("The provider's transcription job failed.")
              if (response.data.status === "completed") break
            }
            if (response.data.status !== "completed") throw new Error(`Transcription is still pending after 8 minutes. Provider job ${job.transcriptJobId} was preserved; do not blindly create another charged job.`)
          }
          const content = transcriptContent(response.data)
          if (!content.trim()) throw new Error("No speech/transcript text was returned. This is not recipe extraction success.")
          return content
        }, (text) => `${text.length} transcript characters retrieved.`)
        if (transcript) job.evidence.push({ id: "transcript-provider", kind: "transcript", text: transcript, via: "Supadata transcript (auto: existing captions or generated speech transcription)" })
      }
    } else if (job.platform !== "website") {
      skip("Social provider", input.useProvider ? "Optional SUPADATA_API_KEY is not configured. Direct and local extraction remain available." : "Managed provider requests were disabled.")
    }

    for (const evidence of job.evidence) {
      if (evidence.text.length > 60000) {
        evidence.text = evidence.text.slice(0, 60000)
        job.warnings.push(`${evidence.id} was truncated to 60,000 characters.`)
      }
    }
    if (!job.recipe) {
      for (const evidence of job.evidence.filter((e) => e.kind === "caption").reverse()) {
        const recipe = recipeFromCaption(evidence)
        if (recipe) {
          job.recipe = recipe
          job.attempts.push({ stage: "Read explicit recipe headings", outcome: "ok", detail: `Copied ${recipe.ingredients.length} ingredient lines and ${recipe.steps.length} numbered directions from the caption; no AI used.`, elapsedMs: 0 })
          break
        }
      }
    }
    if ((!job.recipe || recipeGaps(job.recipe).length) && job.evidence.some((e) => e.kind !== "visual_observation" && e.text.trim())) {
      if (process.env.OPENAI_API_KEY) {
        const result = await attempt("Extract source-backed recipe", () => extractWithAI(job.evidence), (r) => `${r.recipe.ingredients.length} ingredients and ${r.recipe.steps.length} steps matched to source text.`)
        if (result) { job.aiCandidate = result.candidate; job.recipe = supplementRecipe(job.recipe, result.recipe); aiUsage(result.usage) }
      } else skip("Extract source-backed recipe", "OPENAI_API_KEY is not configured. Retrieved text is shown, but AI recipe extraction was not tested.")
    }
    if (job.recipe) {
      const gaps = recipeGaps(job.recipe)
      job.warnings.push(...gaps, ...job.recipe.warnings)
      job.status = gaps.length ? "partial" : "recipe_found"
    } else job.status = job.evidence.length ? "partial" : "blocked"
    if (job.platform === "instagram") job.warnings.push("Comments and private posts are not covered. Visual observations are suggestions for review, not verified recipe instructions.")
    job.phase = job.status === "recipe_found" ? "Recipe ready to inspect" : job.status === "partial" ? "Some content retrieved; recipe proof incomplete" : "No usable source content retrieved"
  } catch {
    job.status = "failed"
    job.phase = "Unexpected extraction failure"
    job.warnings.push("The prototype could not finish this run. Check the stage log before retrying.")
  } finally {
    job.warnings = [...new Set(job.warnings)]
    job.finishedAt = new Date().toISOString()
  }
}
