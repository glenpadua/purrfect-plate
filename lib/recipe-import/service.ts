import * as cheerio from "cheerio";
import { fetchPublicPage, publicUrl } from "./extraction/http";
import { parsePage } from "./extraction/parse";
import { platformFor, type Evidence } from "./extraction/types";
import { readImageText, readVideoFrames } from "./extraction/providers";
import { normalizeRecipe } from "./normalize";
import { optimizeRecipeImage, retrieveRecipeImage } from "./images";
import { readMediaResult } from "./media-result";
import { checkImportTarget, ImportSourceError } from "./guardrails";
import { preflightRecipe } from "./preflight";
import { recipeFromCaption } from "./extraction/parse";
import { z } from "zod";
import { withIngredientQuantity } from "../cooking";
import { resolveServings } from "../servings";

const metadataSchema = z.object({
  title: z.string().max(1000).nullish(),
  caption: z.string().max(100000).optional(),
  transcript: z.string().max(100000).optional(),
  duration: z.number().nullish(),
});

/** Server-only orchestration. Clients receive durable import IDs, never media credentials. */
export async function importRecipe(
  url: string,
  progress: (phase: string) => Promise<void>,
  options: { relevanceOverride?: boolean } = {},
) {
  checkImportTarget(url);
  const deadline = Date.now() + 260000;
  const budget = (maximum: number, reserve = 0) =>
    Math.max(1, Math.min(maximum, deadline - Date.now() - reserve));
  let platform = platformFor(publicUrl(url));
  const evidence: Evidence[] = [];
  const warnings: string[] = [];
  let author: string | undefined;
  let image: Buffer | undefined;
  let sourceImageUrl: string | undefined;
  let finalUrl = url;
  let mediaUsage: ReturnType<typeof readMediaResult>["analysisUsage"];
  let sourceTitle = "";
  let mediaUnavailable = false;
  await progress("Reading the original recipe");
  try {
    const page = await fetchPublicPage(url, AbortSignal.timeout(budget(20000)));
    if (page.status !== 200 || !page.contentType.includes("text/html"))
      throw new Error("Source page unavailable");
    finalUrl = page.url;
    if (/\/(?:accounts\/login|login|signin|consent)(?:\/|$)/i.test(new URL(finalUrl).pathname)) {
      if (platform !== "website") {
        finalUrl = url;
        throw new Error(
          "The public page requires sign-in; trying the original post through the media adapter.",
        );
      }
      throw new ImportSourceError(
        "This source requires access we do not have. Try a public recipe page or post.",
        "unavailable",
      );
    }
    checkImportTarget(finalUrl);
    platform = platformFor(new URL(finalUrl));
    const parsed = parsePage(page.text, platform);
    sourceTitle = parsed.title;
    evidence.push(...parsed.evidence);
    warnings.push(...parsed.warnings);
    author = parsed.author;
    const $ = cheerio.load(page.text);
    const cover = $('meta[property="og:image"]').attr("content");
    if (cover) sourceImageUrl = new URL(cover, finalUrl).href;
  } catch (error) {
    if (error instanceof ImportSourceError) throw error;
    warnings.push("The public page could not be read directly.");
  }

  await progress("Checking this link for recipe content");
  if (platform !== "website" && process.env.MEDIA_WORKER_URL && process.env.MEDIA_WORKER_SECRET) {
    try {
      const response = await fetch(`${process.env.MEDIA_WORKER_URL}/metadata`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MEDIA_WORKER_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: finalUrl, includeTranscript: true }),
        signal: AbortSignal.timeout(budget(30000, 105000)),
      });
      if (response.ok) {
        const metadata = metadataSchema.parse(await response.json());
        if (metadata.duration && metadata.duration > 600)
          throw new ImportSourceError(
            "Videos longer than ten minutes are not supported yet. Share a shorter clip or the creator’s recipe page.",
            "unavailable",
          );
        sourceTitle = metadata.title || sourceTitle;
        for (const [id, kind, text] of [
          ["preflight-caption", "caption", metadata.caption],
          ["preflight-transcript", "transcript", metadata.transcript],
        ] as const) {
          if (text && !evidence.some((item) => item.text === text))
            evidence.push({
              id,
              kind,
              text,
              via: kind === "caption" ? "Public post caption" : "Existing video subtitles",
            });
        }
      }
    } catch (error) {
      if (error instanceof ImportSourceError)
        throw error; /* Unreadable metadata is unknown, not a rejection. */
    }
  }
  const completeCaption = evidence.some(
    (item) =>
      item.kind === "caption" &&
      (() => {
        const recipe = recipeFromCaption(item);
        return !!recipe?.ingredients.length && !!recipe.steps.length;
      })(),
  );
  const hasStructuredRecipe = evidence.some((item) => item.kind === "structured_recipe");
  const preflight = options.relevanceOverride
    ? { classification: "unknown" as const, dish: null, usage: undefined, overridden: true }
    : hasStructuredRecipe || completeCaption
      ? { classification: "recipe" as const, dish: null, usage: undefined }
      : await preflightRecipe(
          [
            sourceTitle,
            ...evidence
              .filter((item) => item.kind !== "visual_observation")
              .map((item) => item.text),
          ].join("\n"),
        );
  if (preflight.classification === "unrelated")
    throw new ImportSourceError(
      "This link appears to be about something other than a recipe or cooking. No full extraction was run. Try a specific recipe page or cooking video.",
      "not_recipe",
      undefined,
      { url, checkedAt: new Date().toISOString(), preflight },
    );
  if (preflight.classification === "technique")
    throw new ImportSourceError(
      "This is a cooking technique rather than a recipe. It does not provide a dish recipe to save. Try the creator’s recipe page instead.",
      "not_recipe",
      undefined,
      { url, finalUrl, platform, sourceTitle, checkedAt: new Date().toISOString(), preflight },
    );

  if (platform !== "website" && !completeCaption) {
    await progress("Reading the caption and listening to the video");
    try {
      const workerUrl = process.env.MEDIA_WORKER_URL;
      const secret = process.env.MEDIA_WORKER_SECRET;
      if (!workerUrl || !secret) throw new Error("Media service not configured");
      if (budget(150000, 105000) < 5000) throw new Error("Media processing budget exhausted");
      const response = await fetch(`${workerUrl}/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: finalUrl, includeTranscript: true, includeFrames: true }),
        signal: AbortSignal.timeout(budget(150000, 105000)),
      });
      if (!response.ok) throw new Error(`Media service HTTP ${response.status}`);
      const media = readMediaResult(await response.json());
      mediaUsage = media.analysisUsage;
      mediaUnavailable = !!media.analysisUnavailable;
      author = media.author || author;
      warnings.push(...media.warnings);
      evidence.push(
        ...media.evidence.filter(
          (item) =>
            !evidence.some(
              (existing) => existing.text === item.text && existing.kind === item.kind,
            ),
        ),
      );
      if (media.images?.length) {
        sourceImageUrl = media.images[0].url;
        await progress("Reading recipe text in the photos");
        for (const item of media.images) {
          if (budget(90000, 105000) < 15000) {
            warnings.push(
              "Some photos could not be read within this import’s time limit. Check the original for omitted details.",
            );
            break;
          }
          try {
            const bytes = await retrieveRecipeImage(
              item.url,
              AbortSignal.timeout(budget(20000, 105000)),
            );
            const result = await readImageText(
              `data:image/webp;base64,${bytes.toString("base64")}`,
              budget(90000, 105000),
            );
            if (!image) image = bytes;
            if (result.text.trim() !== "[NO READABLE TEXT]")
              evidence.push({
                id: `slide-${item.index}`,
                kind: "image_text",
                text: result.text,
                via: `Text read from slide ${item.index}; check against original`,
              });
          } catch {
            warnings.push(`Slide ${item.index} could not be read.`);
          }
        }
      }
      if (media.frames.length) {
        // Frames provide a cover even when the original poster expires.
        const frame = media.frames[Math.max(0, media.frames.length - 2)];
        try {
          image ??= await optimizeRecipeImage(Buffer.from(frame.imageUrl.split(",")[1], "base64"));
        } catch {
          /* Placeholder is an intentional fallback. */
        }
        if (
          (!media.transcript || !/cook|stir|add|mix|bake|fry|chop|boil/i.test(media.transcript)) &&
          budget(90000, 105000) >= 5000
        ) {
          await progress("Checking the video for written instructions");
          const observations = await readVideoFrames(media.frames, budget(90000, 105000));
          for (const [index, block] of observations.printedText.entries())
            evidence.push({
              id: `frame-${index}`,
              kind: "image_text",
              text: block.text,
              via: `Text read near ${block.frame}; check against original`,
            });
          if (observations.observations.length)
            evidence.push({
              id: "visual-observations",
              kind: "visual_observation",
              text: observations.observations.join("\n"),
              via: "Unverified visual observations; not recipe facts",
            });
        }
      }
    } catch {
      mediaUnavailable = true;
      warnings.push("Some video or photo content could not be retrieved from this platform.");
    }
  }

  const searchQuery = preflight.dish ? `${preflight.dish} recipe` : undefined;
  // Failed imports still consumed retrieval/model work. Retain the provenance
  // without copying raw media payloads or exceeding the worker's storage limit.
  const failureAudit = (result?: Awaited<ReturnType<typeof normalizeRecipe>>) => {
    const retained: Evidence[] = [];
    let size = 0;
    let evidenceTruncated = false;
    for (const item of evidence) {
      const bounded = {
        id: item.id.slice(0, 120),
        kind: item.kind,
        text: item.text.slice(0, 12000),
        via: item.via.slice(0, 500),
      };
      const itemSize = JSON.stringify(bounded).length;
      if (size + itemSize > 60000) {
        evidenceTruncated = true;
        break;
      }
      retained.push(bounded);
      size += itemSize;
      if (bounded.text !== item.text) evidenceTruncated = true;
    }
    const citationsTruncated = !!result && JSON.stringify(result.citations).length > 100000;
    return {
      version: 1,
      url: url.slice(0, 2048),
      finalUrl: finalUrl.slice(0, 2048),
      platform,
      sourceTitle: sourceTitle.slice(0, 1000),
      extractedAt: new Date().toISOString(),
      evidence: retained,
      evidenceTruncated,
      mediaUsage: mediaUsage ? { ...mediaUsage, model: mediaUsage.model.slice(0, 200) } : undefined,
      usage: result ? { ...result.usage, model: result.usage.model.slice(0, 200) } : undefined,
      citations: result && !citationsTruncated ? result.citations : undefined,
      citationsTruncated,
      preflight,
      warnings: [...new Set([...(result?.draft.warnings ?? []), ...warnings])]
        .slice(0, 20)
        .map((warning) => warning.slice(0, 500)),
    };
  };
  if (!evidence.some((item) => item.kind !== "visual_observation" && item.text.trim()))
    throw new ImportSourceError(
      "We could not recover readable ingredients or instructions. The source may be inaccessible, or it may contain only visuals. You can open it, add the recipe manually, or look for a different recipe.",
      mediaUnavailable ? "unavailable" : "insufficient",
      searchQuery,
      failureAudit(),
    );
  await progress("Putting the recipe into clear ingredients and steps");
  const result = await normalizeRecipe(evidence, budget(90000, 15000));
  if (result.contentType === "technique" || result.contentType === "unrelated") {
    if (!options.relevanceOverride)
      throw new ImportSourceError(
        result.contentType === "technique"
          ? "This is a cooking technique rather than a recipe. It does not provide a dish recipe to save. Try the creator’s recipe page instead."
          : "This source does not appear to provide a recipe. Try a specific recipe page or cooking video.",
        "not_recipe",
        searchQuery,
        failureAudit(result),
      );
    result.draft.warnings.push(
      result.contentType === "technique"
        ? "This source appears to teach a technique rather than provide a dish recipe; you chose to extract it anyway."
        : "This source may not be a recipe; you chose to extract it anyway.",
    );
  }
  if (!result.draft.ingredients.length && !result.draft.instructions.length)
    throw new ImportSourceError(
      "We read this source, but it did not provide usable ingredients or cooking instructions. Try the creator’s recipe page, add details manually, or find a different recipe.",
      mediaUnavailable ? "unavailable" : "insufficient",
      searchQuery,
      failureAudit(result),
    );
  if (sourceImageUrl && budget(15000) >= 15000) {
    try {
      image = await retrieveRecipeImage(sourceImageUrl, AbortSignal.timeout(budget(15000)));
    } catch {
      warnings.push("The source cover was unavailable; a video frame or placeholder is used.");
    }
  }
  result.draft.warnings = [...new Set([...result.draft.warnings, ...warnings])].slice(0, 20);
  const draft = {
    ...result.draft,
    ingredients: result.draft.ingredients.map(withIngredientQuantity),
    servingInfo: resolveServings(result.draft),
  };
  return {
    draft,
    image,
    author,
    evidenceJson: JSON.stringify({
      version: 1,
      url,
      finalUrl,
      platform,
      extractedAt: new Date().toISOString(),
      evidence,
      citations: result.citations,
      usage: result.usage,
      mediaUsage,
      preflight,
      warnings,
      servingInfo: draft.servingInfo,
    }),
  };
}
