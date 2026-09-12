import { expect, test } from "vitest"
import { parsePage } from "./parse"
import { normalizeRecipe } from "../normalize"

function page(amount = "1/2") {
  return `<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "Soup", recipeIngredient: ["1/2 cup stock"], recipeInstructions: ["Simmer. See Note 1."] })}</script><div class="wprm-recipe-container"><h2 class="wprm-recipe-name">Soup</h2><div class="wprm-recipe-ingredient-group"><h3 class="wprm-recipe-group-name">Broth</h3><div class="wprm-recipe-ingredient">${amount} cup stock</div></div><div class="wprm-recipe-notes"><p>1. Use vegetable stock.</p></div></div>`
}
test("extracts grouped ingredients and referenced notes through the production parser and normalizer", async () => {
  const parsed = parsePage(page(), "website")
  const result = await normalizeRecipe(parsed.evidence)
  expect(result.draft.ingredients[0]).toMatchObject({ text: "1/2 cup stock", group: "Broth" })
  expect(result.draft).toMatchObject({ recipeNotes: [{ text: "1. Use vegetable stock." }] })
  expect(result.draft.warnings).toEqual([])
})
test("does not merge a scaled or numerically different visible recipe card", () => {
  for (const amount of ["12", "1.2", "2"]) {
    expect(parsePage(page(amount), "website").evidence.some(e => e.kind === "recipe_card")).toBe(false)
  }
})
test("keeps a missing note warning when a matching card has no notes", async () => {
  const parsed = parsePage(page().replace("<p>1. Use vegetable stock.</p>", ""), "website")
  expect(parsed.warnings.join(" ")).toContain("notes")
  expect((await normalizeRecipe(parsed.evidence)).draft.warnings.join(" ")).toContain("notes")
})
