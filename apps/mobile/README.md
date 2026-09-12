# Purrfect Plate universal product UI

This Expo Router application targets iOS, Android and web. `apps/mobile` is the historical directory name. Product screens, Outfit typography, cards, controls and responsive navigation are one implementation, rendered in browsers by React Native Web. Only authentication, photo processing and source embeds have platform adapters.

```bash
# From the repository root:
pnpm product:web
# Browser: http://127.0.0.1:8082
xcrun simctl openurl booted exp://127.0.0.1:8082
```

The repository has one product frontend: this application. Root Next.js hosts server APIs and this application's static web export only. See [how the app works](../../docs/how-the-app-works.md) and [current verification and next steps](../../docs/mobile-plan.md).

Expo SDK 57 / React Native 0.86.3. Use Node 24 and pnpm 10 from the root; do not create another lockfile or install with npm inside this directory.

## Run

Copy the public configuration names from `public-config.example` into an ignored `.env.local`. Use the matching Clerk instance and development Convex URL. Never put server or provider secrets here.

```bash
pnpm install --frozen-lockfile
pnpm mobile:ios
```

Xcode must have completed first-launch setup and have an iOS runtime installed. Expo Go is already installed on this Mac's iPhone 17 Pro simulator. On a new Mac, install it once with `pnpm --filter @purrfect-plate/mobile exec expo start --ios --localhost`. The restart command then uses `simctl` directly, so an Apple Events window-activation error cannot take down Metro. The start scripts pin IPv4 DNS order because Expo opens `127.0.0.1` and Node on this Mac otherwise binds `localhost` to IPv6 only. Metro must remain running for this development app.

## Checks

```bash
pnpm mobile:typecheck
pnpm --filter @purrfect-plate/mobile test
pnpm --filter @purrfect-plate/mobile export:ios
pnpm --dir apps/mobile dlx expo-doctor
pnpm test:run
pnpm build
```

Jest exercises native controls and the editor's submitted content. The root Vitest suite exercises real authenticated Convex interfaces. Neither proves native login, photo picking, source playback, keyboard layout or lifecycle behavior. Record simulator and phone checks in `docs/mobile-plan.md`.

## Ownership

- `src/app`: routes and provider/navigation composition only.
- `src/features/*/data.ts`: Convex bindings. Backend functions still authorize membership.
- `src/features`: shared web/native screens and UI state; forms retain untouched source lines.
- `src/ui`: shared controls and responsive layout.
- `src/lib/recipe-photo.ts`: device picker/encoder adapter; shared policy and Convex ownership checks still apply.
- `packages/recipe-core`: intentional pure exports, generated API/type references and shared palette. No server extraction code is bundled.

`packages/recipe-core/palette.json` is the shared colour source. Both web and native read it directly; no separate CSS generation is needed. The palette preserves the web's established warm OKLCH colours as portable sRGB values.

Development uses `basic-poodle-462`, including its existing private shared library. The hosted shared web app at https://purrfect-plate-theta.vercel.app uses production `spotted-gazelle-950`; root `pnpm build` supplies its public configuration and exports this UI into the Next deployment. Physical iPhone distribution remains separate. Never embed backend/provider credentials or enable an authentication bypass for testing.

Imports need the authenticated development worker and its approved tunnel running as documented in `docs/mobile-plan.md`. The earlier temporary tunnel has expired; a replacement needs approval. Durable server jobs do not imply offline client storage. Source viewing uses shared load/hide controls with native WebView and browser embed adapters, plus an original-source fallback. Provider playback needs separate acceptance. Share extensions, downloaded recipes and persisted cooking progress are later features.
