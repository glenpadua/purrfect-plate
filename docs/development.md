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

Run commands from the repository root. Start with the test nearest the changed behavior; inspect the output to confirm the expected tests actually ran. Test commands fail when a filter matches no tests; do not use `--passWithNoTests` to bypass that check.

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

For a complete local code check, run `pnpm check`: lint, formatting, root/mobile types, domain/backend tests, and shared UI tests. `pnpm format` applies the committed style to handwritten JavaScript/TypeScript source. Generated files, build outputs and local evidence are excluded.

Before handing off code changes, run the affected suite (`pnpm test:run` for backend/domain, `pnpm test:mobile` for UI) and `pnpm typecheck`. Shared exports or API contract changes need both suites. Python changes need the corresponding discovery command above. UI work needs a browser or simulator check of the changed interaction; record which target was checked. Documentation-only changes need valid paths, accurate commands and a clean whitespace diff, not an application build.

Before a release, run the full CI set from `.github/workflows/ci.yml`, then follow [release verification](production-plan.md#required-release-verification). CI also enforces ESLint (including hook and feature-import rules), Prettier, client-package dependency checks, and built-web routing smoke tests. Signed-in browser interactions remain a separate acceptance check; the routing smoke test is not a browser E2E suite.

## Builds

`pnpm typecheck` generates Next route types, checks root TypeScript, then checks the Expo workspace with its own TypeScript version. A bare root `tsc` does not check the mobile app.

`pnpm build` exports Expo web and builds the Next gateway. Use it for changes to routing, bundling, dependencies, server handlers or release configuration. It reads root `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, deliberately ignores mobile `.env.local`, and supplies `EXPO_PUBLIC_*` to the exporter. A working Metro environment alone does not configure this build. CI provides synthetic public values for an offline build; that bundle cannot validate login or library access.

`pnpm test:web` starts a temporary built gateway on a free loopback port, verifies product deep links and the actual Expo bundle, rejects SPA fallbacks for missing APIs/assets, and stops its server. CI runs it after `pnpm build`; it uses no authentication or live library data.

To inspect a built app, run `pnpm start --port 3101` after the build. Check the affected deep link, an unknown product route, and missing `/api/*` and bundle paths: only product routes should receive the Expo SPA. This checks the Next rewrites that Metro does not exercise. `pnpm --filter @purrfect-plate/mobile export:ios` checks native bundling, separately from runtime/device acceptance.

Generated build output lives in `.next`, `apps/mobile/dist-web` and `public/universal`. Change the source/export configuration and regenerate it. Keep the Next-managed block in root `AGENTS.md`; `next dev` re-adds it. `CLAUDE.md` files point to their sibling `AGENTS.md` so instructions have one owner.

## Extraction investigations

Production import orchestration starts at `lib/recipe-import/service.ts`; `services/media` handles private Python retrieval. The older `lib/extraction-prototype` and `scripts/extraction-worker` are a separate experiment, with a local-only API and no recipe persistence. Read [the prototype guide](extraction-prototype.md#run) only when working on that harness.

`pnpm test:extraction:live` makes real network/provider calls and can consume AI credits; it is outside the normal test loop. Use a single supplied source with `--url` when investigating a specific failure, retain its evidence, and verify extraction → review → save → fresh reload in the product for actual import acceptance. Prototype success alone does not exercise the durable queue or authenticated save.

## Adding and changing features

- Start with a thin Expo route that imports its feature screen. Keep Convex hooks in that feature's `data.ts`; ESLint rejects direct Convex hooks in screens. Platform-specific UI stays in `.web.tsx` adapters.
- Put shared display primitives in `src/ui`: layout in `page.tsx`, controls in `controls.tsx`, text in `typography.tsx`, and styles in `styles.ts`. The `index.ts` barrel keeps callers independent of those file names. Shared action state lives in `src/hooks/use-task.ts`, including its guard against duplicate submissions and injectable error presentation.
- Keep deterministic transformations in root `lib` with adjacent Vitest tests, then deliberately export client-safe ones through `packages/recipe-core`. Its dependency tests traverse runtime imports to prevent accidental server/provider inclusion. Form parsing is `recipeChangesFromForm`; the UI owns input state and navigation.
- Keep authenticated Convex entry points in the existing feature module so clients retain stable function names. Pantry storage/matching helpers live in `convex/pantry`; recipe validation is `convex/recipeContent.ts`, shared by manual writes, import review and maintenance. Test mutations through authenticated `convex-test` calls, rather than mocking helper implementations.
- Add a regression at the closest public interface for a behavior fix. For a new query/operation, test missing access and another library's IDs alongside the normal flow. Exercise controls in native component tests and check the affected web interaction in the inline browser.

Use [the architecture guide](architecture.md) for constraints that still need product or operational work. Code cleanup does not substitute for its release and physical-device acceptance requirements.
