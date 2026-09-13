# Purrfect Plate

A shared cat-themed recipe library for Glen and Millusha. Import public links, review recipes, play supported sources inline, adjust portions and units, use cook mode, and keep a simple shared pantry and shopping list.

## Stack

- Expo 57 / React Native 0.86: one UI for web, iOS and Android in `apps/mobile`.
- Vercel serves the Expo web export. Next.js 16 runs server APIs only; there are no Next.js product screens.
- Convex for authenticated shared-library data, storage and durable import jobs.
- Clerk for Google and email-code sign-in. Verified invitations grant membership; both users share one library.
- A private Python/FastAPI media service using yt-dlp, Instaloader, youtube-transcript-api and FFmpeg.
- OpenAI: `gpt-5.4-2026-03-05` with low reasoning for readable recipe normalization; `gpt-4o-mini-transcribe` for audio; `gpt-4.1-mini` for OCR and frame inspection. Complete publisher JSON-LD recipes bypass AI normalization.
- Gemini 3.6 Flash for bounded YouTube video-input fallback when native access is blocked.
- Sharp for server-side image optimization.

## Development

Use Node 24 and pnpm 10. Install with `pnpm install --frozen-lockfile`.

### Configure once

Keep credentials in ignored `.env.local` files, never in Git. The root `.env.local.example` lists server variables; `apps/mobile/.env.local.example` lists the public client variables.

- Root `.env.local`: `CONVEX_DEPLOYMENT=dev:basic-poodle-462`, `CONVEX_URL=https://basic-poodle-462.convex.cloud`, and one `NEXT_PUBLIC_CONVEX_URL` pointing to that same development backend. Add the private `IMPORT_WORKER_SECRET` matching the development Convex deployment, `OPENAI_API_KEY`, and `MEDIA_WORKER_URL` / `MEDIA_WORKER_SECRET` for video or photo posts. Copy these from the existing private project configuration; do not invent replacement secrets.
- `apps/mobile/.env.local`: `EXPO_PUBLIC_CONVEX_URL=https://basic-poodle-462.convex.cloud` and the existing `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. This file is what Metro reads; root `NEXT_PUBLIC_*` variables do not configure the local app.
- The development Convex deployment also needs the existing Clerk issuer, invitations/library setup, and matching `IMPORT_WORKER_SECRET`. A fresh backend needs those configured before sign-in and imports can work.
- The local worker is explicitly limited to `basic-poodle-462`. Production `spotted-gazelle-950` continues using the hosted worker. Never point a local test at production.

### Start local development

Run these in **three separate terminals**, from the repository root, and leave them running:

```bash
# Terminal 1: sync backend changes to development
pnpm exec convex dev
```

```bash
# Terminal 2: web app
pnpm dev
# Open http://localhost:8082
```

```bash
# Terminal 3: imports, using the current local extraction code
pnpm import:worker
# Expected: Local import worker ready: development queue, no public tunnel.
```

The import worker connects outward to the development queue. **No Cloudflare tunnel, public local server, or development `IMPORT_WORKER_URL` is needed.** An old temporary tunnel URL can be left unused. Restart `pnpm import:worker` after changing extraction code or root environment variables; it does not hot reload. Metro updates shared screens automatically. Restart Metro after changing its environment or workspace dependency links.

Sign in at `http://localhost:8082`, paste a recipe link in Imports, review the resulting draft and its **Ingredient amounts**, then save. A stopped import worker leaves new jobs queued; restart it to pick them up. If a running job was interrupted, its lease expires after six minutes and it can be retried. Closing the browser does not stop a running worker.

### Troubleshooting imports

- **Queued and not moving:** ensure Terminal 3 is running and Terminal 1 has synced `localImportWorker.claimNext`.
- **Worker cannot reach development queue:** check the network, development backend URL, and matching worker secret. Secrets are never printed in worker logs.
- **Import service could not finish:** older local setups used expiring public tunnels. Sync Convex, start the current worker, then retry the failed import. Do not recreate the tunnel.
- **Video/photo retrieval warning:** check the configured media service and its credentials. A working web UI does not prove video extraction is configured.
- **Sign-in works but library is unavailable:** verify the development Clerk issuer and verified invitation/library membership.
- **Changed extraction code has no effect:** restart the import worker, not just the browser.

`pnpm product:web` is an alias for the same Expo/Metro app. Use `pnpm mobile:ios` for the simulator. For the optional extraction-prototype API only, run `pnpm server:dev --port 3101`; this is not required for normal local imports.

### Verify changes

```bash
pnpm test:run
pnpm test:mobile
pnpm typecheck
pnpm build
```

Structured quantities are added automatically on import/save. Older recipes also work immediately through the read fallback. To persist those records in development, run the bounded backfill for `recipes` and `imports`, passing each returned cursor until `done` is true:

```bash
pnpm exec convex run quantityMaintenance:backfill '{"table":"recipes","cursor":null}'
pnpm exec convex run quantityMaintenance:backfill '{"table":"imports","cursor":null}'
```

The backfill is repeatable and preserves original text, source attribution, and quantity corrections. It does not re-import sources or call AI. Local changes do not update production or installed phone releases.

## Hosted pilot

Web: https://purrfect-plate-theta.vercel.app

The hosted product screens use the same Expo/React Native UI as the iOS app. `pnpm build` exports that web client, then builds Next.js for the existing server APIs. Next rewrites product deep links to the exported SPA; `/api/*` remains server-side. The release script derives Expo's public configuration from the web deployment's `NEXT_PUBLIC_*` variables and refuses a development Convex URL in production. Local Expo continues using its separate development configuration.

Production Convex: spotted-gazelle-950. Development: basic-poodle-462. Private media project: purrfect-plate-media.

Both Vercel projects are connected to the GitHub repository for automatic production deployment from `main`. The media project uses `services/media` as its root. Convex functions still deploy separately with `pnpm exec convex deploy`.

Clerk currently uses the supplied development instance until a domain and production instance are configured. This is a private pilot, not yet a completed public-launch acceptance. See docs/production-plan.md and docs/architecture.md for outstanding checks and boundaries.

## Image storage

New images are metadata-free WebP, at most 1440 pixels on either side and 350,000 bytes. Compression increases if needed. Video/audio/frames remain temporary; only a final cover is saved to Convex. The 53 migrated photos total 6,372,958 bytes, with the largest at 221,066 bytes. Missing covers use a placeholder.

## Import behaviour

Paste a public HTTPS recipe link, wait for a durable draft, review its ingredients/steps/warnings and save. Repeated canonical links reuse a job; repeated saves return one recipe. Wrong targets and clear standalone technique tutorials reject early; final source classification catches tutorials missed by metadata. Partial real recipes remain reviewable. Missing facts are flagged rather than invented. Tags stay at three or fewer, with dish tags grouping variants. Original evidence stays separate from editable content. Visual guesses never become recipe facts. Unsaved drafts can explicitly re-extract the source under a last-update check.

The local extraction CLI and `/api/extraction-prototype` remain available for debugging; that API is disabled on Vercel. The retired `/extraction-prototype` frontend has been removed. Earlier experiments are documented in docs/extraction-prototype.md.

## Start here for contributors and agents

- [AGENTS.md](AGENTS.md): task-to-feature map and repository boundaries.
- [Development workflow](docs/development.md): service selection, focused tests, build configuration and completion checks.
- [How the app works](docs/how-the-app-works.md): a plain-language guide with diagrams and release examples.
- [Architecture and operations](docs/architecture.md): module ownership, authentication, jobs, image lifecycle and known limits.
- [Import guardrails](docs/import-guardrails.md): cheap relevance checks, limits and honest alternatives.
- [Cooking behavior](docs/cooking.md): supported amounts, unit conventions and test seams.
- [Pantry and shopping](docs/pantry.md): presence, aliases, recipe checkboxes and independent temporary shopping lists.
- [Inline sources](docs/source-embeds.md): supported players, mobile layout and platform limitations.
- [Production acceptance](docs/production-plan.md): verified behavior versus remaining checks.
- [YouTube investigation](docs/youtube-retrieval.md): evidence and the current fallback experiment.
- [Mobile plan](docs/mobile-plan.md): Expo, Clerk/Convex reuse, Mac setup and installation on both iPhones.

Run `pnpm test:run`, `pnpm test:mobile` and `pnpm typecheck` before deployment. Use the production build for route and bundling checks; tests do not substitute for hosted sign-in, source extraction or real-device acceptance. Deploy additive Convex changes before the web build. Keep credentials and generated evidence out of Git.

After **every release**, verify production Convex independently with `pnpm verify:production:convex`, wait for GitHub CI on the exact pushed commit, check the Vercel production alias, and exercise the affected hosted feature. A successful web deployment does not prove a backend deployment or CI passed. Follow the [release verification checklist](docs/production-plan.md#required-release-verification).

## Where to make changes

Use the [feature map](AGENTS.md#find-the-change) to locate the implementation and its behavior contract. The historical `apps/mobile` name includes the web application too; root Next.js hosts server APIs and the exported SPA.

The pantry work from **Simplify pantry ingredient states** is preserved in Git commit `076f532` and ported into this shared UI, including its schema, dictionary, corrections, merge flow and tests. See [the pantry contract](docs/pantry.md).
