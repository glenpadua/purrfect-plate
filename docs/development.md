# Development workflow

## Setup and services

[README: Development](../README.md#development) owns installation, environment configuration, the three-terminal startup and import troubleshooting. Read it for a fresh checkout, missing credentials, sign-in failure or a stuck import. Runtime and command versions live in `.node-version`, root `package.json`, and `apps/mobile/package.json`; CI lives in `.github/workflows/ci.yml`.

Choose only the services the task needs:

| Work | Required runtime |
| --- | --- |
| Domain, Convex or component tests | Installed pnpm workspace; no login, Metro, Convex deployment or provider keys |
| Product screens | `pnpm dev` (Expo web on port 8082), development public client configuration and existing Clerk/library access |
| Changed backend functions/schema | Also `pnpm exec convex dev` to sync the development backend and generated types |
| Real imports through the product | Also `pnpm import:worker`; root server credentials and configured media service for social sources |
| Next API handlers | `pnpm server:dev --port 3101`, with the relevant root server configuration |
| iOS simulator | [Mobile setup](../apps/mobile/README.md#ios-simulator); reuse Metro where possible |

`pnpm dev` starts Expo, not Next. The outbound development import worker calls `app/api/internal/imports/route.ts` in-process and claims jobs through `convex/localImportWorker.ts`; normal development imports need no Next listener or tunnel. Restart that worker after extraction code/environment changes. The hosted dispatcher in `convex/importWorker.ts` is a separate production path.

## Focused checks

Run commands from the repository root. Start with the test nearest the changed behavior; inspect the output to confirm the expected tests actually ran. Root `test:run` allows zero tests, so a misspelled filter can otherwise appear successful.

```sh
# Pure domain or authenticated Convex behavior (replace with the affected files)
pnpm exec vitest run lib/cooking.test.ts convex/servings.test.ts

# One shared UI component; Jest paths are relative to apps/mobile
pnpm --filter @purrfect-plate/mobile exec jest --runInBand --runTestsByPath src/features/cooking/cooking-panel.native.test.tsx

# Fast UI-only type check
pnpm mobile:typecheck

# Media evidence boundary; standard library only, Python 3.12+ (CI uses 3.12)
python3 -m unittest discover -s services/media -p 'test_*.py'

# Local prototype retrieval boundary (separate from the production media suite)
python3 -m unittest discover -s scripts/extraction-worker -p 'test_*.py'
```

Vitest excludes `apps/mobile`; Jest selects only `*.native.test.tsx`. Tests in `convex` use `convex-test` and exercise authenticated operations in memory. Follow an adjacent test's fixture and environment setup. Shared helpers belong in root Vitest tests; visible control behavior belongs in Jest. `.web.tsx` adapters also need an actual browser check.

Before handing off code changes, run the affected suite (`pnpm test:run` for backend/domain, `pnpm test:mobile` for UI) and `pnpm typecheck`. Shared exports or API contract changes need both suites. Python changes need the corresponding discovery command above. UI work needs a browser or simulator check of the changed interaction; record which target was checked. Documentation-only changes need valid paths, accurate commands and a clean whitespace diff, not an application build.

Before a release, run the full CI set from `.github/workflows/ci.yml`, then follow [release verification](production-plan.md#required-release-verification). There is no configured lint script or browser E2E runner; screenshots and historical browser reports are not a repeatable automated suite.

## Builds

`pnpm typecheck` generates Next route types, checks root TypeScript, then checks the Expo workspace with its own TypeScript version. A bare root `tsc` does not check the mobile app.

`pnpm build` exports Expo web and builds the Next gateway. Use it for changes to routing, bundling, dependencies, server handlers or release configuration. It reads root `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, deliberately ignores mobile `.env.local`, and supplies `EXPO_PUBLIC_*` to the exporter. A working Metro environment alone does not configure this build. CI provides synthetic public values for an offline build; that bundle cannot validate login or library access.

To inspect a built app, run `pnpm start --port 3101` after the build. Check the affected deep link, an unknown product route, and missing `/api/*` and bundle paths: only product routes should receive the Expo SPA. This checks the Next rewrites that Metro does not exercise. `pnpm --filter @purrfect-plate/mobile export:ios` checks native bundling, separately from runtime/device acceptance.

Generated build output lives in `.next`, `apps/mobile/dist-web` and `public/universal`. Change the source/export configuration and regenerate it. Keep the Next-managed block in root `AGENTS.md`; `next dev` re-adds it. `CLAUDE.md` files point to their sibling `AGENTS.md` so instructions have one owner.

## Extraction investigations

Production import orchestration starts at `lib/recipe-import/service.ts`; `services/media` handles private Python retrieval. The older `lib/extraction-prototype` and `scripts/extraction-worker` are a separate experiment, with a local-only API and no recipe persistence. Read [the prototype guide](extraction-prototype.md#run) only when working on that harness.

`pnpm test:extraction:live` makes real network/provider calls and can consume AI credits; it is outside the normal test loop. Use a single supplied source with `--url` when investigating a specific failure, retain its evidence, and verify extraction → review → save → fresh reload in the product for actual import acceptance. Prototype success alone does not exercise the durable queue or authenticated save.
