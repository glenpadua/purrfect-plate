# Mobile foundation

Research, code inspection, and read-only Mac tool checks: 12 September 2026. This is a proposed implementation and setup guide. No mobile app has been created, no tools or dependencies installed, no Apple enrollment or purchase performed, and no phone validation completed.

**Recommendation: build an Expo + React Native app for iOS and Android, using the existing Clerk identity and Convex backend.** Build native screens around the current recipe/import contracts. Keep the Next.js web app running alongside it. This lets the two of you test the same shared library on web and phones while the mobile experience develops.

**First milestone: a clean, simple app installed on Glen’s and Millusha’s actual iPhones, connected to their existing shared library, usable when the Mac is switched off.** Start with Google/email login, browsing, pasting a recipe link, reviewing an import, saving, and editing. Defer animated cats, pantry tracking, calories, and elaborate cook mode. iPhone comes first; keep Android buildable and add emulator coverage before claiming Android support.

Expo provides native React Native apps and access to native modules/extensions. Use a development build for engineering and a standalone internal preview build for everyday testing. React Native itself recommends starting new apps with a framework such as Expo. [React Native setup](https://reactnative.dev/docs/environment-setup), [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)

**Recommended distribution: EAS internal preview builds for the two registered iPhones.** This avoids a public App Store listing and App Review. It still requires a paid Apple Developer Program membership for iOS signing. Expo’s build service and Apple’s signing membership are separate things; a free Expo plan does not remove Apple’s requirement. Details and free alternatives follow below. [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/)

## Foundation to reuse

The useful reuse is the backend, data contracts, assets, design tokens, and pure recipe helpers. The current Next.js, Radix/shadcn, CSS, Framer Motion, and browser image-compression components need native equivalents.

| Area | Current project | Mobile approach |
| --- | --- | --- |
| Identity and shared library | Clerk; `convex/access.ts`, `convex/libraries.ts` | Same Clerk application and library membership; Expo-specific provider and secure token storage |
| Recipe collection | `convex/recipes.ts`: `listPage`, `get`, `create`, `update`, `markCooked` | Call the same authenticated functions using Convex React hooks |
| Import | `convex/imports.ts`: `start`, `get`, `list`, `retry`, `save` | Native link entry and review screens; subscribe to the same durable jobs |
| Extraction and AI | Server code in `lib/recipe-import`, Python media service | Remain hosted; phone submits a link and can close while extraction runs |
| Photos | Server WebP compression, 350 KB storage limit | Keep the policy; add a mobile-compatible upload boundary |
| Presentation | Existing warm palette, cat art, recipe structure | Native navigation, lists, controls, readable typography and accessible defaults |

Convex explicitly supports its React client in React Native, and its Clerk provider works with Expo. No second recipe database or duplicate extraction implementation is needed. [Convex React Native](https://docs.convex.dev/client/react-native), [Convex and Clerk](https://docs.convex.dev/auth/clerk)

Start mobile in `apps/mobile` with its own Expo dependencies; leave the web app at the repository root initially. Export generated Convex API/types and small platform-independent helpers through an explicit shared package. Avoid importing Next/server modules into Metro. Only reorganize the whole repository when it has a concrete benefit. Expo supports pnpm workspaces, but dependency resolution needs verification. [Expo monorepos](https://docs.expo.dev/guides/monorepos/)

Use the current patched stable Expo SDK and its compatible dependency set. At research time this is SDK 57: React Native 0.86 and React 19.2.3, while this web app uses React 19.3.0. Do not force the web React version onto mobile or share a second React instance inside one runtime. SDK 57 currently requires Node 22.13.x or newer, Xcode 26.4 or newer for local iOS builds, and iOS 16.4 or newer. Recheck the stable matrix when implementation starts and verify both phones’ OS versions. [Expo version matrix](https://docs.expo.dev/versions/latest/)

## Maintainable codebase conventions

“Industry standards” means using supported platform tools and clear boundaries, not introducing a large architecture before there is a product. These are the proposed project conventions, rather than a claim that every mobile team uses one folder layout:

- **TypeScript and Expo Router.** Route files handle navigation and compose feature screens. Keep feature behavior outside route files. Use standard stacks/tabs, native back behavior, safe areas, keyboard handling, system text sizing and accessibility labels. Start with stable APIs and React Native controls; no custom navigation engine. [Expo Router conventions](https://docs.expo.dev/router/basics/notation/)
- **Feature folders:** `auth`, `library`, `recipe-detail`, and `recipe-import`; small shared `ui`, `config`, and device adapters. Each feature owns its screens, hooks and relevant tests. A screen can call a small feature hook around Convex; do not add generic repositories or duplicate all backend validation in mobile.
- **One source of server state:** Convex hooks supply recipes and import status; React state handles forms and temporary UI. Do not copy live server records into a second global store. Add a state library only for a demonstrated need.
- **Explicit platform boundaries:** pure recipe helpers and generated backend contracts can be shared. Native storage, photo picking, linking and sharing sit behind small adapters. Web components and server extraction modules stay out of the phone bundle.
- **Reproducible dependencies:** commit the lockfile, pin the chosen SDK, use `expo install` for compatible native libraries, and run Expo Doctor plus type checks in CI. Keep web/mobile React versions isolated within their own runtimes. [Expo package installation](https://docs.expo.dev/versions/latest/)
- **Generated native projects:** begin with Expo Continuous Native Generation. Put native settings in app config and config plugins, and keep custom extension source in version control. Avoid hand edits to generated Xcode/Gradle files that the next prebuild erases. If a future native requirement needs checked-in native projects, make that an explicit decision. [Expo native generation](https://docs.expo.dev/workflow/continuous-native-generation/)

Proposed shape, leaving the current web deployment in place:

```text
apps/mobile/
  src/app/                 # Thin Expo Router routes and root providers
  src/features/            # Auth, library, detail, import
  src/ui/                  # Small shared native controls
  src/lib/                 # Config and device adapters
  assets/
  plugins/                 # Native configuration only when required
  app.config.ts
  eas.json
packages/recipe-core/      # Pure helpers/contracts when actually shared
convex/                    # Existing authoritative backend
app/                       # Existing Next.js web app
```

The shared package must expose only intentional client-safe exports. Generated Convex references can be exposed through a narrow package entry point; server implementations, Node libraries and private configuration must not become transitive mobile dependencies. The exact workspace setup should be proved by building both apps before reorganizing more files. [Expo monorepos](https://docs.expo.dev/guides/monorepos/)

## Authentication and storage

**Clerk is suitable for this mobile app.** It has an official Expo SDK, `@clerk/expo`, supporting hosted authentication, prebuilt native components, and custom flows. Use its standard hosted browser authentication for the first slice, with the existing Google and email-code methods; it is the quickest way to avoid maintaining a custom login flow. Native prebuilt UI is a supported later refinement. Enable Clerk’s Native API and configure each app variant’s bundle/package identifiers and callback URLs through its documented setup. [Clerk Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart)

Both login methods should reach the same Clerk identity when account linking requirements are met. Keep membership attached to Clerk’s user ID; do not treat a client-provided email as authorization. Test Google-first and email-first login with the same verified address. Glen and Millusha remain separate users in one Convex library. [Clerk account linking](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/account-linking)

Connect `ClerkProvider` to `ConvexProviderWithClerk` using Clerk’s hook. Convex validates the token and enforces membership on every protected query/mutation. Navigation guards improve the experience but cannot replace backend authorization. Existing verified-email invitations remain the private-pilot entry point. [Convex Clerk integration](https://docs.convex.dev/auth/clerk)

For sessions, use Clerk’s built-in `tokenCache` from `@clerk/expo/token-cache`, backed by `expo-secure-store`. Let the SDK handle token refresh, expiry and sign-out; do not build a separate token system. Handle returning from Google, cancelling login, expired sessions and reopening the app after several days. Native Google sign-in requires a development build and additional platform credentials; it is optional for the initial hosted-browser flow. [Expo Clerk guide](https://docs.expo.dev/guides/using-clerk/), [Clerk native Google sign-in](https://clerk.com/docs/reference/expo/native-hooks/use-sign-in-with-google)

| Data | Proposed home | Rule |
| --- | --- | --- |
| Session credentials | Clerk secure token cache | SecureStore uses iOS Keychain and Android Keystore-backed encryption; never ordinary preferences, SQLite or logs |
| Recipes, membership, import jobs | Convex | Authoritative shared state; enforce access on the server |
| Cover photos | Convex file storage | Retain server WebP compression and the 350 KB cap; do not retain extracted videos or all frames |
| Small non-secret preferences | AsyncStorage, only if needed | Theme, dismissed hints; not credentials |
| Unsaved form state | React state initially | Add a local draft only where losing it would hurt |
| Pending shared links / offline recipes | SQLite when those features arrive | Scope records to the account/library, clear private cached data on sign-out, and define replay/deduplication explicitly |
| Display image cache | Bounded device cache | Evictable copies; never the only copy of a recipe photo |

SecureStore data can persist through an iOS reinstall, so uninstalling is not a reliable sign-out/reset mechanism. Explicitly test sign-out and account switching. SecureStore is for small sensitive values, not the recipe database. [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)

The app bundle is inspectable. Only public configuration belongs in `EXPO_PUBLIC_*`: the Clerk publishable key and appropriate Convex URL. OpenAI, Clerk secret keys, import-worker secrets and admin/deploy credentials stay on servers or trusted CI. A variable marked secret in a build dashboard is still exposed if embedded in client code. [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)

Use clearly named development and preview variants with separate app identifiers and auth callbacks. Development should use test backend data; the two-person preview intentionally uses the shared hosted library after basic validation. Confirm the Clerk instance and Convex issuer match each environment. A signed preview build is not proof that production Clerk configuration or public onboarding is complete.

Convex’s live synchronization should not be described as persistent offline support. V1 can show an honest offline state and resume jobs after reconnection. Explicit downloads, local edits and conflict handling are separate work. [Convex React Native client](https://docs.convex.dev/client/react-native), [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)

Before public iOS release, plan an equivalent privacy-preserving login option alongside Google, usually Sign in with Apple, and in-app account deletion. Apple private-relay addresses need a deliberate household-invitation/linking flow; they will not match the current Gmail allowlist automatically. Also decide what deleting one member means for jointly owned recipes. These are later release requirements, not prerequisites for the first ad hoc test. [Apple App Review Guidelines, 4.8 and 5.1.1](https://developer.apple.com/app-store/review/guidelines/)

## How the app gets onto your iPhones

A **build** is the installed native app. **Signing** is Apple’s permission for that build to run on particular devices or through a distribution channel. The public App Store is only one distribution channel.

| Option | What you install | Apple membership / review | Mac needed while using it? | Role here |
| --- | --- | --- | --- | --- |
| Expo Go | Expo’s existing App Store app; scan the project QR | No paid developer membership for this experiment | Normally yes, for the local development server | Optional quick learning exercise; cannot validate our custom native share extension |
| Local Xcode Personal Team | Your own app, installed from Xcode | Free Apple Account; short-lived provisioning, no public review | Needed to build/install and periodically re-sign; dev workflow normally uses Metro | Temporary personal experiment, inconvenient for a two-person ongoing pilot |
| Development build | Our app plus developer tools | Paid membership for the normal EAS iPhone route; local Personal Team alternative above | Usually yes during live coding; can also load a compatible published update | Glen’s engineering/debugging app |
| **Internal preview / ad hoc** | **Standalone Purrfect Plate from a private install link** | **Paid membership; registered devices; no App Review or store listing** | **No** | **Recommended first shared test app** |
| Internal TestFlight | Our beta inside Apple’s TestFlight app | Paid membership and App Store Connect setup; internal testers must be eligible App Store Connect users; no beta review for internal testing | No | Convenient later for the two project owners |
| External TestFlight | Our beta inside TestFlight | Paid membership; external beta review applies, especially the initial build | No | Later testing with friends/customers without granting project access |

Expo Go has a fixed native runtime, whereas development builds can include our native modules. A development build’s live-reload server is called **Metro**; scanning its QR connects the installed app to that server. It is a different QR flow from downloading a standalone preview binary. Native-library/configuration changes require rebuilding the development app; ordinary JavaScript changes can reload quickly. [Expo environment choices](https://docs.expo.dev/get-started/set-up-your-environment/), [sharing development builds](https://docs.expo.dev/develop/development-builds/share-with-your-team/)

Apple’s free Personal Team permits up to 10 App IDs, 3 devices, and 3 apps per device, with seven-day expiry/reprovisioning restrictions. It does not provide EAS ad hoc distribution or TestFlight. This makes it useful for learning on a connected phone, but a poor default for Millusha’s daily testing. [Apple Personal Team limitations](https://developer.apple.com/help/account/basics/about-your-developer-account)

Apple Developer Program enrollment is **US$99 per membership year, or the available local-currency price**. One enrolled developer/team can distribute this app to both registered phones; both testers do not need separate paid memberships. Enrollment requires account/identity steps and can take time. Decide individual versus organization ownership before enrolling; individual enrollment uses the person’s legal name as the eventual App Store seller. No enrollment or payment has been started. [Apple membership](https://developer.apple.com/programs/), [Apple enrollment](https://developer.apple.com/programs/enroll/)

For ad hoc distribution, Apple allows up to 100 iPhones per membership year. The provisioning profile contains a device allowlist. Register both phones before building; a newly registered phone cannot install an old build whose profile excludes it. Rebuild with an updated profile or use EAS re-signing. Profiles/certificates expire, so record their expiry and renew/reissue builds as needed. EAS internal distribution does not mean joining Apple’s Enterprise Program. [Expo ad hoc signing](https://docs.expo.dev/build/internal-distribution/), [EAS re-signing](https://docs.expo.dev/develop/development-builds/share-with-your-team/)

TestFlight uses App Store Connect without making the app publicly listed. Apple supports up to 100 eligible internal users and 10,000 external testers; each build expires after 90 days. Internal testers have project access, so do not give that access to ordinary customers just to avoid external beta review. [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/), [Expo TestFlight workflow](https://docs.expo.dev/submit/testflight/), [internal testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-internal-testers/), [external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)

### First installation, step by step

1. Create the Expo project/account configuration and choose stable identifiers for development and preview. Confirm Apple membership, both phone OS versions, and backend/auth environment before building.
2. Run EAS device registration and give each of you its registration link/QR. Open it on the corresponding iPhone in Safari, follow Apple’s profile/device-registration prompts, and confirm both device IDs (UDIDs) are listed. This registers hardware; it does not grant recipe-library access.
3. Build the iOS `preview` profile with internal distribution and an embedded JavaScript bundle. Keep the development client disabled in this profile.
4. Open the resulting EAS install link on each registered iPhone, tap Install and follow the device prompts. If iOS requests Developer Mode, enable it in Privacy & Security and complete the required restart/confirmation. Only follow prompts for our identified build/profile.
5. Open Purrfect Plate from the home screen and sign in with Google or the email code. Millusha needs no terminal, Mac, Xcode or development server to use this preview.
6. Switch the Mac off and test over cellular data. The app must still open and contact hosted Clerk, Convex and the import service. Internet is still required for online data/imports until offline support is implemented.

The normal EAS commands for the implementation task are `eas device:create` and `eas build --platform ios --profile preview`; these are documented here, not executed. The install page also offers a QR/download flow. [Expo internal-build tutorial](https://docs.expo.dev/tutorial/eas/internal-distribution-builds/), [Expo iOS Developer Mode](https://docs.expo.dev/guides/ios-developer-mode/)

## Mac setup: what exists and what to add

Read-only checks on 12 September 2026 found:

| Check | Verified result | Meaning |
| --- | --- | --- |
| Node / pnpm | Available; Node executable under mise `24.14.0` | Existing JavaScript tooling can be reused, subject to SDK validation |
| Selected Apple tools | `/Library/Developer/CommandLineTools` | Command Line Tools are installed, but this is not full Xcode |
| Xcode | No `/Applications/Xcode.app`; `xcrun simctl` unavailable | No usable iOS Simulator was found through the selected developer tools |
| Android Studio | No `/Applications/Android Studio.app`; `adb` absent from PATH | Standard Android setup is not ready |
| EAS CLI / Watchman | Neither found on PATH | EAS can be project-pinned or invoked through the package runner; SDK 57 does not require Watchman |

This was a limited standard-location/PATH check, not a scan of every directory or an Apple/Expo account audit. No tools were installed and no developer setting changed.

**Now, for iPhone development:** install full Xcode from the Mac App Store, open it once, complete license/component installation, select its Command Line Tools in Xcode Settings → Locations, and download an iOS Simulator runtime under Components. Check that the chosen Xcode version supports the Mac’s macOS and the Expo SDK. Full Xcode is required to run the iOS Simulator and build iOS locally; the smaller command-line-tools package alone is insufficient. A paid Apple membership is not needed merely to run the simulator. [Expo iOS Simulator setup](https://docs.expo.dev/workflow/ios-simulator/), [Expo simulator builds](https://docs.expo.dev/build-reference/simulators/)

Use the normal project editor for TypeScript. The Simulator is a separate Mac window showing a virtual iPhone; Expo CLI can open it with `i`. After creating/installing our development build, Metro provides fast reload while coding. Pair Glen’s actual iPhone with the Mac when local device debugging is needed; trust the computer and enable Developer Mode as prompted. CocoaPods and other native build prerequisites should be installed/validated as part of the selected local-build workflow. [Expo local development](https://docs.expo.dev/guides/local-app-development/)

An iOS simulator build is **not installable on an actual iPhone**, and a simulator pass does not prove camera access, Google redirects, native sharing or lifecycle behavior on a phone. Use the simulator for fast navigation, layout and error-state checks; use both real iPhones for acceptance. [Expo simulator build targets](https://docs.expo.dev/build-reference/simulators/)

**Later, for Android:** install Android Studio, its SDK/platform tools and Emulator, plus the JDK required by the selected Expo build instructions. Configure the SDK location/PATH and verify `adb`. Create a virtual Pixel device in Device Manager using a compatible system image—prefer one with Google Play services when checking Google login. Match the image architecture to the Mac. Launch it and use Expo’s `a` shortcut or install our Android development APK. No Android phone or Google Play developer account is needed for this emulator work. [Expo Android setup](https://docs.expo.dev/workflow/android-studio-emulator/), [Android virtual devices](https://developer.android.com/studio/run/managing-avds)

Android internal preview builds use an installable APK; an AAB is intended for Play distribution. A later borrowed real Android device should check sharing, photo permissions and background behavior before an Android release. Emulator-only results should remain labeled that way. [Expo APK builds](https://docs.expo.dev/build-reference/apk/)

### EAS cloud builds versus building on this Mac

Start with **local Metro plus EAS cloud builds** for installable development/preview binaries. Expo hosts the build machines and can manage signing, reducing the initial native-tool burden. Full Xcode can be installed alongside this for the simulator and native debugging; it is not required on the local Mac simply to request an EAS cloud iPhone build. [EAS Build](https://docs.expo.dev/build/introduction/)

Expo’s current Free plan includes up to **15 iOS and 15 Android builds per month**, with a low-priority queue. Start there; native dependencies do not change with every screen edit, so rebuilding on every save would waste the allowance. Recheck quotas and queue needs before choosing a paid plan. Apple membership, backend/AI usage and optional Expo paid usage are separate costs. [Expo pricing](https://expo.dev/pricing)

Local Xcode builds avoid cloud build quotas and are useful for rapid native debugging, but require the complete local toolchain and use the Mac’s time/disk. EAS can also run supported builds locally with `--local`; this does not remove Apple signing rules. Neither approach requires the Mac to remain on after a standalone preview is installed. [Expo local build overview](https://docs.expo.dev/guides/local-app-overview/), [local EAS builds](https://docs.expo.dev/build-reference/local-builds/)

Later, use EAS Update for compatible JavaScript/assets changes. Native modules, extensions, entitlements or incompatible native configuration need a new binary. Keep preview and production channels separate, use a runtime-version policy, and prove rollback before automating updates. The Vercel Git integration deploys the web and media projects from `main`; Convex function deployment remains a separate step until explicitly included in CI. Neither automatically installs a new iPhone binary. Mobile CI is a separate pipeline. [Expo runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/)

## Recipe sharing: early follow-up, not a blocker for first installation

The desired experience remains **Instagram/TikTok/YouTube/Safari → Share → Purrfect Plate → import inbox → review → save**. Prove it in a bounded spike after the initial paste-link loop works. Do not delay the first usable two-phone build for polished extensions. A share generally supplies a URL/text, not the source app’s login, cookies, transcript or video; mobile alone does not resolve hosted YouTube retrieval restrictions.

Android receives URLs/text through native share intents. Handle cold and warm launch, preserve the pending link across login, and process it once. [Android receiving shared data](https://developer.android.com/develop/ui/compose/sharing/receive)

On iOS, plan a genuine Share extension. Current `expo-sharing` incoming-share support is experimental; Expo warns that its iOS approach opens the main app using behavior Apple does not officially support. Do not base release behavior on that shortcut. Expo Go cannot test our custom extension. [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/)

Start with an extension that puts the pending link in an App Group container and confirms “Saved on this phone; open Purrfect Plate to import.” The authenticated app drains this inbox. A later one-tap version must separately prove secure authenticated submission/token handling across extension and app. Keep extraction on the server, outside the extension’s short lifetime. [Apple Share extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html), [Apple shared containers](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionScenarios.html)

Expo supports extension targets and signing. Evaluate the community `expo-share-extension` only against the selected SDK and real phones; its compatibility table previously stopped at SDK 54. If unsuitable, a small Swift extension with a config plugin is a contained native component. [Expo app extensions](https://docs.expo.dev/build-reference/app-extensions/), [extension source and compatibility](https://github.com/MaxAst/expo-share-extension)

## Existing backend gaps to close during implementation

These are code-inspection findings from this planning session, not claims that hosted behavior has passed mobile testing. Recheck the implementation before changing it because web work continues in parallel.

1. **Mobile photo upload:** adapt the browser-oriented upload endpoint to a bearer-authenticated mobile flow; preserve server compression, 350 KB validation and ownership. No worker secret goes into the app.
2. **Shared link formats:** safely resolve TikTok short links (`vm.tiktok.com` / `vt.tiktok.com`) and parse URLs out of shared text before canonical deduplication. Inspect current source normalization before implementing twice.
3. **Durable receipt:** jobs survive closing the app after the server accepts `imports.start`. The earlier offline/signed-out window needs a local pending-link record and idempotent draining. “Saved locally” and “Import started” are distinct states.
4. **Stable contracts:** use paginated recipe queries. Installed apps lag backend releases, so keep fields backward-compatible and give errors stable codes. Retain source evidence/warnings when users edit extracted recipes.
5. **Cooking progress:** stable ingredient/step IDs and an explicit cooking session will be needed for saved progress. Retried/offline `markCooked` operations need idempotent IDs to avoid double counting.
6. **Public onboarding:** two-person invitations are the pilot model. Public households, account deletion and production native auth credentials belong to a later release stage.

## Delivery sequence and acceptance

| Stage | Reviewable result | Rough engineering effort |
| --- | --- | --- |
| 1. Setup and auth shell | Supported workspace/SDK, simulator build, development app on Glen’s iPhone, Google/email login and the shared library | 1–3 days after accounts/tools are available |
| 2. First two-phone preview | Browse/detail, paste link, durable import status, editable review, save/edit; installed standalone on both iPhones | Another 3–5 days, assuming hosted extraction is working |
| 3. Share spike | Actual iOS source-app shares, cold/warm launch, signed-out/offline receipt, duplicate handling | Another 2–5 days; extension compatibility may extend this |
| 4. Android verification | Installable Android build and emulator checks for auth, navigation, import and sharing | Another 1–3 days; real hardware remains a release check |

These are planning estimates, not promised calendar dates. Allow roughly **one to two engineering weeks for the first useful two-iPhone pilot**, with Apple enrollment, downloads, signing and third-party extraction failures as separate uncertainties. Fancy cat interactions are outside these estimates.

Use type checks/lint and focused unit tests for normalization/deduplication. Use React Native Testing Library for form/review behavior and mobile end-to-end smoke tests for the main navigation/auth/import loop. Native integration and external login still require device checks; passing JavaScript tests cannot establish those. [React Native testing](https://reactnative.dev/docs/testing-overview)

Record build ID/commit, device model, OS, login method and result for each acceptance run:

- [ ] Both actual iPhones install the same identified preview and open it without Metro or the Mac running.
- [ ] Glen signs in with Google and Millusha with email; both see the same library. Repeat with the methods swapped and verify no extra account/library is created.
- [ ] Cancelling login, wrong/expired email codes, session expiry, sign-out and reopening produce understandable states; uninvited users cannot access recipes.
- [ ] Paste real Instagram, TikTok, YouTube and website samples; review evidence gaps honestly, save, reopen and edit. Distinguish extraction failure from a mobile defect.
- [ ] One phone saves/edits and the other phone/web sees the same result.
- [ ] Close/force-quit the app during an accepted import; reopen and recover progress/result. Repeat a link and retry a failed job without duplicate recipes or double saves.
- [ ] Lose connectivity and recover without losing a review draft or claiming an unsent request succeeded.
- [ ] Photo selection/cancellation/permission denial works; optimized storage remains within policy and placeholders are readable.
- [ ] Large system text, keyboard, safe areas, loading/error states and back navigation work on both phones.
- [ ] For the share milestone: share from the actual source apps into our installed extension, signed in/out, cold/warm/offline, and confirm each link is handled once.
- [ ] For Android: record emulator model/API/image, test Google/email, system back, keyboard and import; label physical Android verification as pending until performed.

After this pilot, add a simple cook mode, then optional offline downloads. Pantry matching and calorie estimates require structured quantities/units and user correction. Cat animation, Rive/Skia experiments and elaborate delight can follow demonstrated utility; the initial visual scope is a clear, accessible interface with the existing identity carried through lightly.
