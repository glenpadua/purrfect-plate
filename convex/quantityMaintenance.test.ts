/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { extractIngredientQuantity, ingredientForCooking } from "../lib/cooking";
const modules = import.meta.glob("./**/!(*.test).ts");
test("backfill persists quantities without source edits, is repeatable, and save rebuilds untrusted values", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.libraries.bootstrap, { emails: ["test@example.com"] });
  const user = t.withIdentity({ subject: "test", email: "test@example.com", emailVerified: true });
  await user.mutation(api.libraries.join, {});
  const text = "Onions- 5 medium (400 gms)";
  const id = await user.mutation(api.recipes.create, {
    name: "Biryani",
    tags: [],
    ingredients: [{ text, sourceIds: ["caption"] }],
  });
  await t.run((ctx) => ctx.db.patch(id, { ingredients: [{ text, sourceIds: ["caption"] }] }));
  expect(
    await t.mutation(internal.quantityMaintenance.backfill, { table: "recipes", cursor: null }),
  ).toMatchObject({ done: true, updated: 1 });
  expect(
    await t.mutation(internal.quantityMaintenance.backfill, { table: "recipes", cursor: null }),
  ).toMatchObject({ done: true, updated: 0 });
  const stored = await t.run((ctx) => ctx.db.get(id));
  expect(stored?.ingredients?.[0]).toMatchObject({
    text,
    sourceIds: ["caption"],
    quantity: { parsed: { amount: 5, alternate: { amount: 400 } } },
  });
  const quantity = extractIngredientQuantity(text, "4 medium onions (320 g)");
  quantity.parsed!.amount = 999;
  await user.mutation(api.recipes.update, {
    id,
    ingredients: [{ text, sourceIds: ["caption"], quantity }],
  });
  const saved = await user.query(api.recipes.get, { id });
  expect(saved?.ingredients?.[0].quantity?.parsed?.amount).toBe(4);
  expect(
    ingredientForCooking(saved!.ingredients![0], { factor: 0.5, units: "original" }).text,
  ).toBe("2 medium onions (160 g)");
  await user.mutation(api.recipes.setCookingPreference, {
    id,
    preference: {
      adjustment: { mode: "ingredient", ingredientText: text, amount: 160, unit: "g" },
      units: "original",
    },
  });
  await user.mutation(api.recipes.update, { id, ingredients: [{ text: "8 onions", quantity }] });
  expect(
    (await user.query(api.recipes.get, { id }))?.ingredients?.[0].quantity?.scalingText,
  ).toBeUndefined();
});
