import { expect, test } from "vitest"
import { ingredientForCooking, servingCount } from "./cooking"

test("converts like dimensions and leaves unspecified cup conventions alone", () => {
  expect(ingredientForCooking("100 g flour", { factor: 2, units: "us" }).text).toBe("≈ 7.05 oz flour")
  expect(ingredientForCooking("1 US cup milk", { factor: 1, units: "metric" }).text).toBe("≈ 236.59 mL milk")
  expect(ingredientForCooking("2 oz butter", { factor: 1, units: "metric" }).text).toBe("≈ 56.7 g butter")
  expect(ingredientForCooking("500 ml water", { factor: 1, units: "us" }).text).toBe("≈ 2.11 US cups water")
  expect(ingredientForCooking("1 cup flour", { factor: 1, units: "metric" })).toEqual({ text: "1 cup flour", unchanged: true })
  expect(ingredientForCooking("1 UK pint milk", { factor: 1, units: "metric" }).unchanged).toBe(true)
})

test("scales clear ingredient amounts while preserving ambiguous quantities", () => {
  expect(ingredientForCooking("1 1/2 cups flour", { factor: 2, units: "original" }).text).toBe("3 cups flour")
  expect(ingredientForCooking("½ tsp salt", { factor: 2, units: "original" }).text).toBe("1 tsp salt")
  expect(ingredientForCooking("2 eggs", { factor: 0.5, units: "original" }).text).toBe("1 eggs")
  for (const text of ["1–2 lemons", "Salt to taste", "1 (400 g) can tomatoes", "2 x 400g cans beans", "Juice of 2 lemons"]) {
    expect(ingredientForCooking(text, { factor: 2, units: "original" })).toEqual({ text, unchanged: true })
  }
  expect(servingCount("4 servings")).toBe(4)
  expect(servingCount("Serves 4")).toBe(4)
  expect(servingCount("4–6 servings")).toBeNull()
  expect(servingCount("12 cookies")).toBeNull()
})
