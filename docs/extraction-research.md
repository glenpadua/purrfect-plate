# Recipe source extraction: research and live probes

Verified 12 September 2026. The initial research probes below were followed by integration into the web test bench. The open-source paths now run through its import API; Supadata remains optional.

## Integrated verification follow-up

The worker is installed using `node scripts/setup-extraction-worker.mjs`; runtime path is configured server-side as `EXTRACTION_PYTHON`. It never receives OpenAI or Supadata keys. Node downloads media with public DNS checks and pinned connections, invokes FFmpeg on temporary files, and removes those files after processing. OpenAI handles speech, printed image text and sampled-frame observations. Visual observations are excluded from recipe fields.

- Instagram reel: live job `eeaf0cf0-a578-4ec0-8872-7265d6e978f3` retained 13 ingredient lines and the complete spoken method in two source passages. Caption, speech and eight sampled frames were retrieved without Supadata.
- Instagram carousel: job `9af9aa99-1e36-45cc-a289-3a3d4be87a85` read all five slides. Correctly remains partial: no actual ingredient list or cooking method.
- YouTube folding: corrected job `3fd9675e-9d9b-4071-a7ee-932829f1542c` extracted four method passages from subtitles. Correctly partial because it has no ingredient list.
- YouTube biryani: job `c59219cc-4b30-4f41-92ce-1087fdc84b4d` retrieved subtitles and frame observations; correctly partial because the audio is music and visual hypotheses are not treated as author instructions.
- New user sample `https://www.youtube.com/shorts/_qFZJjnN73o`: video/frame retrieval succeeded. The first AI pass rewrote source quotes, exposing incomplete method retention. The fallback now chooses passage IDs constrained to the retrieved source and copies their text directly. GPT-4.1 selection preserved the wrapper, fillings, folding and toasting stages. Latest verified job `8c721d1b-96af-429b-86e1-7d4335dee1cc`, saved as `outputs/extraction-prototype/integrated-verification/crunchwrap.json`, has nine ingredient-bearing passages and eighteen method passages. This is faithful source extraction, not a polished recipe card; vague amounts and subtitle errors remain visible.

The UI has a breakfast crunchwrap sample button. Retained runs whose discarded-content warnings contradict a success badge are now reported as partial. The passage-selection fallback uses GPT-4.1 after GPT-4.1-mini; model names and combined tokens appear in usage, with speech usage described separately in its stage log.

TikTok succeeded after Glen moved the VPN from India back to Spain. Earlier oEmbed/TikWM 403s and missing hydration data were network-specific failures. Spain restored the caption and media metadata. The Node downloader also needed the fresh anonymous session cookies and browser user agent from yt-dlp, plus the combined video audio instead of the separate music-only stream. Job `76faba2a-7708-43ab-808e-d03e15843842` downloaded the 140-second clip, transcribed 2,586 characters of narration, and inspected 28 frames. Its 16 method passages cover preparation, sauce, layering and baking. No Supadata or social login was used. Review caught the fallback replacing a valid 12-item ingredient list with repeated caption passages; repair now preserves independently verified sections. Final retry `279afdb6-6d48-426c-bb1d-884a20a392b9` is saved as `outputs/extraction-prototype/integrated-verification/tiktok-spain.json`: the complete caption ingredient list is retained as one verbatim passage, with 19 method passages and 28 inspected frames. All output quotes match retrieved evidence. Ingredient formatting remains rough; no missing oven temperature was invented. The source gives baking time but the retrieved caption/narration does not specify an oven temperature.

## Recommendation

Own the recipe evidence pipeline and use replaceable source adapters. Start with public page captions and structured website data, then open-source media retrieval, speech transcription, and selective image/frame analysis. Keep a paid retrieval provider as an optional fallback and comparison baseline. Supadata is not a prerequisite for the Instagram proof: the supplied Thai beef reel was downloaded anonymously and its missing spoken method was recovered using OpenAI.

The two independent questions are: can we retrieve the original content, and does that content actually contain enough information for a recipe? A successful download can correctly produce an incomplete recipe.

## Initial measured results (before VPN correction)

Reports and downloaded evidence: `outputs/extraction-prototype/research-2026-09-12T07-37-47Z/`. Dependencies were installed in an isolated temporary Python environment, without reading browser cookies, logging into social accounts, configuring proxies, or creating provider accounts.

Versions: Python 3.14; yt-dlp 2026.8.19 with yt-dlp-ejs 0.8.0 and Node 24.14.0; youtube-transcript-api 1.2.4; Instaloader 4.15.3. Follow-up dependencies: curl_cffi 0.16.3 and imageio-ffmpeg 0.6.0.

| Sample | Actual observation | Meaning |
| --- | --- | --- |
| Instagram breakfast burritos `Dc_6VZeTJPJ` | yt-dlp returned caption and 13 media formats; earlier web run extracted 9 ingredient lines and 5 directions directly | Caption alone already supplies a recipe; media availability also demonstrated at metadata level |
| Instagram beef reel `DdJyDKhKk1i` | yt-dlp returned 12 formats; downloaded 11,197,558-byte video; extracted audio and 15 frames; OpenAI transcribed 517 characters of cooking narration | Missing method is recoverable without Supadata; caption plus narration supports a cooking sequence |
| Instagram carousel `DdFnOXsDGnV` | yt-dlp rejected still-image entries; Instaloader returned five ordered image URLs; all five images downloaded; OpenAI read the slides | Use a photo-aware adapter. The selected slide 4 is a dish photograph with a title and protein claim, not a full recipe card |
| YouTube wrapping `z1XshOQJmrw` | youtube-transcript-api returned 13 transcript segments without an API key | Earlier empty caption endpoint was an adapter failure, not proof the transcript is unavailable. This is a wrapping technique, not a complete ingredient recipe |
| YouTube biryani `GiqOJyy3oWE` | English-only transcript lookup failed; enumerating native languages returned 12 Russian segments. Downloaded audio; independent OpenAI transcription also returned background song lyrics. Downloaded a separate 3,573,904-byte video stream and extracted 27 frames | Transcript availability does not imply useful recipe narration. Visual analysis is the relevant fallback; do not treat song lyrics as recipe instructions |
| TikTok `7351594254663159083` | yt-dlp failed to extract hydration data, both before and after installing its recommended HTTP impersonation dependency | This sample remains unresolved; not evidence that all TikTok retrieval is impossible |
| RecipeTin Eats chicken/lemon rice | Earlier web run extracted 15 ingredient lines and 9 instructions from Recipe JSON-LD | Prefer publisher structured data before spending on AI |

OpenAI calls succeeded with the configured key. For the beef reel, the combined caption/audio/frame response proposed 13 ingredient entries and six cooking steps. This was an exploratory response, not a fully audited production recipe: the model sometimes combined sources in a single quote and used inconsistent evidence labels. Production output needs schema validation and precise, separate source references. Visual ingredient identifications in the carousel are hypotheses, not confirmed quantities or a substitute for the author's method.

All measurements are from this Mac and current network. Hosted-worker reliability and larger samples remain unproven. TikTok was subsequently resolved as described above. No Supadata request was made because its key is absent.

The subsequent biryani vision call completed on all 27 frames. It produced a visible cooking sequence with missing quantities and timings, but also overconfident spice identifications from powder appearance and an unsupported claim to cook rice until done. Those claims must be rejected or marked uncertain. This proves frame access and useful visual interpretation, not a faithful complete recipe. Keep this response as an adversarial acceptance case for the evidence validator. Frame sampling can also miss briefly displayed information; no-text findings apply to the sampled frames.

## What Supadata provides and what we can build

Supadata documents native transcript retrieval, generated transcription, and an automatic mode that tries native first. It also offers normalized post metadata and asynchronous job polling. Native transcript retrieval costs one credit; generated transcription costs two credits per video minute; metadata costs one credit. Its public documentation does not establish which private extractors, models, proxy providers, or infrastructure it uses. We should not claim that it is simply a yt-dlp wrapper. [Transcript API](https://docs.supadata.ai/get-transcript), [metadata API](https://docs.supadata.ai/get-metadata).

We can implement those observable capabilities using existing components. The continuing work is maintaining access across platform changes, expired media URLs, rate limits, regional differences and hosting environments. youtube-transcript-api explicitly documents cloud IP blocking; yt-dlp documents changing YouTube proof-of-origin requirements affecting media and subtitles. These are operational reasons to benchmark a managed provider even when a local proof works. [Transcript project](https://github.com/jdepoix/youtube-transcript-api), [YouTube token guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide).

The current Supadata pricing page lists a free allowance of 100 requests monthly, plus paid credit plans. A bounded comparison could use that allowance; a provider still needs to be measured against our links. [Pricing](https://supadata.ai/pricing).

## Components worth using

1. **Websites:** parse Recipe JSON-LD, then visible recipe text. Follow an explicitly linked recipe page when needed, with the same public-URL checks. [Google's Recipe format](https://developers.google.com/search/docs/appearance/structured-data/recipe).
2. **YouTube:** enumerate existing transcript languages with youtube-transcript-api; use yt-dlp for descriptions and media when transcription or frame analysis is necessary. Do not equate an English lookup failure with no transcript. [Transcript project](https://github.com/jdepoix/youtube-transcript-api), [yt-dlp](https://github.com/yt-dlp/yt-dlp).
3. **Instagram:** public caption first; yt-dlp for video; Instaloader for photos and carousels. The different outcomes on our carousel justify distinct photo/video handling. [Instaloader](https://instaloader.github.io/basic-usage.html).
4. **TikTok:** yt-dlp now retrieves the sample from Spain with an anonymous session. Preserve scoped session cookies and prefer combined video audio to backing music. Compare more samples and a managed retrieval service before choosing the production path. The official Display API verifies videos belong to the authorized user; it is not an arbitrary-public-video ingestion API. [TikTok video query](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query).
5. **Speech:** use OpenAI now, since the key works. For zero per-call transcription fees, evaluate whisper.cpp on the Mac or faster-whisper on a worker. Local inference still consumes hardware and processing time. [OpenAI transcription](https://developers.openai.com/api/docs/guides/speech-to-text), [whisper.cpp](https://github.com/ggml-org/whisper.cpp), [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
6. **Visual evidence:** decode media with FFmpeg; sample frames with timestamps; inspect on-screen ingredients and actions with vision; include all carousel slides. Increase sampling around brief overlays and scene changes rather than assuming one frame every two seconds captures everything. OpenAI's cookbook demonstrates combining frames with a speech transcript. [Frame/audio example](https://developers.openai.com/cookbook/examples/gpt4o/introduction_to_gpt4o).
7. **Alternative for YouTube:** Gemini officially accepts public YouTube URLs and processes video/audio. Its URL feature is currently a preview described as no-charge, with a free-tier duration limit; pricing and limits may change. This could avoid maintaining YouTube downloads for that route. It needs a separate credential and was not tested here. It does not imply Instagram/TikTok post URLs can be submitted the same way. [Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding).

The official YouTube captions download API requires permission to edit the video; adding a Google API key alone is not a general public-transcript solution. [YouTube captions download](https://developers.google.com/youtube/v3/docs/captions/download).

## Cost and product decisions

Open-source retrieval has no provider fee. Self-hosted speech can avoid speech API fees. Hosting, bandwidth, storage, maintenance, and any chosen proxies remain costs. OpenAI transcription used here is listed at an estimated $0.003 per minute; that is about $3 per 1,000 minutes of audio before vision, recipe extraction, or infrastructure. [OpenAI pricing](https://developers.openai.com/api/docs/pricing).

Use escalation by missing evidence: caption/page first; speech when the method is missing; frames when instructions are visual or audio is irrelevant. Cache source evidence by canonical source ID, and allow reprocessing the same evidence without downloading again. Keep private user libraries separate even if public source retrieval is deduplicated.

Preserve three distinctions in the data: author-stated information, visual observations, and AI suggestions. Exact amounts and temperatures should come from printed/spoken evidence. A full-looking invented recipe must never count as successful extraction. A carousel without instructions should become a source bookmark or an incomplete draft; a recipe inspired by its photograph is a separate feature.

## Next implementation boundary

Add a small Python media worker to the existing TypeScript service, behind the same import-job API that Expo will call. Give it bounded runtime/downloads, restricted network access, temporary media cleanup and structured evidence output. Run durable jobs outside short-lived Next.js request handlers in production. Keep the retrieval adapter replaceable so Supadata or another service can be benchmarked without changing recipe storage or mobile UI.

Instagram video/carousel, YouTube transcript/media, TikTok caption/video/audio and website structured data now work through the web test bench on representative links. The local four-platform proof is established; this is not production reliability certification. Next: improve readable recipe formatting without losing provenance and measure success rate on a larger corpus from the intended hosting network. Recent sources group repeated attempts under Run history.
