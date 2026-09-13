# Pantry, ingredient names, and a temporary shopping list

Agreed with Glen on 12 September 2026. Pantry remembers presence, not quantities.
Shopping holds intentional purchases and is designed to be copied elsewhere and
cleared frequently. Both are shared within the authenticated library.

## Everyday flow

- Kitchen: a searchable alphabetical pantry, with direct add, inline rename,
  removal, and Undo. Only ingredients currently at home appear. More ingredients
  load in pages; the old 300-item pantry limit is gone.
- Recipe: one checkbox means “we have this at home.” It reflects and updates the
  shared pantry. “Add missing ingredients” adds the unchecked ingredients once,
  in a single transaction. Portions and unit changes preserve that identity.
- Shopping: manual add, inline rename, individual removal, Copy list, Clear list,
  and Undo. Copy produces plain ingredient names, one per line. Clipboard failure
  exposes a selectable text area. Copy never clears the list.
- Shopping changes never mark stock in or out. Pantry changes never remove or add
  shopping intent. Having rice and wanting more rice are both valid at once.
- No “Bought”, “Still have it”, “Mark out”, “Need it”, or separate “Forget” flow.
  Cooking does not automatically deduct anything. Quantities stay in recipes.

## Stable ingredient identities and names

`pantryItems._id` is the stable ingredient identity. The historical table name is
retained to avoid a disruptive table replacement. `present` is the current stock
membership, not the lifetime of the identity. Removing pantry stock sets it false;
the name, learned aliases, and recipe connections remain. `key` is a creation-time
lookup key, not the editable display name.

`ingredientAliases` maps a library-scoped normalized name to an ingredient ID with
an exact composite index. A shared, deterministic seed dictionary in
`lib/pantry.ts` handles common plurals, culinary names and Indian transliterations.
Unicode, whitespace, clear quantities and supported preparation suffixes are
normalized. The original recipe source is never rewritten.

Forms remain distinct: cumin seeds vs ground cumin; coriander leaves vs seeds vs
powder; fresh vs dried fenugreek leaves. Bare ambiguous terms such as dhania,
methi, or haldi require a recipe-specific choice. Regional names are not
universally exhaustive and similar spelling is never proof of equivalence.

Botanical name pairs were checked against [ICAR-AICRP's spice catalogue](https://aicrps.res.in/crops/).
Culinary forms are intentionally explicit; the catalogue is not used to infer
that different parts or preparations of a plant are interchangeable.

Renaming changes the display label, retains previous names, and updates linked
shopping labels. A collision returns a merge preview without changing data. Only
an explicit second request with the target ID merges the ingredients. Merging
keeps stock if either ingredient is present and deduplicates shopping intent.
The old identity redirects to the survivor, preserving recipe bindings and
outstanding Undo snapshots without scanning and rewriting every recipe.
Redirect reads are bounded at 32; unusually long merge histories require future
compaction. Normal renames do not add redirects.

## Recipe choices and unresolved shopping text

`recipeIngredientBindings` stores the recipe ID, exact original line text and
one or more ingredient IDs. This supports both “butter or oil” (choose one) and
“salt and pepper” (choose both). The user can revisit a saved choice. A choice for
“dhania” in one recipe never becomes a global assumption for other recipes.

Bindings apply only while that exact ingredient text is in that recipe. Editing
the source text invalidates the match; reordering unchanged lines does not.
Bindings follow stable ingredient IDs through renames and merges.

An unresolved line is added to shopping exactly as written, including quantities,
so nothing is silently skipped. It has a text identity and stays freely editable.
Renaming it to a recognized ingredient links it (with a preview if the ingredient
already exists). Previously collected unresolved text stays on the temporary
list until explicitly edited or removed; pantry confirmation never cancels it.

## Persistence and bounded reads

- `pantry.page`: indexed, reactive pagination of present ingredients, 60 at a time
  in the UI. Indexed text search also resolves an exact known alias or old name.
- `pantry.matches`: resolves the current recipe's at most 100 ingredient lines by
  indexed alias/identity lookup and recipe-specific bindings. It does not download
  the whole ingredient catalogue.
- `pantry.coverage`: the library ranks using the same matching rules, requested in
  batches of 20 recipes by the UI. It describes recorded pantry matches, not a
  promise of sufficient quantities.
- `pantry.shopping`: the deliberately short-lived list retains a 300-item guard.
  New additions fail explicitly at capacity. Batch adds/restores load its keys
  once and deduplicate transactionally; they do not scan it per insertion.
- Clear returns only the deleted snapshot. Undo adds those entries back without
  overwriting another member's intervening additions; IDs resolve current names
  and original creation times preserve list order.
- All functions derive library scope from authenticated membership. ID-based
  operations and recipe bindings check ownership. Batch failures roll back.

## Existing-data upgrade

`pantry.initialize` is an authenticated, idempotent upgrade to library pantry
version 2. New clients call it before reading the new UI. The prior model enforced
300 pantry entries, so the migration reads at most 301 and fails explicitly on an
unsupported legacy overrun instead of truncating data. Known equivalent legacy
names merge, with positive stock preserved. Old absent records remain off the
pantry screen. Existing shopping intent is retained independently of stock.

The schema additions are backward-compatible with stored documents. Old clients'
`list`, `purchase`, and `forget` API calls are replaced by the new interface, so
frontend and backend should be released together. `pnpm exec convex dev --once`
syncs the configured development backend; it is not a production deployment.

## Verification

Automated coverage includes Indian aliases and meaningful distinctions; Unicode
fractions; stock/shopping independence; actual checkbox-to-shopping intent;
recipe-local choices and source preservation; stable renames; merge previews and
reference survival; freeform shopping edits; clear/Undo interleaving; legacy
migration; pantry pagination beyond 300 items; authorization and atomic failures;
inline edit/cancel/merge controls; clipboard fallback; and cooking adjustments.

Local verification on 12 September 2026: all 133 tests passed, and TypeScript
checking passed. In-app browser checks covered alias deduplication, renaming and
old-name search, merge preview/cancel, clipboard contents, removal/Undo,
clear/Undo, and recipe confirmation followed by adding missing ingredients.
Desktop and a 390px mobile viewport were inspected; no physical phone was tested.

That check used the retired Next.js UI on port 3000 and encountered a
Clerk/loopback binding issue. For the current Expo pantry, follow [development
setup](../README.md#start-local-development) and open `http://localhost:8082/pantry`.


## Shared Expo implementation

The Next.js implementation and its original tests are preserved in commit `076f532`; the active product UI is now `apps/mobile/src/features/pantry`. The same screen and recipe controls render on web and native. Regression tests in that folder cover pantry-backed checkboxes, remembered choices, failed writes, portion identity, merge confirmation, Clear/Undo, and selectable copy fallback. The backend and dictionary tests remain intact. The current [verification record](mobile-plan.md) supersedes the older frontend-specific validation above.
