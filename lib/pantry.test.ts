import { expect, test } from "vitest";
import { ingredientIdentity } from "./pantry";

test.each([
  ["2 onions, finely chopped", "onion"],
  ["1½ cups rice", "rice"],
  ["½ tsp jeera", "cumin seeds"],
  ["1 tsp jeera powder", "ground cumin"],
  ["ground cumin", "ground cumin"],
  ["dhania seeds", "coriander seeds"],
  ["dhania powder", "ground coriander"],
  ["cilantro", "coriander leaves"],
  ["kasuri methi", "dried fenugreek leaves"],
  ["methi seeds", "fenugreek seeds"],
  ["besan", "chickpea flour"],
  ["  ALOO ", "potato"],
  ["red onion", "red onion"],
  ["onion powder", "onion powder"],
  ["black cumin", "black cumin"],
])("normalizes %s to %s without guessing substitutions", (text, key) => {
  expect(ingredientIdentity(text)?.key).toBe(key);
});
test.each([
  "dhania",
  "1 tsp coriander",
  "haldi",
  "methi",
  "butter or oil",
  "salt and pepper",
  "2 x 400g tomatoes",
  "1–2 onions",
])("leaves %s unresolved", (text) => {
  expect(ingredientIdentity(text)).toBeNull();
});
