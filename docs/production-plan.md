# Hosted recipe library acceptance

The target is a working Vercel web app backed by production Convex, with Clerk sign-in and one shared library for Glen and Millusha. The mobile client will reuse authenticated Convex functions and the same server-side import service.

## Required proof before completion

- Clerk sign-in, signed-out protection, and access restricted to approved library members.
- Preserve existing manually entered recipes and their photos.
- Persist ingredients, instructions, servings, provenance, manual/imported origin, and images or a designed placeholder.
- Import URLs from Instagram, TikTok, YouTube and recipe websites through the library UI; review/edit and save a proper readable recipe.
- Durable import jobs, canonical URL deduplication, bounded usage, explicit errors, and recovery after interrupted processing.
- Separate platform retrieval, evidence extraction, recipe normalization, persistence and UI contracts.
- Verify actual hosted retrieval, not only local downloads. Cloud access failures remain unresolved until a working path is verified.
- Validate authenticated cross-library access boundaries, idempotent saves, meaningful extraction checks, and the full hosted save/reload/edit flow.
- Document setup, deployment, API contracts, schema, models, dependencies, limits, costs and remaining known constraints.

## Decisions

- Vercel hosts Next.js and a private Python media service. Convex owns durable import state and recipes.
- Clerk app: `app_3JDinlimgp4znmD68XP5Y1dInNs` (explicitly supplied by Glen).
- Initial shared-library access: Glen and Millusha’s privately configured invited addresses. Separate sign-ins; membership stored in Convex.
- Preserve source quotes separately from readable recipe fields. Missing quantities, temperatures, or methods must not be invented to make an import look complete.
- Imported recipes are drafts for review until saved. Visual hypotheses remain distinct from author-stated facts.

## Verified checkpoint — 12 September 2026

- Web deployment `dpl_GPEKybSMBYpGwtbUvN61nto8vbeS` is ready at `https://purrfect-plate-theta.vercel.app`; the production Convex functions are deployed.
- Google sign-in reached the shared hosted library. The original 53 manual recipes and their optimized images were migrated additively.
- Instagram `DdJyDKhKk1i`: hosted import, review, save, and subsequent note edit succeeded. Changing `/reel/` to `/p/` and adding tracking parameters reused the same saved job/recipe.
- TikTok `7351594254663159083`: hosted media extraction and review succeeded. A source-matching bug was found before saving; the unsaved draft was repaired from the retained evidence, then saved through the UI and verified in a fresh page load. It has 12 ingredients, eight steps, original attribution, and visible source-gap warnings. Its loaded Convex cover is WebP, 46,840 bytes, 640 × 1138 pixels.
- The Greek chicken website draft now preserves all nine publisher steps, including marination. It remains unsaved: ingredient group headings and referenced recipe notes need preservation before calling this a complete standalone recipe.
- 58 tests pass across eight files. Local Webpack and hosted Turbopack production builds passed. Local Turbopack hit a sandbox process/port restriction; no dependency reinstall was performed during the active dev session.
- YouTube's hosted proof-of-origin experiment successfully starts Node and generates a token, but the supplied CrunchWrap Short still yields no formats, captions or transcript. Description-only fallback also has no content for this sample. This remains unresolved.

Next acceptance work: verify freshly extracted website recipe groups/notes; verify a fresh hosted import using the updated normalizer; resolve YouTube access and remove temporary diagnostics; finish email sign-in testing; configure the development worker correctly; verify a real `main` push triggers both Vercel deployments. Pagination, orphan cleanup, dependency advisories and production Clerk remain documented launch work in `architecture.md`. The mobile investigation is documented separately in `mobile-plan.md`.
- Social media access is dependent on platform and hosting network; the media adapter is replaceable.

## Cooking feature checkpoint

Working source now includes session-only cook mode, ingredient checklists, serving adjustment, conservative metric/US conversion, publisher ingredient groups and notes, and separate import warnings. Behavioral tests cover scaling, ambiguous quantities, unit dimensions, step navigation after a shared edit, and provenance through authenticated save/edit. Deployed to production Vercel (`dpl_4wg6MJAaGig6CvwFnR8QDvZrisUK`) after additive Convex deployment. Hosted browser verified start/next/exit and metric display on the saved TikTok recipe. Parser replay of the actual Greek chicken page returned 15 ingredients, nine steps, three groups and 14 note paragraphs. The old saved draft is not automatically changed. Serving changes are covered by behavior tests; actual two-iPhone acceptance remains open.
