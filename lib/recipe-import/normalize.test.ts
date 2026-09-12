import { expect, test } from "vitest"
import { normalizeRecipe, draftFromPassages } from "./normalize"
import { selectablePassages } from "./extraction/providers"
import type { Evidence } from "./extraction/types"

const evidence: Evidence[] = [{ id: "caption", kind: "caption", text: "2 eggs. Stir gently. Serves two.", via: "Original caption" }, { id: "visual", kind: "visual_observation", text: "Bake at 200 degrees.", via: "Guess" }]
test("complete publisher recipes preserve every step without AI rewriting", async () => {
  const result = await normalizeRecipe([{ id: "publisher", kind: "structured_recipe", via: "JSON-LD", text: JSON.stringify({ "@type": "Recipe", name: "Lemon chicken", recipeIngredient: ["2 chicken thighs", "1 lemon"], recipeInstructions: [{ "@type": "HowToStep", text: "Marinate for at least 20 minutes." }, { "@type": "HowToStep", text: "Cook for 35 minutes, then 10 minutes uncovered." }], recipeYield: "2 servings" }) }])
  expect(result.draft.instructions.map(s => s.text)).toEqual(["Marinate for at least 20 minutes.", "Cook for 35 minutes, then 10 minutes uncovered."])
  expect(result.usage.model).toBe("publisher-jsonld")
})
test("retains the flour and preparation steps through source passage IDs", () => {
  const passages = selectablePassages([{ id: "speech", kind: "transcript", via: "Narration", text: "Shred the cheese. Divide it in half. Then add the flour. Cook for two minutes." }])
  const result = draftFromPassages({ name: "Macaroni", tags: [], servings: null, warnings: [], ingredients: [], instructions: [
    { text: "Shred the cheese and divide it in half.", passageIds: ["speech:0", "speech:1"] },
    { text: "Add the flour and cook for two minutes.", passageIds: ["speech:2", "speech:3"] },
  ] }, passages)
  expect(result.instructions).toEqual([{ text: "Shred the cheese and divide it in half.", sourceIds: ["speech"] }, { text: "Add the flour and cook for two minutes.", sourceIds: ["speech"] }])
})
test("falls back to source wording for unsupported numbers and rejects unknown or visual references", () => {
  const passages = selectablePassages(evidence)
  const raw = { name: "Eggs", tags: [], servings: "Serves two", warnings: [], ingredients: [{ text: "3 eggs", passageIds: ["caption:0"] }], instructions: [] }
  const result = draftFromPassages(raw, passages)
  expect(result.ingredients[0].text).toBe(evidence[0].text)
  expect(result.ingredients[0].text).not.toContain("3 eggs")
  expect(result.servings).toBe("Serves two")
  for (const id of ["missing:0", "visual:0"]) expect(() => draftFromPassages({ ...raw, instructions: [{ text: "Bake at 200 degrees.", passageIds: [id] }] }, passages)).toThrow("references")
})
