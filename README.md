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

Use Node 24 and pnpm 10. Configure credentials privately using .env.local.example as a reference.

```bash
pnpm install --frozen-lockfile
pnpm exec convex dev
pnpm dev
# Shared browser preview: http://127.0.0.1:8082
pnpm test:run
pnpm test:mobile
pnpm typecheck
pnpm build
```

`pnpm dev` and `pnpm product:web` start the same Expo/Metro application. Use `pnpm mobile:ios` for the iOS simulator. Changes to shared screens appear in both connected development clients. The production website and installed phone releases need their respective release steps; they do not update merely because a local file changed.

For server API development only, run `pnpm server:dev --port 3101`. The local extraction CLI still targets that API server; it has no separate frontend. Stop and restart development servers when workspace dependency links change.

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

| Change | Source |
| --- | --- |
| Screens, forms, buttons, responsive layout | `apps/mobile/src/features`, `apps/mobile/src/ui` |
| Navigation and routes | `apps/mobile/src/app` |
| Shared recipe, import and pantry rules | `convex` and pure helpers in `lib` |
| Shared API/types, ingredient helpers and palette | `packages/recipe-core` |
| Server extraction and media processing | `app/api`, `lib/recipe-import`, `services/media` |

There is one product frontend. Do not add new product pages under root `app`, or recreate root `components`/`features`. Those duplicate implementations have been removed. The historical `apps/mobile` name includes the web application too. Small `.web.tsx` adapters handle browser-specific authentication, photo selection and provider embeds; they do not duplicate product screens.

The pantry work from **Simplify pantry ingredient states** is preserved in Git commit `076f532` and ported into this shared UI, including its schema, dictionary, corrections, merge flow and tests. See [the pantry contract](docs/pantry.md).
