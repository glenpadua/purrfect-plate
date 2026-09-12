# Cooking features and conventions

The first version keeps the source recipe intact. Portions, units, checked ingredients and the active step are temporary state for the current page. Reloading resets them. Finishing cook mode does not automatically increment the cooked count; that remains an explicit library action.

## Behavior

- Start cook mode on any recipe with instructions. Navigate forward/back, finish, or exit. Ingredients and publisher notes stay available. Keyboard focus follows step navigation. If a shared edit removes the current step, the view uses the last remaining step.
- Portion adjustment requires an unambiguous base count such as `4`, `4 servings`, or `Serves 4`. A yield such as `12 cookies` or `4–6 servings` does not imply a number of people. Edit the recipe to establish a serving count before scaling.
- Scale explicit leading decimal, fraction or mixed-fraction quantities. Ranges, multiple numbers, package sizes and amounts embedded in prose remain as written and are marked for review. Fractional eggs or other indivisible ingredients still need human judgment.
- Convert mass only to mass and volume only to volume. Metric display uses g/mL; US display uses oz/US cups. Unlabeled cups/spoons and UK imperial pints remain unchanged: their conventions cannot safely be inferred from the recipe title or website.
- Supported mass spellings: g/gram, kg/kilogram, oz/ounce, lb/lbs/pound and plurals. Supported metric volume: ml/milliliter/millilitre, l/liter/litre and plurals. US volume requires explicit `US cup(s)`, `US tbsp`, `US tsp`, or `US fl oz`.
- Conversions display an approximation sign and up to two decimal places. Very small quantities that would round to zero remain unchanged. The original amount is shown below transformed text.
- Cooking times, temperatures and quantities inside instructions are unchanged. The UI reminds the cook to refer to adjusted ingredient amounts. No density estimates, calorie estimates, automatic cooking-time scaling or fabricated missing quantities.

Conversion factors use US customary units (1 oz = 28.349523125 g; 1 US cup = 236.5882365 mL). See [NIST household measures](https://www.nist.gov/publications/nist-sp430-household-weights-and-measures) and [NIST cooking measurement guidance](https://www.nist.gov/pml/owm/metric-si/metric-kitchen/metric-kitchen-cooking-measurement-equivalencies). Metric is the practical UK option; UK imperial and US customary are distinct systems.

## Code and tests

`lib/cooking.ts` exposes `servingCount` and `ingredientForCooking`. They hide parsing and conversion rules behind a small pure interface and are used by the shared Expo client. `apps/mobile/src/features/cooking/cooking-panel.tsx` owns shared web/native session state and accessible controls. It has no database or provider dependency.

`lib/recipe-lines.ts` is used by manual editing and import review. `## Heading` marks a group. Unchanged lines keep original text and source IDs, including multiline source steps; edited lines lose inherited source attribution. Publisher notes are separate from personal kitchen notes, and new import warnings are separate from both.

Test through production interfaces: parser → normalizer, authenticated Convex save/edit, and visible cooking controls. Cover observable behavior, especially source preservation, unit ambiguity and shared edits. Add red/green tests when expanding parsing support. Avoid a generic quantity framework until an actual recipe format requires it.

## Explicit limits and next steps

The shared Expo cook mode keeps the native screen awake during cooking. It does not yet provide offline recipes, persistent session progress or timers. Ingredient checkboxes represent shared pantry presence, not completed preparation; checking one leaves its text readable and updates the pantry. Portion changes retain the original ingredient identity. See [pantry behavior](pantry.md). Physical iPhone kitchen acceptance remains open.
