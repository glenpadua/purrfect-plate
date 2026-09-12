# Shared web and mobile application

The product frontend is the Expo app in `apps/mobile`, for browsers, iOS and Android. Next.js no longer has product screens; it serves the Expo web export and server APIs. Dark mode and animated cats are deferred. Start with [the architecture guide](how-the-app-works.md).

## Development

Run `pnpm dev` from the repository root for the shared Metro server at `http://127.0.0.1:8082`. The booted iOS simulator can open the same server with `xcrun simctl openurl booted exp://127.0.0.1:8082`. `pnpm mobile:ios` is a separate helper that defaults to port 8081. Restart Metro after dependency changes. Use `pnpm server:dev --port 3101` only when working on server endpoints.

Development Convex is `basic-poodle-462`; production is `spotted-gazelle-950`. Each client must use the matching Clerk/Convex public configuration. Server/provider secrets never belong in the Expo app.

Xcode and an iOS simulator runtime have been installed on this Mac. The app has previously run in Expo Go on the iPhone 17 Pro simulator. Physical iPhones, Android and App Store distribution have not been validated. No Apple membership purchase or enrollment was performed.

## Current behavior

Shared screens include library/search/imported filters, recipe CRUD/photo upload, favourites, dinner selection, grouped ingredients/method, portions/units, cook mode, import review/recovery, pantry/shopping and account. Saved import warnings are collapsed after the recipe. Failed imports can be cleared with Undo. Add Recipe offers importing.

The pantry task from commit `076f532` is ported into Expo: recipe checkboxes reflect pantry presence, corrections remember exact recipe lines, aliases survive rename, merging is explicit, and shopping stays independent with Clear/Undo and plain-name copy/share. No old Have it/Need it/Bought workflow remains. See [the complete pantry contract](pantry.md).

Only authentication, photo processing, sharing and embedded sources have platform adapters. All product screens are shared. Changing a shared control changes both builds; live releases still require deployment.

## Validation and release

Run `pnpm test:run`, `pnpm test:mobile`, `pnpm typecheck`, and `pnpm build`. The root build exports Expo web and builds the API gateway. Use `pnpm --filter @purrfect-plate/mobile export:ios` for native bundle validation.

Web is hosted at [Purrfect Plate](https://purrfect-plate-theta.vercel.app). Vercel builds use production configuration. Convex deploys separately. Keep the full combined schema, including the import dismissal index, when deploying pantry changes. An older web bundle expects the old pantry functions; do not roll back the frontend independently of its backend contract.

Fresh development imports need a reachable authenticated worker. The previously approved temporary tunnel expired; its replacement is not approved. Production has its own Vercel worker and does not depend on that tunnel or the Mac.

## Remaining acceptance

- Check actual iPhone installation, login, photo permissions, keyboard/safe areas and lifecycle behavior.
- Verify playback with supported real Instagram, TikTok and YouTube examples on each target; a loaded frame does not prove playback.
- Verify Android before claiming parity there.
- Configure standalone native signing/builds and later TestFlight/App Store distribution. EAS Update is not configured; web deployments do not update installed app binaries.
- Offline recipes, persistent cook progress and incoming share extensions are future work.
- Home library listing is currently capped at 500 recipes; pantry pagination is independent and is implemented.

[Historical planning and previous verification checkpoints](history/mobile-foundation-2026-09-12.md) are retained for provenance, not current setup instructions.

## Consolidation verification — 12 September 2026

The preserved original pantry commit is `076f532`; the shared UI port and removal are in `af2bd16`, with original task ancestry retained by `b44bba5`. The imported backend, dictionary and their tests match the pantry handoff byte-for-byte. All current product routes resolve through Expo; Next builds only API handlers and its framework-generated error fallback.

Validation: 124 backend/domain tests and 10 shared native component tests passed. Root/mobile TypeScript, Expo web export, iOS bundle export and the Next server build passed. In the in-app browser, the 56-recipe development library loaded; pantry coverage used the new backend; a keyboard checkbox updated pantry; merge preview/cancel, plain-name copying, shopping Clear/Undo and original ordering worked. Egg/flour pantry presence and milk/pepper shopping entries were restored after checks. Desktop at 1280px and phone browser at 390px fit without horizontal overflow. The transient large-eggs test identity remains absent from stock.

Local release routing returned Expo HTML for home, pantry, recipe edit, sign-in and unknown-screen links; missing API/bundle paths stayed 404, and an unauthenticated import-worker request returned 401. The native bundle/component checks do not constitute a new simulator interaction or physical-phone acceptance.
