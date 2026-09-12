# Recipe extraction experiment

Question: can the app turn a real Instagram, TikTok, YouTube, or website URL into ingredients and instructions supported by the retrieved source?

This is a local, working integration prototype. The cross-platform part is server-side TypeScript and a JSON API. Expo can call the same service after production authentication and hosting are added. Mobile share extensions are a separate, untested entry mechanism.

## Run

```sh
pnpm dev --hostname 0.0.0.0 --port 3101
```

Open http://localhost:3101/extraction-prototype. The library home page also links to it. The existing RECIPE_ALLOWED_HOSTS restriction applies to the API; the prototype is not a public service. No recipes or Convex data are modified.

Enable the local open-source worker with `node scripts/setup-extraction-worker.mjs` (Python 3.10+ required). It creates the gitignored `.venv-extraction` environment and adds its runtime path as `EXTRACTION_PYTHON` in `.env.local` if unset. The worker retrieves anonymous Instagram video/carousel metadata, TikTok captions/media, and YouTube subtitles/media. It uses no social login cookies. Fresh anonymous media-session cookies stay inside the retrieval pipeline and are scoped to their domain and path on every redirect; they are not included in job evidence. Runtime/download limits and public DNS checks apply. Local speech uses OpenAI; frame observations are kept separate from verified recipe text. Supadata is optional and disabled by default in the UI.

For the optional managed social retrieval path and AI extraction, use these **server-only** settings in `.env.local`:

```dotenv
SUPADATA_API_KEY=your-key-from-the-Supadata-dashboard
OPENAI_API_KEY=your-OpenAI-project-key
RECIPE_EXTRACTION_MODEL=gpt-4.1-mini
```

Keep actual keys out of source control, browser fields, and chat. No subscriptions or provider accounts are created by this code. Provider usage consumes your configured account's credits. You can disable the social provider and video transcription independently in Test options. A complete structured website recipe or explicitly formatted caption does not need AI. Partially formatted text may still invoke OpenAI if configured, even with the social provider disabled.

## What the experiment does

1. Fetch a public HTTPS page, checking and pinning public DNS answers and checking every redirect. Bound response size and request duration.
2. Read publisher Recipe JSON-LD, Instagram public description, YouTube video description/native caption track, or TikTok embedded video data.
3. If enabled/configured, retrieve a full social caption and transcript using Supadata. Video transcription uses `auto`: existing captions, otherwise generated speech transcription. Provider job IDs remain visible while polling.
4. For provider-returned images/carousels, use OpenAI to transcribe text on up to 10 images. This is OCR-like text reading, not ingredient guessing from food appearance. Preserve image order; the original `img_index` is kept in the input link. OCR accuracy must be checked visually.
5. Copy explicit caption ingredient/direction sections, or extract verbatim recipe passages with OpenAI Structured Outputs. Reject AI ingredients/steps that do not match their cited source text; missing data remains missing. AI transcription can still be wrong, so quote matching is not a substitute for checking the original audio/image.
6. Display the recipe, source evidence, stage outcomes, elapsed time, reported provider credits, and AI token usage. Download the full JSON record.

The local worker processes clips up to ten minutes and 75 MB per downloaded stream, sampling up to 30 frames across the clip at intervals of at least four seconds. Printed text may feed extraction; visual observations appear only as unverified evidence. The prototype does not retrieve comments, private posts, or linked recipes mentioned in a description. It does not follow promotional instructions like “comment RECIPES”. A technique-only clip may correctly produce steps with no ingredient list. Multiple recipes in one page/post require further product decisions; multiple website JSON-LD recipes currently select the first with a warning.

## Real acceptance checks

The UI includes Glen's three Instagram links and three YouTube Shorts, a public TikTok recipe example, and a RecipeTin Eats recipe page.

```sh
# Retrieval across all eight cases; exit code 2 means at least one
# result is incomplete, not a test runner crash. OpenAI may run if configured.
pnpm test:extraction:live

# Enable provider fallback. This consumes provider/AI credits if configured.
pnpm test:extraction:live --provider

# Run just one actual link
pnpm test:extraction:live --url https://www.instagram.com/p/Dc_6VZeTJPJ/
```

Each batch writes timestamped reports under `outputs/extraction-prototype/` (gitignored). The script calls the live web API, uses no fixtures, polls the same run ID, and saves retrieved evidence. The default base URL can be changed using `EXTRACTION_TEST_BASE_URL`.

Completion requires inspecting actual source content and output for **each platform**, including Instagram captions, spoken recipes, and carousel text. A successful HTTP response, metadata title, mocked provider test, or implemented adapter does not prove successful extraction. Record partial and blocked cases as such. For a technique clip, missing ingredients are an expected limitation, not a reason to invent them.

## Observed direct-access results — 12 September 2026

Latest seven-link batch: `outputs/extraction-prototype/2026-09-12T07-24-31.716Z/summary.json`. These are actual HTTP/API runs from this Mac, with social provider disabled and no OpenAI key configured.

| Source | Observed result | Remaining proof |
| --- | --- | --- |
| Instagram `Dc_6VZeTJPJ` | 9 ingredient lines and 5 directions copied from public caption | Broader reliability across networks/posts |
| Instagram `DdFnOXsDGnV`, slide 4 | Promotional caption retrieved; no recipe text | Retrieve carousel images and verify image-text extraction |
| Instagram reel `DdJyDKhKk1i` | 13 ingredient lines including serving accompaniments; no written method | Retrieve speech transcript and extract actual instructions |
| YouTube Short `z1XshOQJmrw` | Empty description; advertised native caption endpoint returned empty | Provider transcription; expect a wrapping technique, not a full recipe |
| YouTube Short `GiqOJyy3oWE` | Description retrieved; native transcript empty | Provider transcription and recipe extraction |
| TikTok mac-and-cheese sample | Generic public page, no usable recipe text | Provider caption/transcript retrieval |
| RecipeTin Eats chicken/lemon rice | 15 ingredient lines and 9 instructions from publisher JSON-LD | Broader website coverage |

The table above records the initial failures, not the current integration status. Both keys were missing during that initial batch. Subsequently, the configured OpenAI key passed live text, speech and vision calls. The integrated local worker now retrieves the Instagram reel's video and spoken method, all five carousel images, and YouTube transcripts/media without Supadata. The added breakfast crunchwrap sample also passes source extraction, with creator wording and loose quantities preserved. After Glen switched the VPN from India to Spain, TikTok caption and media retrieval succeeded. Preserving anonymous download cookies and choosing combined video audio recovered the spoken method; 28 video frames were also inspected. This establishes working local extraction examples on all four platforms. Supadata remains untested. See [the research and measured results](extraction-research.md) for the current state and evidence paths.

## Local prototype limits

- Recent results are grouped by canonical source ID. Earlier test attempts remain available under Run history; they are not separate library recipes.
- Jobs run in the long-lived Next Node process. They survive closing the page and hot reload, but not a process restart, and are capped at 30 retained runs / three simultaneous imports. This must become a durable job queue before serverless/public deployment.
- The same-origin LAN request guard is retained. Production mobile needs authenticated API access and per-user authorization; never ship the household server secret in an app.
- Transient provider errors are surfaced rather than blindly retried and potentially charged again. An eight-minute provider polling deadline preserves the provider job ID in the report; it does not assert that the external job was cancelled.
- No library saves, accounts, pantry, nutrition calculations, or cook mode were added.
- Direct platform access is a measured result for these links and this network, not a promise that every public link works everywhere.

## Provider references

- https://docs.supadata.ai/get-metadata
- https://docs.supadata.ai/get-transcript
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
