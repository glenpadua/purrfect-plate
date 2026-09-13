/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  ingredientForCooking,
  recipeLinesFromText,
  recipeLinesToText,
} from "../packages/recipe-core";

test("a native client can edit a shared recipe and cook double portions without changing its source quantities", async () => {
  const t = convexTest(schema, import.meta.glob("./**/!(*.test).ts"));
  await t.mutation(internal.libraries.bootstrap, { emails: ["cook@example.com"] });
  const cook = t.withIdentity({
    subject: "native-cook",
    email: "cook@example.com",
    emailVerified: true,
  });
  await cook.mutation(api.libraries.join, {});
  const original = [{ text: "250 g rice", group: "Rice", sourceIds: ["publisher"] }];
  const id = await cook.mutation(api.recipes.create, {
    name: "Rice",
    tags: [],
    servings: "4",
    ingredients: original,
  });
  await cook.mutation(api.recipes.update, {
    id,
    ingredients: recipeLinesFromText(recipeLinesToText(original), original),
    note: "Our favourite",
  });
  const recipe = await cook.query(api.recipes.get, { id });
  expect(ingredientForCooking(recipe!.ingredients![0].text, { factor: 2, units: "us" }).text).toBe(
    "≈ 17.64 oz rice",
  );
  expect(await cook.query(api.recipes.get, { id })).toMatchObject({
    ingredients: original,
    servings: "4",
    note: "Our favourite",
  });
});
