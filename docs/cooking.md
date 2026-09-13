# Cooking features and conventions

Original ingredient text stays intact. Serving and unit adjustments persist per account and recipe across devices. The shared base serving count is separate from each cook’s adjustment. The active method step is temporary; ingredient checkboxes update the shared pantry. Finishing cook mode does not automatically increment the cooked count; that remains an explicit library action.

## Behavior

- Start cook mode on any recipe with instructions. Navigate forward/back, finish, or exit. Ingredients and publisher notes stay available. Keyboard focus follows step navigation. If a shared edit removes the current step, the view uses the last remaining step.
- Base servings use the source count when available; otherwise a clearly labelled rough estimate. Editing the base corrects how many people the original amounts feed without rewriting them. Ranges in source servings use a labelled midpoint estimate.
- Each ingredient stores a versioned quantity record beside its original text: a main amount/unit, optional range maximum, approximate qualifier and alternate measurement. Imports and recipe writes rebuild and validate these records; old recipes have a read fallback and a bounded, repeatable backfill.
- Leading and separator-delimited amounts support decimals, fractions, counts, ranges, and alternate weights (for example `Onions- 5 medium (400 gms)`). Approximate qualifiers such as `around` are retained. Explicit additional amounts separated by ` + ` scale separately while preserving their preparation notes. Package sizes, dimensions and other ambiguous multiple amounts remain flagged. `To taste` and `as needed` are explicitly unmeasured. Missing numbers are never invented.
- Ingredient amount review in the editor shows each line’s half-batch preview. A correction is stored separately as `scalingText`; the source text and its citations stay untouched. Editing the source line invalidates its previous quantity record and correction. Pantry identity still uses the original line.
- The serving stepper scales every understood measurement, including both ends of ranges and alternate weights. Ingredient-based scaling can use a compatible alternate measurement (200 g from 5 onions / 400 g means half a batch). Range and combined-portion ingredients are not offered as anchors because they do not identify one exact base amount. Fractional eggs or whole spices still need cooking judgment.
- Convert mass only to mass and volume only to volume. Metric display uses g/mL; US display uses oz/US cups. Unlabeled cups/spoons and UK imperial pints remain unchanged: their conventions cannot safely be inferred from the recipe title or website.
- Supported mass spellings: g/gram, kg/kilogram, oz/ounce, lb/lbs/pound and plurals. Supported metric volume: ml/milliliter/millilitre, l/liter/litre and plurals. US volume requires explicit `US cup(s)`, `US tbsp`, `US tsp`, or `US fl oz`.
- Conversions display an approximation sign and up to two decimal places. Very small quantities that would round to zero remain unchanged. Original amounts can be expanded for comparison.
- Cooking times, temperatures and quantities inside instructions are unchanged. The UI reminds the cook to refer to adjusted ingredient amounts. No density estimates, calorie estimates, automatic cooking-time scaling or fabricated missing quantities.

Conversion factors use US customary units (1 oz = 28.349523125 g; 1 US cup = 236.5882365 mL). See [NIST household measures](https://www.nist.gov/publications/nist-sp430-household-weights-and-measures) and [NIST cooking measurement guidance](https://www.nist.gov/pml/owm/metric-si/metric-kitchen/metric-kitchen-cooking-measurement-equivalencies). Metric is the practical UK option; UK imperial and US customary are distinct systems.

## Code and tests

`lib/cooking.ts` exposes `servingCount` and `ingredientForCooking`. The module also exposes quantity extraction and validated write helpers. These hide parsing and conversion rules behind a shared interface and are used by the shared Expo client. `apps/mobile/src/features/cooking/cooking-panel.tsx` owns shared web/native session state and accessible controls. It has no database or provider dependency.

`lib/recipe-lines.ts` is used by manual editing and import review. `## Heading` marks a group. Unchanged lines keep original text and source IDs, including multiline source steps; edited lines lose inherited source attribution. Publisher notes are separate from personal kitchen notes, and new import warnings are separate from both.

Test through production interfaces: parser → normalizer, authenticated Convex save/edit, and visible cooking controls. Cover observable behavior, especially source preservation, unit ambiguity and shared edits. Add red/green tests when expanding parsing support. Avoid a generic quantity framework until an actual recipe format requires it.

## Explicit limits and next steps

The shared Expo cook mode keeps the native screen awake during cooking. It does not yet provide offline recipes, persistent session progress or timers. Ingredient checkboxes represent shared pantry presence, not completed preparation; checking one leaves its text readable and updates the pantry. Portion changes retain the original ingredient identity. See [pantry behavior](pantry.md). Physical iPhone kitchen acceptance remains open.
