# Pantry and shopping list

The first version remembers whether an ingredient is available in the shared library. Glen and Millusha see the same pantry and shopping list. It does not count onions, deduct ingredients after cooking, estimate expiry dates, or promise enough food for a recipe's serving count.

## Data model

`pantryItems` stores `libraryId`, `key`, `name`, `present`, and `updatedAt`. One ingredient has one entry per library. An absent entry is an explicit correction; no entry means the library does not know. `updatedAt` is the last manual confirmation, including confirming the same state again. It is not proof that food remains available.

`shoppingItems` stores `libraryId`, `key`, `name`, and `createdAt`. Shopping items are separate because removing something from a shopping list does not mean it was purchased, and forgetting a pantry entry does not cancel an intention to buy it.

Both tables use a composite `by_library_key` index. The same index supports scoped listing and exact identity lookups. Mutations resolve library membership from the authenticated identity; clients cannot supply a library ID. ID-based mutations check ownership before changing an existing record. Convex transactions keep duplicate checks and pantry/shopping reconciliation atomic. See [Convex's guidance on indexed queries, bounded reads, and validation](https://docs.convex.dev/understanding/best-practices/).

Each table is capped at 300 entries for this private pilot. Reads request 301 entries and fail explicitly if an administrative write exceeded the cap. They never silently return an incomplete pantry. New items are rejected at the cap; existing entries can still be reconciled or forgotten. A later larger-library release should introduce pagination and a deliberate matching query instead of raising an unbounded scan limit.

## Application interface

`convex/pantry.ts` owns persistence and reconciliation:

| Operation | Result |
| --- | --- |
| `list({})` | `{ pantry, shopping }`, with projected `id` fields and no library identifiers. |
| `setPresence({ name, present })` | Adds or confirms an ingredient. `present: true` also removes its shopping item. `false` alone does not add shopping. |
| `addToShopping({ name })` | Marks the ingredient absent and adds it once to shopping, atomically. Use for “Actually, I don't have this.” |
| `purchase({ id })` | Marks the shopping ingredient present and removes the shopping item atomically. Repeating after removal is harmless. |
| `removeShopping({ id })` | Removes shopping intent without claiming the ingredient is present. |
| `forget({ id })` | Removes a pantry record; any separate shopping item remains. |

Inputs resolve to one ingredient name of at most 120 characters. Empty, compound, and ambiguous names are rejected with a request for a short ingredient name. Names are plain text, never instructions to an AI model or executable content. There are no new provider calls or image storage in this foundation.

## Recipe matching

`lib/pantry.ts` is a framework-independent module shared by clients and Convex. `ingredientIdentity(text)` produces a normalized `{ key, name }` or `null`. `ingredientAvailability(text, pantry)` returns that identity with a status: `present`, `missing`, or `unknown`. Missing requires an explicit absent pantry entry; an unrecognized ingredient or one never entered is unknown.

Matching only removes a clear leading quantity/unit and a small set of explicit preparation suffixes. Exact aliases cover common plurals and a few unambiguous names, such as courgette/zucchini. It preserves meaningful qualifiers: red onion is not automatically onion, onion powder is not onion, and olive oil is not any oil. Alternatives, combined ingredients, package sizes, and quantities containing ranges remain unresolved. There is no fuzzy substring matching, AI guessing, substitution, or dietary inference.

`recipePantryCoverage(ingredients, pantry)` returns `{ present, missing, unknown, total }`. Use all ingredient lines in the denominator and label the result as recorded availability, not “you can cook this.” Unknown lines must not count as confirmed missing or confirmed present. The pantry may be stale and quantities may be insufficient. The original recipe lines, units, groups, and evidence identifiers remain untouched.

Original recipe text remains the source of truth for shopping quantities. This first shopping list deliberately lists ingredient names only; it does not combine or scale amounts across recipes. Keep serving and unit conversions in the cooking module.

## Future photo and voice updates

This is the proposed next layer; it is not implemented by the pantry foundation:

1. Accept an image with optional context, or transcribe a short voice note into editable text. Bound file size, duration, provider calls, and cost before processing.
2. Produce proposed additions and explicit removals. Show the names and intended action for review; let the user correct or discard each item.
3. Apply the confirmed changes through the same pantry reconciliation rules. Add a bounded batch mutation when needed; do not build a second persistence path in an AI action.
4. Never infer “absent” because something is hidden or missing from a fridge photo. A snapshot may only show one shelf. Voice statements such as “we ran out of onions” can propose a removal, but still need review.
5. Keep image/audio evidence short lived. Do not store original media in Convex by default. If retained for review, use the existing image optimization policy and explicit expiry/cleanup.

A future canonical ingredient catalogue can add an optional ingredient reference to pantry items and a separate mapping for recipe lines. It must preserve existing text and version matching changes so a new synonym does not silently merge distinct ingredients. Current keys provide a lightweight starting point, not a universal food ontology.

## Verification

`convex/pantry.test.ts` exercises the authenticated application interface: shared access, deduplication, correcting availability, purchase reconciliation, deletion semantics, matching without source edits, signed-out rejection, cross-library isolation, input limits, capacity, and transaction rollback. No live pantry data is inserted by these tests. Browser and physical-device acceptance are separate checks owned by the caller integrating the feature.
