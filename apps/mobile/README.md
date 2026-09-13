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

Follow the root [development setup](../../README.md#development) for installation, `apps/mobile/.env.local`, backend sync and imports. The example file in this directory contains public client variables only. `public-config.example` retains the same names for older setup references.

```bash
pnpm install --frozen-lockfile
pnpm mobile:ios
```

## iOS simulator

Xcode must have completed first-launch setup and have an iOS runtime installed. Check the available devices with `xcrun simctl list devices booted`; the previous iPhone 17 Pro simulator run is historical evidence, not a guarantee of the current Mac state. If Expo Go is missing, install it with `pnpm --filter @purrfect-plate/mobile exec expo start --ios --localhost`. The `mobile:ios` helper uses `simctl` directly so an Apple Events window-activation error cannot take down Metro. It defaults to port 8081; the commands above reuse the product web server on 8082. The start scripts pin IPv4 DNS order because Expo opens `127.0.0.1`. Metro must remain running for this development app.

## Checks

Use [Development workflow](../../docs/development.md#focused-checks) for focused Jest tests, types, native bundle validation and the full CI checks. For an Expo dependency/runtime mismatch, also run `pnpm --dir apps/mobile dlx expo-doctor`.

Jest exercises native controls and the editor's submitted content. The root Vitest suite exercises real authenticated Convex interfaces. Neither proves native login, photo picking, source playback, keyboard layout or lifecycle behavior. Record simulator and phone checks in `docs/mobile-plan.md`.

## Ownership

Use [UI instructions](AGENTS.md) for module boundaries and the root [feature map](../../AGENTS.md#find-the-change) for specific screens. The [cooking contract](../../docs/cooking.md) explains how forms preserve source lines; the [image lifecycle](../../docs/architecture.md#image-lifecycle) covers photo encoding and ownership.

Development uses `basic-poodle-462`, including its existing private shared library. The hosted shared web app at https://purrfect-plate-theta.vercel.app uses production `spotted-gazelle-950`; root `pnpm build` supplies its public configuration and exports this UI into the Next deployment. Physical iPhone distribution remains separate. Never embed backend/provider credentials or enable an authentication bypass for testing.

For imports, run the outbound development worker from the root [setup guide](../../README.md#start-local-development); it needs no public tunnel. Durable server jobs do not imply offline client storage. Source viewing uses shared load/hide controls with native WebView and browser embed adapters, plus an original-source fallback. Provider playback needs separate acceptance. Share extensions, downloaded recipes and persisted cooking step progress are later features; portion/unit preferences already persist per user and recipe.
