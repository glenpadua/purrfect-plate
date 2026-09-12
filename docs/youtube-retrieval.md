# YouTube retrieval: decision and evidence

Last checked: 2026-09-12. **Gemini has successfully read all three supplied public YouTube videos.** The bounded Python production adapter is implemented; deployment and full hosted import acceptance remain separate gates. A successful HTTP response or a video title does not prove we extracted the recipe.

## Selected approach

Use **Gemini's official public YouTube video input** when direct media retrieval cannot supply the requested content. It accepts a video attachment by URL, processing audio and frames on Google's side. This avoids asking Vercel to download from its blocked cloud IP. Glen supplied `GEMINI_API_KEY`; it is consumed privately and never included in app responses.

Google documents public videos only, a free-tier allowance of eight YouTube video hours per day, and a preview caveat for URL input. Rate limits and commercial terms can change. Video understanding can miss brief text and misidentify ingredients, so model output still needs source attribution and review. [Google video input documentation](https://ai.google.dev/gemini-api/docs/video-understanding)

This introduces another AI provider but does not require Supadata. The current Gemini pricing page includes a free tier; its data handling differs from the paid tier. Check the current project quota and terms before enabling it for other users. Do not promise indefinite free production processing. [Google pricing](https://ai.google.dev/gemini-api/docs/pricing)

## What was actually tested

The first official API experiment used Gemini 3.8 Flash. All three videos were accessible, with these successful-call results:

| Video | Speech passages | Printed-text passages | Visual observations | Seconds | Input / output tokens |
| --- | ---: | ---: | ---: | ---: | ---: |
| CrunchWrap | 24 | 2 | 23 | 8 | 5,899 / 2,014 |
| Burrito wrapping | 8 | 1 | 10 | 6 | 2,808 / 895 |
| Biryani | 0 | 1 | 20 | 5 | 5,085 / 909 |

CrunchWrap initially returned HTTP 500 and Biryani initially returned 429; sequential retries succeeded. Later 3.8 calls hit rate limits. The production adapter selects **`gemini-3.6-flash`**, which passed the bounded request: CrunchWrap returned 1,311 speech characters in 13.8 seconds with 5,930 input and 1,516 output tokens. The request included a hard 600-second video-processing endpoint. The richer JSON-schema constraints were rejected by the live endpoint; the schema therefore uses the supported structural subset and strict size/timestamp checks run in our own parser.

The same production Python adapter then passed both remaining sources: burrito wrapping took 7.1 seconds (533 speech characters, 2,839 input / 743 output tokens); biryani took 5.8 seconds (no speech, one watermark OCR passage, 5,116 input / 771 output tokens). All three calls used the 600-second cap. These timings exclude native-retrieval attempts and downstream recipe normalization. Transient failures and retries consume additional time and may consume quota.

The retained native subtitles agree with CrunchWrap's cooking stages and the burrito wrapping instructions. The biryani audio is music, and the only printed text found in the initial experiment was a watermark. Its visual analysis guesses spice identities. Those guesses are retained as uncertain observations, never promoted into the ingredient list or method. This sample demonstrates successful video access but insufficient explicit recipe evidence; missing measurements and cooking times cannot be invented.

### Original hosted retrieval baseline

Fresh authenticated requests to the deployed `purrfect-plate-media.vercel.app/metadata`, with `includeTranscript: true`, returned:

| Supplied Short | Description characters | Transcript | Downloadable audio/video | Time |
| --- | ---: | --- | --- | ---: |
| `_qFZJjnN73o` — Breakfast CrunchWrap | 0 | Unavailable | Neither | 8 s |
| `z1XshOQJmrw` — How To Wrap A Perfect Burrito | 0 | Unavailable | Neither | 8 s |
| `GiqOJyy3oWE` — Hyderabadi Chicken Dum Biryani | 691 | Unavailable | Neither | 8 s |

All three returned HTTP 200 because the adapter reports partial retrieval. The native transcript library explicitly reported IP blocking. The 691-character description is evidence, but it does not establish a complete recipe.

Earlier hosted probes covered default yt-dlp clients, `web_embedded`, `android_vr`, `android`, `web_safari`, then `mweb`/`web` with Node and bgutil proof-of-origin tokens. The final token experiment successfully generated a token but still returned no playable formats or captions for the CrunchWrap sample. A local extraction success was also observed earlier; it is not evidence that Vercel works, nor a promise that a residential IP will remain usable.

The maintained [youtube-transcript-api project](https://github.com/jdepoix/youtube-transcript-api#working-around-ip-bans-requestblocked-or-ipblocked-exception) documents this exact cloud-IP failure class. Popularity of a parser cannot supply network access that the platform denies. The [yt-dlp PO-token guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide) addresses token requirements; obtaining a token is a different condition from having a usable network/session. The [bgutil provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider) is useful tooling, but its successful execution did not fix our hosted sample.

## Alternatives and practical limits

| Approach | What it provides | Decision for this app |
| --- | --- | --- |
| Existing yt-dlp + native captions | Description, subtitles and downloadable streams where the network is accepted | Keep the small existing adapter; do not label unsupported links successful |
| Gemini public-video input | Model-derived speech/text/visual evidence without our own YouTube download | Selected fallback; actual video access verified, hosted integration acceptance still required |
| Self-hosted worker on an owned, always-on residential machine | Same open-source tools through the owner's network | Possible private pilot; needs uptime, outbound job polling, maintenance, and a live network proof. Not a Mac-independent cloud solution |
| Managed transcript service | Provider manages retrieval and optional ASR | Operationally simpler, but requires an account/key and may charge; not selected by default |
| YouTube Data API | Public metadata; caption download under restricted authorization | Not a general public transcript API |
| Different InnerTube libraries, generic VPS, or repeated client changes | Another implementation or cloud address | No evidence these solve our access problem; avoid an endless library swap |

YouTube's official caption download endpoint requires OAuth authorization with permission to edit the video. That does not cover arbitrary recipe links people save. [YouTube caption download reference](https://developers.google.com/youtube/v3/docs/captions/download)

[YouTube.js](https://www.ytjs.dev/) wraps YouTube's internal API. It is a reasonable alternative library, but switching to it does not establish that the server can access the content. We have not claimed a successful hosted YouTube.js test.

Supadata publicly documents a native-transcript mode and AI-generation fallback. Its infrastructure for reliably obtaining the media is not published in that documentation. We can replicate the pipeline shape with open-source retrieval, ASR and frame OCR; we cannot infer or copy a private access network from its API. “Free software” also does not remove hosting, bandwidth, model, maintenance or egress costs. [Supadata transcript contract](https://github.com/supadata-ai/supadata-docs/blob/main/get-transcript.mdx)

No public proxy lists, user account cookies, provider account signup, paid enrollment or new infrastructure were used in this investigation.

## Adapter boundary and reproducible experiment

`services/media/youtube_gemini.py` implements the production fallback without another SDK dependency. It uses the Interactions REST API with `store: false`; known videos over ten minutes are rejected before calling the provider. Unknown durations are clipped to at most the first ten minutes and carry a possible-truncation warning. Short-form URLs are not treated as proof of duration. Responses are capped at 1 MB and 60,000 passage characters. A transient server failure may receive one short retry; 429 returns immediately to the durable job retry flow. Provider error bodies and keys never enter application logs. Existing native transcripts take precedence. [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview), [video processing reference](https://ai.google.dev/api/interactions-api)

The private `/analyze` response adds `videoText` and `visualObservations` (timestamp/text arrays), plus `analysisUsage` (model, input/output/cached tokens, duration). Speech uses the existing `transcript` and `transcriptVia` fields. Successful speech/OCR fallback removes obsolete native-retrieval warnings; source-gap warnings remain. Raw model suggestions about missing information can also contain visually guessed ingredients, so those are replaced with a generic warning before reaching the UI. No downloaded video or frame file is persisted by this adapter.

`scripts/experiments/youtube-gemini.mjs` remains an isolated provider comparison tool with no dependencies. It uses structured JSON, a 150-second timeout and the same 600-second video clip. Its default model is `gemini-3.6-flash`; `YOUTUBE_GEMINI_MODEL` permits an explicit comparison. [Structured output](https://ai.google.dev/gemini-api/docs/structured-output)

Configure `GEMINI_API_KEY` privately, then from the repository root:

```sh
rtk proxy node --env-file=.env.local scripts/experiments/youtube-gemini.mjs _qFZJjnN73o
rtk proxy node --env-file=.env.local scripts/experiments/youtube-gemini.mjs z1XshOQJmrw
rtk proxy node --env-file=.env.local scripts/experiments/youtube-gemini.mjs GiqOJyy3oWE
```

Results go into ignored `outputs/deployment/youtube/`; console output contains counts and the file path, not credentials or provider error bodies. Nine Python tests cover the evidence boundary, partial/inaccessible results, size limits, existing speech, duration clipping, rate limiting and visual guesses leaking through warnings. Syntax/help and missing-key behavior were also checked. A local API success must be followed by a request from the deployed worker before changing the production acceptance status.

## Integration contract and remaining acceptance

1. Compare each returned passage with the actual supplied video. Keep spoken passages, visible text and visual observations separate, with timestamps. Check missing amounts, language and all cooking steps. Model-generated timestamps and quotes are claims to verify, not independently authenticated captions.
2. Add a small private YouTube evidence adapter behind the existing source-retrieval boundary. Keep URL validation, deadlines, quota, leases, deduplication, review and saving in the existing import pipeline. Do not put provider selection into UI components.
3. Prefer existing captions/description when sufficient. Invoke video analysis only when useful; cap video length and token cost. Handle inaccessible videos, no recipe, timeouts and exhausted provider quota explicitly.
4. Send returned speech and on-screen text into normalization with their actual provider/method provenance. Keep visual observations as uncertain supplemental evidence; never invent quantities from frames or disguise model descriptions as source quotes.
5. Obtain a thumbnail through the existing public-image fetch/compression path or use the existing placeholder. Gemini evidence does not give us a reusable source image file. Store no raw video in Convex.
6. Run hosted import → review → save → reload for all three samples, plus inaccessible/non-recipe/no-speech cases. Record latency and token usage. Confirm repeating the same canonical URL still yields one job/recipe.
7. Only then remove the temporary acceptance flag and document the selected production model. Retain the original source URL and user-editable warnings.

The proof-of-origin helper, vendored source, build archive configuration and temporary HTTP probe have been removed from the working source because they supported only a failed diagnostic. The Node runtime that normal yt-dlp uses remains. The cleanup has not yet been deployed; the root agent owns deployment coordination. The evidence above explains why this branch of the investigation stopped.
