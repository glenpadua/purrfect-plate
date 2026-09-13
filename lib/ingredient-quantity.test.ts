import { expect, test } from "vitest";
import {
  extractIngredientQuantity,
  ingredientForCooking,
  ingredientScale,
  parseIngredient,
  withIngredientQuantity,
} from "./cooking";
const half = (text: string) =>
  ingredientForCooking(withIngredientQuantity({ text }), { factor: 0.5, units: "original" });

test("source quantities become persistent records for counts, ranges and alternative weights", () => {
  const text = "Onions sliced- 5 medium (400 gms)";
  const line = withIngredientQuantity({ text, sourceIds: ["publisher"] });
  expect(line).toMatchObject({
    text,
    sourceIds: ["publisher"],
    quantity: {
      version: 1,
      sourceText: text,
      status: "scalable",
      parsed: { amount: 5, alternate: { amount: 400, unit: "gms" } },
    },
  });
  expect(ingredientScale(line, 200, "g")).toBe(0.5);
  expect(half(text).text).toBe("Onions sliced- 2½ medium (200 g)");
  expect(half("Green Chillies, slit- 5 numbers").text).toBe("Green Chillies, slit- 2½ numbers");
  expect(half("Cinnamon- 2 pieces").text).toBe("Cinnamon- 1 pieces");
  expect(half("Oil- 5-6 tbsp").text).toBe("Oil- 2½ tbsp–3 tbsp");
  expect(half("Water- around 2.5 litres").text).toBe("Water- around 1¼ litres");
  expect(half("5 medium onions (400 g)").text).toBe("2½ medium onions (200 g)");
  expect(half("1–2 lemons").text).toBe("½–1 lemons");
});
test("range anchors and unsafe multi-amount interpretations are rejected", () => {
  for (const text of [
    "1 (400 g) can tomatoes",
    "2 x 400g cans beans",
    "2 cans tomatoes (400 g)",
    "2 inch ginger",
    "5% cream",
    "Salt- 4/0 tsp",
    "Oil- 6–5 tbsp",
    "2 eggs plus 1 yolk",
  ]) {
    expect(extractIngredientQuantity(text).status, text).toBe("review");
    expect(half(text), text).toEqual({ text, unchanged: true });
  }
  expect(ingredientScale("Oil- 5–6 tbsp", 3, "tbsp")).toBeNull();
  expect(extractIngredientQuantity("Salt to taste").status).toBe("unmeasured");
  expect(extractIngredientQuantity("Oil as needed").status).toBe("unmeasured");
  expect(extractIngredientQuantity("Rice").status).toBe("review");
});
test("corrections survive JSON storage, preserve the source, and invalidate when source text changes", () => {
  const original = "Juice of 2 lemons";
  const line = withIngredientQuantity({
    text: original,
    quantity: extractIngredientQuantity(original, "2 lemons, juiced"),
  });
  const reloaded = JSON.parse(JSON.stringify(line));
  expect(ingredientForCooking(reloaded, { factor: 0.5, units: "original" }).text).toBe(
    "1 lemons, juiced",
  );
  expect(ingredientScale(reloaded, 1, "items")).toBe(0.5);
  expect(reloaded.text).toBe(original);
  const changed = withIngredientQuantity({ ...line, text: "4 lemons, juiced" });
  expect(changed.quantity.scalingText).toBeUndefined();
  expect(parseIngredient(changed)?.amount).toBe(4);
});

test("explicit added portions scale separately without losing their preparation notes", () => {
  const text = "Onions sliced- 5 medium (400 gms) + 1 medium to be made into a birista";
  expect(half(text).text).toBe(
    "Onions sliced- 2½ medium (200 g) + ½ medium to be made into a birista",
  );
  expect(half("Mint leaves - around 10- 15 leaves").text).toBe("Mint leaves - around 5–7½ leaves");
  expect(half("Onion- 1 medium to be made into a birista").text).toBe(
    "Onion- ½ medium to be made into a birista",
  );
  expect(ingredientScale(text, 200, "g")).toBeNull();
  expect(half("2 eggs + 1 (400 g) can tomatoes").unchanged).toBe(true);
});
