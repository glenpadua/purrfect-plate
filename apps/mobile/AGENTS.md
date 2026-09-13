# Universal UI instructions

This directory also owns the web product. Apply the root [AGENTS.md](../../AGENTS.md) and keep Expo Router files in `src/app` thin: feature screens/state belong in `src/features`, Convex bindings in each feature's `data.ts`, and reusable controls/layout in `src/ui`.

- Share product behavior across web/native; use `.web.tsx` adapters for real platform differences such as auth, photo selection, sharing and source players.
- Import pure domain helpers from `@purrfect-plate/recipe-core`, API/type references from its `/api` entry, and theme values from its `/theme` entry. `packages/recipe-core/palette.json` owns shared colors. Keep server/provider code outside Metro.
- Test controls through adjacent `*.native.test.tsx` files; [focused commands](../../docs/development.md#focused-checks) explain Jest/Vitest selection. Web adapters and responsive layout require browser checks; native permissions/lifecycle require a simulator or device.
- For simulator setup, read [README](README.md#ios-simulator). For distribution or platform acceptance, read [the mobile record](../../docs/mobile-plan.md#remaining-acceptance).

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.
