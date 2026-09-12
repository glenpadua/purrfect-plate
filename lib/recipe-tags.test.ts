import { expect, test } from "vitest"
import { canonicalizeRecipeTags } from "./recipe-tags"

test("keeps a small useful tag set when a recipe is saved with duplicates and filler", () => {
  expect(canonicalizeRecipeTags("Thai Basil Beef", [
    " Beef ", "BEEF", "stirfry", "stir-fry", "thaifood", "comfort food", "quick",
  ])).toEqual(["beef", "stir fry", "thai"])
  expect(canonicalizeRecipeTags("Lunch", ["recipes", "delicious", "baked dish", "", "easy"]))
    .toEqual([])
})

test("groups named dish variants while preserving each recipe's own supporting tags", () => {
  expect(canonicalizeRecipeTags("Chicken Biryani", ["dinner", "rice", "chicken"]))
    .toEqual(["biryani", "dinner", "rice"])
  expect(canonicalizeRecipeTags("Hyderabadi Chicken Biriyani", ["biriyani", "chicken"]))
    .toEqual(["biryani", "chicken"])
  expect(canonicalizeRecipeTags("Baked Mac & Cheese", ["pasta", "macaroni and cheese", "comfort food"]))
    .toEqual(["mac and cheese", "pasta"])
  expect(canonicalizeRecipeTags("Cheesy Mac and Cheese", ["pasta", "mac n cheese", "baked dish"]))
    .toEqual(["mac and cheese", "pasta"])
})

test("does not infer diet, unknown dish families, or a dish from a spice mix or inspiration", () => {
  expect(canonicalizeRecipeTags("Vegetable rice bowl", ["lunch", "rice"]))
    .toEqual(["lunch", "rice"])
  expect(canonicalizeRecipeTags("Biryani spice mix", ["spices"]))
    .toEqual(["spices"])
  expect(canonicalizeRecipeTags("Mac and cheese inspired popcorn", ["snack"]))
    .toEqual(["snack"])
  expect(canonicalizeRecipeTags("Pesto pasta", ["Vegetarian", "pasta", "lunch", "dinner"]))
    .toEqual(["vegetarian", "pasta", "lunch"])
})
