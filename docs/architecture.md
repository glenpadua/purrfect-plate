# Architecture and operations

## Boundaries

| Area | Owns |
| --- | --- |
| `app` | Thin routes, layout and authenticated API entry points |
| `features/library` | Library screen, browsing state, data access and surprise picker |
| `components`, `features/recipe-import` | Recipe UI and draft review |
| `convex/access.ts`, `libraries.ts` | Verified-email invitation and membership |
| `convex/recipes.ts` | Authenticated CRUD and photo ownership |
| `convex/imports.ts`, `importWorker.ts` | Durable jobs, quota, deduplication and scheduling |
| `lib/recipe-import/service.ts` | URL-to-draft orchestration |
| `lib/recipe-import/extraction` | URL safety, page parsing and AI provider helpers |
| `lib/recipe-import/normalize.ts` | Publisher recipe preservation and passage-backed AI normalization |
| `lib/recipe-import/images.ts` | Shared image storage policy |
| `lib/cooking.ts` | Pure serving and same-dimension unit display transformations |
| `features/cooking` | Session-only ingredient checklist and step navigation |
| `features/pantry`, `convex/pantry.ts`, `lib/pantry.ts` | Shared ingredient presence, shopping reconciliation and conservative matching |
| `features/recipe-source` | Validated, tap-to-load source players and attribution |
| `lib/recipe-lines.ts` | Shared grouped-text editing without losing unchanged provenance |
| `services/media` | Replaceable Python caption/audio/frame service |

## API and data

Clerk issues the `convex` JWT with audience `convex`, `email`, and `email_verified`. Convex exposes the latter as `identity.emailVerified`. Every user-facing data function checks library membership. Clients cannot choose a different library ID. Both invited addresses join the same library.

`imports.start({url})` returns a durable job ID. `get` and `list` provide reactive progress. `retry` explicitly retries failures. `save({id,draft})` atomically creates one recipe and returns its ID; repeating the save returns that recipe. `recipes` exposes list/listPage, get, create, update, remove and markCooked. Mobile can use these same functions with Clerk authentication.

Jobs progress from queued to processing to needs_review to saved, or fail. A six-minute lease detects interruption; attempt numbers fence off late responses. Limits: 30 starts/retries per library per UTC day, two running jobs, a 15-minute cooldown after each three failed attempts on a link. Attempt numbers remain monotonic so an old worker cannot overwrite a retry. Convex calls the private Next.js worker with a machine secret. That worker calls the separate private Python service. The worker has a 300-second platform ceiling and a 260-second processing budget. Page reads are capped at 20 seconds, metadata at 30, media at 150 and normalization at 90; each stage uses the remaining budget while reserving time for normalization and saving. Large carousels may remain partial; independently durable OCR stages are a future scaling improvement.

Recipes retain optional grouped ingredients/instructions, publisher recipe notes, separate import warnings, servings, preparation/cooking times, origin, canonical source, creator, author and import ID alongside legacy fields. Older photo-only recipes remain valid. Original extraction evidence/citations remain in the job after users edit saved text.

## Provenance and models

Complete publisher JSON-LD recipes retain every ingredient and cooking step without an AI rewrite. Other evidence is split into numbered source passages; `gpt-5.4-2026-03-05` with low reasoning produces readable entries referring to those passage IDs. The server retains the passages and selection in the evidence record. Unknown references fail the import; a numeric mismatch falls back to the cited original wording instead of silently deleting a cooking step. Passage IDs remove the earlier failure where capitalization or ellipses in generated quotes caused valid preparation/flour steps to disappear.

This remains a reviewable draft, not a full semantic proof. The GPT-5.4 change was checked against the actual TikTok transcript: it retained preparation and flour cooking, omitted the previous model's unstated salted-water/package directions, and flagged the source's contradictory cheese allocation. `gpt-4.1-mini` reads images and sampled frames; `gpt-4o-mini-transcribe` transcribes audio. Normalization, preflight and Gemini video-input usage are retained separately in evidence. Other OCR/ASR usage is not yet fully aggregated. Visual observations are excluded from facts. [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4)

`migrations.repairUnsavedDraft` is an internal maintenance operation used for the two acceptance drafts generated before this fix. It checks status and last-update time, rejects changed/saved jobs, and verifies that original evidence and source URLs are unchanged. It does not replace saved recipes or images.

Sources are untrusted data. The web fetcher validates public HTTPS destinations, pins DNS results, checks redirects and bounds response sizes. The Python service accepts canonical public social links and limits media hosts to known platform CDNs, validates TLS/public DNS/redirects and caps downloads at 75 MB. Python requests do not pin DNS; the private service and CDN allowlist are explicit boundaries. No user browser cookies are extracted. Fresh anonymous retrieval-session cookies stay in the private media service.

## Image lifecycle

Sharp strips metadata, resizes without enlargement, and encodes WebP at decreasing sizes/qualities until under 350,000 bytes. Maximum dimension is 1440 pixels. Convex validates content type and byte size again. Uploaded IDs are bound to the uploader and cannot be reused after attaching to a recipe. Replacing/deleting a recipe deletes the old cover. Removing an imported recipe returns its retained job to review without the deleted image. Duplicate worker callbacks preserve the accepted image; stale callbacks discard unused covers.

Temporary audio/video/frames are removed after processing. Incomplete uploads can leave orphans and abandoned draft covers currently have no expiry. Before broader launch, add a paginated storage/reference audit and age-based orphan cleanup. Do not treat absence from `uploads` as proof of an orphan: import and migration photos follow other creation paths.

The catalogue migration was additive: production table IDs differed from development, so `migrations.ts` assigns new recipe IDs and records the legacy mapping. `scripts/migrate-legacy.mjs` is restartable, retains its private progress ledger in ignored `outputs/deployment`, and never replaces/deletes tables. The 53 migrated photos total 6,372,958 bytes.

## Environment and deployment

- Next.js: both Convex URLs, Clerk keys/routes, `OPENAI_API_KEY`, `MEDIA_WORKER_URL`, `MEDIA_WORKER_SECRET`, `IMPORT_WORKER_SECRET`, `RECIPE_ALLOWED_HOSTS`.
- Convex: `CLERK_JWT_ISSUER_DOMAIN`, `IMPORT_WORKER_URL`, `IMPORT_WORKER_SECRET`.
- Python service: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MEDIA_WORKER_SECRET`.

Use the actual assigned Vercel host, `purrfect-plate-theta.vercel.app`, for worker URL and upload-host validation. Set Vercel environment values with explicit `--project` selection. Deploy Convex schema/functions before clients that require them. Root and `services/media` have separate ignored Vercel project links.

Development imports need a separate reachable worker configured for development Convex. A production worker cannot resolve development job IDs. The local library's normal CRUD uses development Convex; use the hosted app for production import acceptance.

## Open launch work

- Hosted Google sign-in and the Instagram import/save/edit flow have passed. Email-code sign-in, broader source coverage, and the remaining browser acceptance checks still need completion.
- TikTok save/fresh-load and its 46,840-byte WebP cover passed after repairing the unsaved normalization draft. A new import must still exercise the updated normalizer end to end. Website group headings and referenced notes are now preserved when one matching WP Recipe Maker card agrees with the complete JSON-LD ingredient sequence. The old Greek chicken draft still needs fresh extraction to receive them.
- Configure production Clerk and Google OAuth when a domain is chosen; current keys are the supplied development instance. Repeat verified invitation joins after switching instances.
- Real `main` pushes now trigger successful production builds for both Vercel projects. Web root is the repository root; media root is `services/media`. Keep media source included in the root `.vercelignore`. Convex deployment remains a separate CLI step until a project deploy key is installed in the build environment.
- Hosted YouTube import now works through Gemini 3.6 Flash when native access is blocked. CrunchWrap and the wrapping tutorial passed import, review and save; the silent biryani sample correctly returned insufficient evidence and alternative search. Broader video/language coverage and independent accuracy review remain necessary. Failed proof-of-origin diagnostics were removed and deployed; see [YouTube research](youtube-retrieval.md).
- Wire home-page pagination (currently compatibility list is capped at 500 rows); tag discovery is capped at 1,000 recipes.
- Resolve dependency advisories before public launch. Next.js upgrade removed critical advisories, but Undici was patched to 7.29.1. The refreshed production audit reports 0 critical, 6 high, 5 moderate and 1 low advisories, concentrated in Clerk UI’s wallet/React Native dependency tree. Isolate dependency installs from active dev sessions.
- Add cost monitoring, orphan cleanup and durable per-stage processing before scaling advertising traffic. Self-hosted extraction still incurs compute, storage/bandwidth and OpenAI charges.

The acceptance checklist lives in `production-plan.md`. Tests and a successful deployment are separate from real browser/platform proof.

## Cooking and extension seams

The recipe detail screen delegates to `PantryCookingPanel`, which supplies shared pantry controls to the reusable `CookingPanel`. Cooking adjustments never write quantities back to Convex. `ingredientForCooking` is the client-safe pure interface for serving and unit display; a native UI can reuse it without importing web components. Ambiguous ranges, package quantities and unspecified volume conventions stay as written. The original method and source amounts remain available. See [cooking behavior](cooking.md) and [pantry semantics](pantry.md).

Keep retrieval, normalization, image processing, durable job state and presentation separate. Add a provider behind the retrieval boundary rather than branching by provider in route components. Prefer explicit domain interfaces over generic service/repository layers. Tests call the same parser, authenticated mutations and UI controls that production uses; add a failing behavior test at those seams before each functional change. Do not mock internal helpers just to mirror their implementation.

## Minimal tags

`canonicalizeRecipeTags(name, tags)` is used by saving and normalization. Keep at most three supplied meaningful tags, normalize synonyms, remove generic filler, and add an unequivocal biryani/mac-and-cheese family from the title. Do not infer dietary labels. Recipes remain separate; tags provide simple grouping. The audited production cleanup changed 12 of 55 recipes, retained all 55, and privately backed up the original rows. The internal maintenance mutation compares timestamps/tags before writing to preserve concurrent edits.
