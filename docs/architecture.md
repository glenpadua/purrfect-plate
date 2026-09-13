# Architecture and operations

Start with [How the app works](how-the-app-works.md) for the plain-language explanation.

## Boundaries

The root [feature map](../AGENTS.md#find-the-change) owns task-to-module navigation. This document owns the contracts between those modules; [Development workflow](development.md) owns runtime and validation choices.

## API and data

Clerk issues the `convex` JWT with audience `convex`, `email`, and `email_verified`. Convex exposes the latter as `identity.emailVerified`. Every user-facing data function checks library membership. Clients cannot choose a different library ID. Both invited addresses join the same library.

`imports.start({url})` returns a durable job ID. `get` and `list` provide reactive progress. `retry` explicitly retries failures. `save({id,draft})` atomically creates one recipe and returns its ID; repeating the save returns that recipe. `recipes` exposes list/listPage, get, create, update, remove and markCooked. Web and mobile use these same functions with Clerk authentication.

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

Development imports use `scripts/dev-import-worker.ts` to claim jobs through `convex/localImportWorker.ts` and invoke the Next worker handler in-process. This path is restricted to `basic-poodle-462`; `convex/importWorker.ts` skips hosted dispatch there. It needs a matching worker secret but no `IMPORT_WORKER_URL`, Next listener or tunnel. Follow [README setup](../README.md#start-local-development) for startup and restart behavior. Production retains the hosted dispatch path described above; its worker cannot resolve development job IDs.

## Open launch work

- Hosted Google sign-in and the Instagram import/save/edit flow have passed. Email-code sign-in, broader source coverage, and the remaining browser acceptance checks still need completion.
- TikTok save/fresh-load and its 46,840-byte WebP cover passed after repairing the unsaved normalization draft; broader fresh-source coverage remains open. Website group headings and referenced notes are preserved when one matching WP Recipe Maker card agrees with the complete JSON-LD ingredient sequence. The Greek chicken draft has now passed hosted re-extraction, save and fresh reload with those fields.
- Configure production Clerk and Google OAuth when a domain is chosen; current keys are the supplied development instance. Repeat verified invitation joins after switching instances.
- Real `main` pushes now trigger successful production builds for both Vercel projects. Web root is the repository root; media root is `services/media`. Keep media source included in the root `.vercelignore`. Convex deployment remains a separate CLI step until a project deploy key is installed in the build environment.
- Hosted YouTube import works through Gemini 3.6 Flash when native access is blocked. CrunchWrap passed import, review and save. The wrapping tutorial exposed an overly broad cooking guardrail; its test recipe was removed with approval and the corrected preflight now rejects it as a technique. Silent biryani returned insufficient evidence and alternative search. Broader video/language coverage and independent accuracy review remain necessary; see [YouTube research](youtube-retrieval.md).
- Wire home-page pagination (currently compatibility list is capped at 500 rows); tag discovery is capped at 1,000 recipes.
- Resolve dependency advisories before public launch. Next.js upgrade removed critical advisories, but Undici was patched to 7.29.1. The refreshed production audit reports 0 critical, 6 high, 5 moderate and 1 low advisories, concentrated in Clerk UI’s wallet/React Native dependency tree. Isolate dependency installs from active dev sessions.
- Add cost monitoring, orphan cleanup and durable per-stage processing before scaling advertising traffic. Self-hosted extraction still incurs compute, storage/bandwidth and OpenAI charges.

The acceptance checklist lives in `production-plan.md`. Tests and a successful deployment are separate from real browser/platform proof.

## Cooking and extension seams

The recipe detail screen uses `SavedCookingPanel` to persist each user's portion/unit preference, then `PantryCookingPanel` supplies shared pantry controls to `CookingPanel`. Display transformations preserve source amounts; base-serving corrections are shared recipe data. `ingredientForCooking` is the client-safe pure display interface, and structured quantities retain their source text separately from scaling corrections. See [cooking behavior](cooking.md) for supported amounts, persistence and test seams, and [pantry semantics](pantry.md) for checkboxes.

Keep retrieval, normalization, image processing, durable job state and presentation separate. Add a provider behind the retrieval boundary rather than branching by provider in route components. Prefer explicit domain interfaces over generic service/repository layers. Tests call the same parser, authenticated mutations and UI controls that production uses; add a failing behavior test at those seams before each functional change. Do not mock internal helpers just to mirror their implementation.

## Minimal tags

`canonicalizeRecipeTags(name, tags)` is used by saving and normalization. Keep at most three supplied meaningful tags, normalize synonyms, remove generic filler, and add an unequivocal biryani/mac-and-cheese family from the title. Do not infer dietary labels. Recipes remain separate; tags provide simple grouping. The audited production cleanup changed 12 of 55 recipes, retained all 55, and privately backed up the original rows. The internal maintenance mutation compares timestamps/tags before writing to preserve concurrent edits.


## Universal product UI boundary (12 September 2026)

The only product UI is the Expo application in `apps/mobile`, targeting native iOS/Android and browsers with React Native Web. The folder name is historical. Expo Router route files compose the same feature screens for all targets; there are no parallel web/native copies of library, detail, cooking, editor, imports, pantry or account screens. `ui/product-shell.tsx` owns responsive navigation, and `ui/index.tsx` owns the shared typography and controls. Browser breakpoints change layout, not feature ownership.

Keep platform differences at authentication, device/browser media handling and provider embeds. Both platforms use Convex feature hooks and the generated API contract. `packages/recipe-core` continues to expose pure domain helpers, image policy, source URL validation and the existing palette. Outfit font assets are loaded by the universal root so browser/native text metrics share the same source.

The root Next 16 application is now a server-only gateway. Its product pages, layout/providers, old components, feature screens and Tailwind/shadcn dependencies have been removed. Its server APIs and extraction boundaries are not imported into Metro. No legacy Next/Expo adapter is used. Following Glen's deployment request on 12 September 2026, the production site serves the Expo web SPA for product paths while preserving `/api/*` on the existing server. `scripts/build-product-web.mjs` exports the client with the deployment's public Convex/Clerk configuration into ignored `public/universal`; `next.config.mjs` routes exported assets and falls back to Expo for all non-API screens, including unknown routes. Missing API and bundle paths stay out of that fallback. The previous Vercel deployment remains available for rollback. SPA rendering trades request-time HTML/SEO for one authenticated application implementation. Next can eventually be removed once its remaining server endpoints move to another host/runtime.

See [the current mobile/universal record](mobile-plan.md) for platform adapters, local commands, verification evidence, known parity gaps and the 500-row compatibility query limit. Local browser and simulator success are not authorization to replace production.


## Pantry integration

The separate pantry task is preserved in commit `076f532`. Its Convex functions, schema additions, deterministic ingredient dictionary and backend tests were brought across intact. The Expo UI implements its contract: checkboxes mean presence at home, renames keep aliases and require confirmation for collisions, shopping is independent, and Clear/Undo restores the removed snapshot without removing concurrent additions. Pantry pages contain 60 entries; library coverage queries are grouped into 20-recipe batches. The previous 300-row pantry view is gone.

`pantry.initialize` upgrades a library idempotently before its new pantry queries are enabled. Preserve the import dismissal field and `by_library_dismissed_created` index alongside the pantry schema. Deploy the combined schema; deploying the older pantry checkout alone can remove that newer index. See [pantry.md](pantry.md) for API and migration details.
