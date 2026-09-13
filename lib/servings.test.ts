import { expect, test } from "vitest"
import { cookingFactor, ingredientScale, parseCookingAmount, parseIngredient, ingredientForCooking } from "./cooking"
import { resolveServings } from "./servings"

test("scaling by available mass is independent of the serving estimate", () => {
  const text = "Mutton (or Goat Meat), large pieces with bones- 1 kg"
  const adjustment = { mode: "ingredient" as const, ingredientText: text, amount: 500, unit: "g" }
  expect(ingredientScale(text, 500, "g")).toBe(0.5)
  expect(ingredientScale("2 lb beef", 16, "oz")).toBeCloseTo(0.5)
  expect(cookingFactor(adjustment, 4, [{ text }])).toBe(0.5)
  expect(cookingFactor(adjustment, 8, [{ text }])).toBe(0.5)
  expect(cookingFactor(adjustment, null, [{ text }])).toBe(0.5)
  expect(cookingFactor(adjustment, 4, [{ text: "2 kg mutton" }])).toBeNull()
  expect(ingredientScale(text, 500, "mL")).toBeNull()
  expect(ingredientScale("1 cup flour", 250, "g")).toBeNull()
  expect(ingredientScale("2 eggs", 1, "items")).toBe(0.5)
})

test("invalid and ambiguous amounts are never silently multiplied", () => {
  for (const value of ["0", "-2", "1/0", "Infinity", "NaN", "1-2", "2 cups", "1e3", ""]) expect(parseCookingAmount(value)).toBeNull()
  expect(parseCookingAmount("1 1/2")).toBe(1.5)
  expect(parseCookingAmount("½")).toBe(0.5)
  expect(parseCookingAmount("0,5")).toBe(0.5)
  for (const text of ["2 x 400g cans beans", "1 (400 g) can tomatoes", "Salt to taste", "1 inch ginger", "1/0 cup water"]) {
    expect(parseIngredient(text)).toBeNull()
  }
  for (const factor of [0, -1, Infinity, NaN, 101]) expect(ingredientForCooking("1 kg lamb", { factor, units: "original" }).unchanged).toBe(true)
  expect(ingredientForCooking("0.01 tsp salt", { factor: 0.1, units: "original" }).unchanged).toBe(true)
})

test("source and user counts win, including after ingredient changes", () => {
  expect(resolveServings({ servings: "Serves 4", ingredients: [{ text: "700 g rice" }] })).toEqual({ count: 4, origin: "source" })
  expect(resolveServings({ servings: "4", servingInfo: { count: 6, origin: "user" }, ingredients: [{ text: "700 g rice" }] })).toEqual({ count: 6, origin: "user" })
  expect(resolveServings({ servings: "4–6 servings" })).toMatchObject({ count: 5, origin: "estimated" })
})

test("old recipes get the same labeled, explainable estimates as imports", () => {
  expect(resolveServings({ name: "Biryani", ingredients: [{ text: "Mutton- 1 kg" }, { text: "Rice- 700 gms (4 US cups)" }] })).toMatchObject({ count: 8, origin: "estimated", reason: expect.stringContaining("Rice") })
  expect(resolveServings({ name: "Omelette", ingredients: [{ text: "4 eggs" }] })).toMatchObject({ count: 2, origin: "estimated" })
  expect(resolveServings({ ingredients: [{ text: "1 tbsp rice flour" }] })).toMatchObject({ count: 4, origin: "estimated", reason: expect.stringContaining("rough starting") })
  expect(resolveServings({ name: "Photo only" })).toBeUndefined()
})
