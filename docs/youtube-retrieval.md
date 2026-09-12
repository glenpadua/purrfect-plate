# YouTube retrieval: decision and evidence

Last reconciled: 12 September 2026. **The deployed Gemini fallback can read the three supplied public YouTube videos.** CrunchWrap passed hosted import/save. The wrapping tutorial exposed a relevance bug and is now rejected as a standalone technique; its test recipe was removed with approval. Silent biryani stopped with insufficient evidence and alternative search. Native retrieval remains blocked on the observed Vercel network; that is now a fallback trigger for these samples.

## Current production decision

Use existing captions and direct retrieval where available. When that path cannot supply usable content, use **Gemini's official public YouTube video input**, currently `gemini-3.6-flash`. Google processes the audio and frames from the public video URL, avoiding a download from Vercel's blocked cloud IP. `GEMINI_API_KEY` is privately configured on the media worker and never returned to clients.

Google documents public videos only, a preview caveat for URL input and a free-tier allowance of eight YouTube video hours per day. Quotas, availability and terms can change; check the actual project's limits before expanding access. This adds a provider dependency, but does not require Supadata or promise indefinite free production processing. [Video input documentation](https://ai.google.dev/gemini-api/docs/video-understanding), [pricing and data handling](https://ai.google.dev/gemini-api/docs/pricing).

Model-derived speech, visible text and visual observations remain different evidence classes. Video access is not proof that ingredients, measurements or cooking steps were stated. Brief overlays can be missed, timestamps and transcriptions can be inaccurate, and visual spice identifications can be guesses. Source attribution and review remain necessary.

## Hosted acceptance

| Sample | Verified outcome | Gemini usage and duration |
| --- | --- | --- |
| `_qFZJjnN73o` — Breakfast CrunchWrap | Fresh hosted import → review → save: ten ingredient lines, eight steps and missing-detail warnings. Recipe `js7br0ycrz5cndmfvz75375hkn8e8ayy`. | 5,930 input / 1,596 output tokens; 12.4 seconds. |
| `z1XshOQJmrw` — How To Wrap A Perfect Burrito | Now rejected at preflight as a technique, with no full extraction. The earlier mistakenly saved test recipe was removed with user approval; retained job `j978q7s7s27nkt8eczxzf17bds8e8gp9` passed a fresh hosted recheck. | Earlier retrieval proof only: 2,839 input / 724 output tokens; 7.4 seconds. This does not establish a recipe. |
| `GiqOJyy3oWE` — Hyderabadi Chicken Dum Biryani | **Not enough recipe details**, with an editable **Hyderabadi Chicken Dum Biryani recipe** search. A fresh recheck retained its evidence audit; no recipe was saved. | Recheck: Gemini 5,116 input / 676 output tokens, 6.2 seconds; normalization 1,049 input / 209 output tokens. |

Provider durations exclude native retrieval attempts, normalization and user review. These are sample-specific results, not a guarantee for every public YouTube link.

The failed proof-of-origin diagnostics have been removed from source and deployed. Commit `993c94d` triggered a ready web deployment; the media build required the root ignore-rule fix in `a53d103`, whose Git-triggered production build passed. Both Vercel projects auto-deploy from `main`; Convex deployment is separate.

The deployed worker preserves bounded failure evidence, media/preflight/normalization usage, warnings and citations for insufficient outcomes. The hosted biryani recheck retained 17 evidence entries and provider usage in a 7,129-character audit while returning the same honest insufficient result. This is newly observed evidence, not reconstructed history.

## Production adapter contract

`services/media/youtube_gemini.py` uses the Interactions REST API without another SDK dependency. The request uses `store: false`, a supported structural JSON schema and strict local validation. The live endpoint rejected richer schema constraints during the experiment, so bounds are enforced in our parser. [Interactions overview](https://ai.google.dev/gemini-api/docs/interactions-overview), [API reference](https://ai.google.dev/api/interactions-api), [structured output](https://ai.google.dev/gemini-api/docs/structured-output).

- Known videos longer than ten minutes are rejected before the provider call. Unknown durations are clipped to the first ten minutes and carry a possible-truncation warning. A Short URL does not prove duration.
- Responses are capped at 1 MB and 60,000 passage characters. Output and processing deadlines are bounded. A transient server failure may receive one short retry; a 429 returns to the durable job retry flow rather than immediately repeating the request.
- Existing native transcripts take precedence. Model speech uses `transcript` with explicit `transcriptVia`. Printed overlays use timestamped `videoText`; uncertain interpretations use separate `visualObservations`. `analysisUsage` records model, input/output/cached tokens and duration.
- `lib/recipe-import/media-result.ts` validates this private response. The importer normalizes speech and written text, excludes visual observations from recipe facts, and retains their provenance in the audit.
- Successful speech/OCR fallback suppresses obsolete native retrieval failure warnings. Source gaps remain. Raw model suggestions about missing information can contain guessed ingredients, so the adapter replaces those suggestions with a generic review warning.
- Provider error bodies, credentials and raw video do not enter app responses or logs. No downloaded video/frame file is persisted by this adapter. Recipe covers still use the bounded public-image optimization path or a placeholder; Gemini does not supply a reusable cover file.

Provider selection stays in retrieval code. URL safety, quotas, leases, canonical deduplication, relevance checks, normalization, review and saving remain in the existing import pipeline. UI components do not choose AI providers. See [import guardrails](import-guardrails.md) for the full processing budget and failure behavior.

## Why the other approaches were not selected

| Approach | Capability and decision |
| --- | --- |
| Existing yt-dlp and native captions | Can return descriptions, subtitles and streams when the network is accepted. Retained as the first path, with explicit partial/unavailable results. |
| Gemini public-video input | Supplies model-derived audio/text/visual evidence without our own YouTube download. Selected fallback; CrunchWrap passed hosted import/save, while technique and insufficient-recipe outcomes remain separate. |
| Owned, always-on residential worker | Could run the same open-source tools through another network. Requires a live network proof, uptime, polling and maintenance; not selected for a Mac-independent cloud app. |
| Managed transcript service | Handles retrieval and optional ASR, often with simpler operations. Requires an account/key and may charge; not selected by default. |
| YouTube Data API | Useful metadata, but caption download requires OAuth with permission to edit the video. It is not a general transcript API for arbitrary saved recipe links. |
| Another InnerTube library, generic VPS or repeated client changes | Changes implementation or address without demonstrating usable access. No successful hosted proof from these alternatives; avoid endless library swaps. |

The maintained [youtube-transcript-api documentation](https://github.com/jdepoix/youtube-transcript-api#working-around-ip-bans-requestblocked-or-ipblocked-exception) describes the observed cloud-IP blocking. The [yt-dlp PO-token guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide) covers token requirements, which are distinct from a usable network/session. The [bgutil provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider) generated a token in our hosted experiment but did not make the sample's formats or captions available.

[YouTube.js](https://www.ytjs.dev/) wraps YouTube's internal API. Switching libraries would not establish network access, and no successful hosted YouTube.js test is claimed. The official [caption download reference](https://developers.google.com/youtube/v3/docs/captions/download) explains the authorization limitation of the Data API.

Supadata documents native-transcript and AI-generation modes, but does not publish its reliable media-access infrastructure in that contract. We can reproduce the pipeline shape using open-source retrieval, ASR and frame OCR; we cannot infer or replicate its private access network from its API. Free software also leaves hosting, bandwidth, models and maintenance costs. [Supadata transcript contract](https://github.com/supadata-ai/supadata-docs/blob/main/get-transcript.mdx).

No public proxy lists, user account cookies, paid enrollment or new infrastructure were used for this investigation. Glen supplied the Google API key for the selected provider.

## Historical experiments — context, not current acceptance

Before Gemini, authenticated requests to the deployed media `/metadata` endpoint returned HTTP 200 with partial data:

| Sample | Description characters | Native transcript or downloadable stream | Time |
| --- | ---: | --- | ---: |
| CrunchWrap | 0 | Unavailable | 8 s |
| Burrito wrapping | 0 | Unavailable | 8 s |
| Biryani | 691 | Unavailable | 8 s |

The transcript library reported IP blocking. A partial HTTP 200 or the biryani description did not establish a recipe. Hosted probes tried the default yt-dlp clients, `web_embedded`, `android_vr`, `android`, `web_safari`, then `mweb`/`web` with Node and bgutil tokens. The final token probe ran successfully but still yielded no formats/captions for CrunchWrap. Its helper, vendored code, archive/build configuration and temporary HTTP probe have been removed and deployed. The Node runtime used by normal yt-dlp remains.

The first official API comparison used Gemini 3.8 Flash. All three videos were accessible, but initial 500/429 responses needed sequential retries and later calls hit rate limits:

| Sample | Speech / printed-text / visual passages | Seconds | Input / output tokens |
| --- | ---: | ---: | ---: |
| CrunchWrap | 24 / 2 / 23 | 8 | 5,899 / 2,014 |
| Burrito wrapping | 8 / 1 / 10 | 6 | 2,808 / 895 |
| Biryani | 0 / 1 / 20 | 5 | 5,085 / 909 |

The bounded `gemini-3.6-flash` Python adapter then passed local provider calls with the hard 600-second endpoint:

| Sample | Result | Seconds | Input / output tokens |
| --- | --- | ---: | ---: |
| CrunchWrap | 1,311 speech characters | 13.8 | 5,930 / 1,516 |
| Burrito wrapping | 533 speech characters | 7.1 | 2,839 / 743 |
| Biryani | No speech; one watermark OCR passage | 5.8 | 5,116 / 771 |

The biryani's audio was music and its visual analysis guessed spice identities. This established video access while demonstrating why visual guesses must remain outside ingredient lists and methods. Historical local timings and usage differ from the later hosted runs; neither should overwrite the other. Transient failures may consume additional time and quota.

## Reproducing the provider experiment

`scripts/experiments/youtube-gemini.mjs` is an isolated comparison tool with no dependencies, structured JSON, a 150-second timeout and the same 600-second clip. It defaults to `gemini-3.6-flash`; `YOUTUBE_GEMINI_MODEL` allows an explicit comparison. Configure the key privately, then run from the repository root:

```sh
rtk proxy node --env-file=.env.local scripts/experiments/youtube-gemini.mjs _qFZJjnN73o
rtk proxy node --env-file=.env.local scripts/experiments/youtube-gemini.mjs z1XshOQJmrw
rtk proxy node --env-file=.env.local scripts/experiments/youtube-gemini.mjs GiqOJyy3oWE
```

Results go into ignored `outputs/deployment/youtube/`. Console output contains counts and paths, not credentials or provider error bodies. Nine Python tests cover response boundaries, partial/inaccessible results, size/duration limits, existing speech, rate limiting and visual guesses leaking through warnings. The new TypeScript extraction-interface tests cover failure-audit retention. A local provider experiment remains distinct from deployed-worker and full hosted-app acceptance.

## Remaining verification

- Deploy and inspect retained audits for new insufficient failures; do not fabricate history for the earlier biryani job.
- Expand hosted acceptance to unavailable/non-recipe inputs, other languages, brief overlays, provider quota exhaustion and more source formats.
- Recheck canonical YouTube deduplication and fresh reload/edit behavior as part of the final release acceptance, using existing jobs where possible to avoid needless provider cost.
- Compare model text and timestamps against original videos when assessing extraction quality. Do not present model output as independently authenticated captions.
- Test inline source playback on the hosted app and actual iPhones; it is separate from the proven retrieval path and awaits the final web release at this checkpoint.
