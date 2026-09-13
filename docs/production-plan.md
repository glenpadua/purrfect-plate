# Hosted recipe library: release and acceptance

**Current architecture:** Expo is the only product UI for web and mobile. Next.js is server-only. The older acceptance entries below record the earlier UI and do not describe current pantry semantics; see [the current pantry contract](pantry.md), [mobile record](mobile-plan.md), and [architecture guide](how-the-app-works.md).


Last reconciled: 12 September 2026. The hosted app is [Purrfect Plate](https://purrfect-plate-theta.vercel.app). This document separates verified production behavior from work awaiting release or acceptance. It is the release checklist, not a chronological build log.

## Architecture and deployment

Vercel hosts the Next.js app and a private Python media worker. Production Convex owns recipes, durable import jobs, library membership, pantry and shopping state. Clerk supplies individual sign-ins into one shared library for Glen and Millusha. The shared Expo web/native client uses the authenticated Convex functions and server-side importer.

Both Vercel projects auto-deploy from the existing `main` branch. Commit `993c94d` produced a ready web deployment; its media deployment exposed an overbroad root ignore rule. Commit `a53d103` fixed that rule and produced a ready Git-triggered media deployment. Convex deployment remains a separate step: deploy additive schema/functions before a web release that depends on them.

Clerk app `app_3JDinlimgp4znmD68XP5Y1dInNs` uses the temporary-domain development instance for this private pilot. Approved addresses are configured privately; do not put credentials or environment values in documentation. See [architecture](architecture.md) for module contracts and launch constraints, and [mobile plan](mobile-plan.md) for iPhone distribution and setup.

## Verified production behavior

| Area | Evidence and practical limit |
| --- | --- |
| Sign-in and library access | Google sign-in reached the hosted shared library. Automated tests cover signed-out rejection, verified invite claims and cross-library isolation. Actual email-code sign-in and Millusha's join remain open. |
| Legacy data | All 53 original manual recipes and their optimized images were migrated additively. There are now 57 recipes, including four saved imports. No destructive replacement migration was used. |
| Instagram | `DdJyDKhKk1i` passed hosted import → review → save → note edit. `/reel/` and `/p/` aliases with tracking parameters reused the same saved job/recipe. |
| TikTok | `7351594254663159083` passed hosted retrieval and review. A normalization problem was repaired on its unsaved draft using retained source evidence, then UI save and a fresh reload passed: 12 ingredients and eight steps. This is not proof of a fresh run through the corrected normalizer. Its loaded Convex cover is a 46,840-byte WebP at 640 × 1138. |
| YouTube CrunchWrap | A fresh hosted import produced ten ingredient lines and eight steps, then review/save passed. Recipe ID: `js7br0ycrz5cndmfvz75375hkn8e8ayy`. Source attribution and missing-detail warnings remain. |
| YouTube wrapping tutorial | An initial test incorrectly accepted a standalone skill as a recipe. The user corrected this; the test recipe was removed with approval. Its retained job `j978q7s7s27nkt8eczxzf17bds8e8gp9` was rechecked and rejected as `not_recipe` by the inexpensive preflight, before video analysis. The UI explains that it is a technique rather than a recipe. |
| Recipe website | Greek chicken job `j976vr36axx9gfct1v8hffxx2d8e934a` was re-extracted, reviewed, saved and freshly reloaded with 15 ingredients, nine steps, three groups and 14 note paragraphs. Recipe: `js74wyxfsx3xpe2pka41qpj3vn8e8hka`. Publisher JSON-LD bypassed AI. A five-to-ten serving change doubled clear ingredient amounts while preserving originals. |
| Pantry and shopping | Hosted recipe Have it → Need it → shopping list → Bought passed. Copy produced `☐ olive oil` in the clipboard; manual-copy fallback remains visible. Test entries were cleaned up. Shared access and isolation are covered by authenticated tests; two physical phones remain unverified. |
| Inline sources and layout | YouTube, Instagram and TikTok players loaded and playback progressed in the hosted browser. Imported detail headers no longer enlarge social thumbnails. The supplied Instagram recipe and cooking controls were visually checked at 390px width; this is browser viewport evidence, not a physical iPhone test. |
| Silent biryani | Returned **Not enough recipe details**, with an editable alternative-recipe search. Unverified visual spice guesses did not become ingredients. No recipe was saved. |
| Cooking tools | Session-only cook mode, ingredient checklists and conservative metric/US display are deployed. Hosted browser checks passed start/next/exit and metric display on the saved TikTok recipe. Serving behavior is covered through the cooking interface; physical iPhone acceptance remains open. |
| Minimal tags | Cleanup changed 12 of the then-55 recipes, retained every recipe, and capped tags at three. Canonical dish tags group biryani and mac and cheese without merging recipes. |
| Import safeguards | Durable jobs, canonical deduplication, bounded processing, early relevance checks, explicit overrides and source-preserving review are implemented. Negative outcomes remain distinct from saved recipes. See [guardrails](import-guardrails.md). |

The selected YouTube fallback is Gemini's official public-video input. Hosted cloud access is now proven for the supplied videos; native yt-dlp/caption retrieval remains blocked on the observed Vercel network. Provider access does not imply complete recipe evidence. See [YouTube retrieval](youtube-retrieval.md) for costs, model choice, provenance and historical experiments.

## Required release verification

Always perform these checks before reporting a release complete:

1. Deploy changed Convex functions/schema separately and retain the successful production completion output. The expected deployment is `spotted-gazelle-950`; a Vercel build or a Git push does not deploy it.
2. Run `pnpm verify:production:convex` after every release, even when no backend changes were expected. This read-only command obtains the live production API contract, checks the production URL and required pantry/import functions, and rejects the obsolete pantry API. It does not prove implementation identity or replace hosted behavior checks; update the required contract as features evolve.
3. Wait for GitHub CI to finish on the **exact pushed commit** and inspect failing steps. CI checks backend/domain tests, root and Expo types, shared native UI tests, Python media tests and the full web/server build. It currently does not deploy Convex.
4. Inspect the Vercel deployment for that commit and confirm the public production alias points to a Ready deployment. Check the media project too when it changes.
5. Exercise the affected feature while signed in on the hosted app, and confirm the web bundle targets production Convex. Report any unverified behavior explicitly.

## Current consolidation release

Expo is now the sole product UI. The original pantry work is preserved in Git history and ported to the shared UI. Production Convex independently returned the new pantry API and `imports.setDismissed` on 12 September 2026. The latest initial CI run (`ed9a627`) failed because clean installs could not resolve the undeclared `vite/client` test types, despite Vercel and the earlier manual Convex deployment succeeding. The correction declares Vite directly and adds shared Expo checks to CI; release completion requires a successful replacement run.

## Earlier release evidence

The pantry, inline sources, compact headers, layout fixes and guardrail correction are deployed. Main commit `4caa144` passed CI and produced the ready web deployment `purrfect-plate-j0lvv4fsg-glen-paduas-projects.vercel.app`, aliased to the hosted app. The pantry uses presence rather than quantities; photo/voice capture is proposed future work. See [pantry](pantry.md).

Insufficient-evidence failures retain bounded evidence, provider usage, warnings and citations. The biryani recheck remained insufficient and retained 17 evidence entries in a 7,129-character audit, including Gemini and normalization usage. No visual guesses became a recipe. Historical missing data was not reconstructed; this is a new observed attempt.

Unsaved drafts can now explicitly re-extract their source, replacing the draft under a last-update check without creating a duplicate job or overwriting a saved recipe. The Greek chicken acceptance above exercised that operation. Replaced unsaved covers are removed from storage.

The feature code and tests are organized around authenticated data operations, extraction and cooking interfaces. The latest verification passed 100 TypeScript tests across 19 files, nine Python tests, TypeScript checking, a local Webpack production build and hosted CI/Turbopack build. Live AI checks rejected the actual tutorial narration and accepted partial genuine recipe evidence.

## Remaining acceptance and launch work

- Confirm actual email-code sign-in and Millusha's join into the same library.
- Test both actual iPhones. Desktop browser or emulator results are not physical-device evidence.
- Broaden fresh TikTok normalization coverage without a draft repair.
- Broaden unavailable-source and platform coverage; current YouTube and embed success is sample-specific.
- Verify development imports with the outbound local worker and synced development backend described in [the setup guide](../README.md#start-local-development). The implementation replaces the earlier misconfigured hosted-worker/tunnel path; this release record does not establish a fresh local import acceptance.
- Address the launch constraints recorded in architecture.md: library pagination, orphaned-image cleanup, dependency advisories, production Clerk setup and wider operational monitoring.
- Complete physical-device Expo acceptance; photo/voice pantry updates remain future work.

The completion bar remains end-to-end behavior: correct source evidence, reviewable gaps, authenticated persistence and a successful fresh reload. A ready deployment, an HTTP 200, a passing unit test, or a local download alone does not establish that a hosted recipe import works.
