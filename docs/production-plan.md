# Hosted recipe library: release and acceptance

Last reconciled: 12 September 2026. The hosted app is [Purrfect Plate](https://purrfect-plate-theta.vercel.app). This document separates verified production behavior from work awaiting release or acceptance. It is the release checklist, not a chronological build log.

## Architecture and deployment

Vercel hosts the Next.js app and a private Python media worker. Production Convex owns recipes, durable import jobs, library membership, pantry and shopping state. Clerk supplies individual sign-ins into one shared library for Glen and Millusha. The future mobile client will reuse the authenticated Convex functions and server-side importer.

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
| YouTube wrapping tutorial | A fresh hosted import produced two generic ingredient lines and six wrapping steps. Saved as **How to wrap a burrito**, ID `js700gnh5j86y8zyb126a4fwfh8e9rca`. Unspecified fillings and amounts remain flagged. |
| Silent biryani | Returned **Not enough recipe details**, with an editable alternative-recipe search. Unverified visual spice guesses did not become ingredients. No recipe was saved. |
| Cooking tools | Session-only cook mode, ingredient checklists and conservative metric/US display are deployed. Hosted browser checks passed start/next/exit and metric display on the saved TikTok recipe. Serving behavior is covered through the cooking interface; physical iPhone acceptance remains open. |
| Minimal tags | Cleanup changed 12 of the then-55 recipes, retained every recipe, and capped tags at three. Canonical dish tags group biryani and mac and cheese without merging recipes. |
| Import safeguards | Durable jobs, canonical deduplication, bounded processing, early relevance checks, explicit overrides and source-preserving review are implemented. Negative outcomes remain distinct from saved recipes. See [guardrails](import-guardrails.md). |

The selected YouTube fallback is Gemini's official public-video input. Hosted cloud access is now proven for the supplied videos; native yt-dlp/caption retrieval remains blocked on the observed Vercel network. Provider access does not imply complete recipe evidence. See [YouTube retrieval](youtube-retrieval.md) for costs, model choice, provenance and historical experiments.

## Implemented, awaiting the final web release or acceptance

The additive pantry schema/functions are deployed to production Convex. The simple pantry/shopping UI, inline source playback and compact imported-recipe headers await the final web release and hosted checks. The pantry uses presence rather than quantities; photo/voice capture is proposed future work. See [pantry](pantry.md).

Insufficient-evidence failures now retain bounded evidence, provider usage, warnings and citations in the worker's failure audit. Extraction-interface tests cover both no-readable-evidence and normalized-empty outcomes. The observed biryani failure predates this fix and has no retained failure audit; historical data is not retroactively reconstructed. Verify the new failure audit after the web release.

Publisher ingredient groups and notes are implemented. A parser replay of the actual Greek chicken page returned 15 ingredients, nine publisher steps, three ingredient groups and 14 note paragraphs. The older unsaved hosted draft remains stale and is not automatically rewritten. A fresh hosted website import/review/save check is still required.

The feature code and tests are organized around authenticated data operations, extraction and cooking interfaces. The latest stable verification passed 94 TypeScript tests across 19 files, nine Python tests, TypeScript checking and a local Webpack production build. Hosted acceptance of the pending web changes remains separate.

## Remaining acceptance and launch work

- Release and verify pantry add/correct/shop/purchase/copy flows, inline playback and compact headers on the hosted app.
- Confirm actual email-code sign-in and Millusha's join into the same library.
- Test both actual iPhones. Desktop browser or emulator results are not physical-device evidence.
- Verify fresh hosted website groups/notes and TikTok normalization without a draft repair.
- Verify the new failure audit, unavailable/non-recipe paths and broader platform samples; the current YouTube success is sample-specific.
- Configure a reachable development import worker. Development Convex currently points at the production worker, which cannot resolve development job IDs; development CRUD is usable, development imports are not accepted.
- Address the launch constraints recorded in architecture.md: library pagination, orphaned-image cleanup, dependency advisories, production Clerk setup and wider operational monitoring.
- Keep native Expo implementation and photo/voice pantry updates as documented future work until separately built and tested.

The completion bar remains end-to-end behavior: correct source evidence, reviewable gaps, authenticated persistence and a successful fresh reload. A ready deployment, an HTTP 200, a passing unit test, or a local download alone does not establish that a hosted recipe import works.
