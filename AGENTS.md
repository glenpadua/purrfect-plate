# Working in Purrfect Plate

One Expo UI serves web, iOS and Android from `apps/mobile`. Root Next.js hosts server APIs and the exported web SPA. Put product screens in Expo; `app/api` is the server boundary.

## Start a task

1. Check `git status --short` and the relevant diff; this checkout may contain another task's unfinished work.
2. Locate the feature below and read its adjacent tests. For UI changes, also read [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md).
3. For setup, test selection or a build failure, read [Development workflow](docs/development.md). It links the canonical setup and gives focused commands; most tests need no running services.
4. Complete the affected checks there and report what passed, plus any live/device behavior still unverified. When changing a command, boundary or feature contract, update its owning document in the same change.

Commands below assume the repository root. Use the Node version in `.node-version` and pnpm version in `package.json`; install the workspace from the root. If this environment supplies RTK, prefix shell commands with `rtk` (`rtk proxy <command>` preserves raw output); commands in project docs are shown without the wrapper for portability.

## Find the change

| Task | Start here | Read when changing behavior |
| --- | --- | --- |
| Browse, search, detail, favourites | `apps/mobile/src/features/library`, `convex/recipes.ts` | [Architecture](docs/architecture.md) |
| Add/edit recipe, review imported draft | `apps/mobile/src/features/recipe-editor`, `apps/mobile/src/features/recipe-import`, `lib/recipe-lines.ts` | [Cooking and source-line preservation](docs/cooking.md) |
| Servings, ingredient amounts, cook mode | `apps/mobile/src/features/cooking`, `lib/cooking.ts`, `lib/servings.ts`, `convex/recipes.ts` | [Cooking](docs/cooking.md) |
| Pantry, aliases, shopping | `apps/mobile/src/features/pantry`, `convex/pantry.ts`, `lib/pantry.ts` | [Pantry contract](docs/pantry.md) |
| Import queue, retries, extraction | `convex/imports.ts`, `convex/importWorker.ts`, `lib/recipe-import/service.ts` | [Architecture](docs/architecture.md), [guardrails](docs/import-guardrails.md) |
| Python media retrieval, YouTube fallback | `services/media`, `lib/recipe-import/media-result.ts` | [YouTube evidence](docs/youtube-retrieval.md) |
| Source players | `apps/mobile/src/features/recipe-source`, `lib/recipe-source.ts` | [Embeds](docs/source-embeds.md) |
| Sign-in, invitations, library access | `apps/mobile/src/features/auth`, `convex/access.ts`, `convex/libraries.ts`, `convex/auth.config.ts` | [Access boundaries](docs/architecture.md#api-and-data) |
| Navigation, shared controls, theme | `apps/mobile/src/app`, `apps/mobile/src/ui`, `packages/recipe-core/palette.json` | [UI instructions](apps/mobile/AGENTS.md) |
| Photos, uploads, storage | `apps/mobile/src/lib/recipe-photo*`, `lib/recipe-image-policy.ts`, `convex/recipes.ts` | [Image lifecycle](docs/architecture.md#image-lifecycle) |
| API gateway, web export, routing | `app/api`, `proxy.ts`, `scripts/build-product-web.mjs`, `next.config.mjs` | [Build workflow](docs/development.md#builds) |
| Release or deployment | `.github/workflows/ci.yml`, `vercel.json`, `services/media/vercel.json` | [Required release verification](docs/production-plan.md#required-release-verification) |

## Boundaries that matter

- Client-safe domain exports live in `packages/recipe-core`; generated API/type references are safe, server implementations and extraction providers stay outside the client bundle. `convex/schema.ts` and `convex/model.ts` own data validators; regenerate `convex/_generated` through Convex tooling after backend changes.
- User-facing Convex operations authorize library membership through `convex/access.ts`. Keep source evidence separate from editable recipe text and derived cooking quantities; domain docs above own the detailed rules.
- Development uses `basic-poodle-462`; production uses `spotted-gazelle-950`. Inspect the selected environment before a backend command. `convex dev` syncs remote development code; migrations/backfills mutate data. Local tests use development or in-memory fixtures.
- Keep credentials in ignored environment files. Expo receives only public Convex/Clerk configuration. Setup belongs in [README](README.md#development); historical acceptance notes are evidence, not current setup instructions.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
