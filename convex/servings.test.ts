/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/!(*.test).ts");
async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.libraries.bootstrap, {
    emails: ["glen@example.com", "millusha@example.com"],
  });
  const glen = t.withIdentity({ subject: "glen", email: "glen@example.com", emailVerified: true });
  const millusha = t.withIdentity({
    subject: "millusha",
    email: "millusha@example.com",
    emailVerified: true,
  });
  await glen.mutation(api.libraries.join, {});
  await millusha.mutation(api.libraries.join, {});
  const ingredients = [
    { text: "Mutton- 1 kg", sourceIds: ["source"] },
    { text: "Rice- 700 gms (4 US cups)" },
  ];
  const id = await glen.mutation(api.recipes.create, {
    name: "Biryani",
    servings: "Serves 4",
    tags: [],
    ingredients,
  });
  return { t, glen, millusha, id, ingredients };
}
test("base edits are shared while source quantities and source yield are preserved", async () => {
  const { glen, millusha, id, ingredients } = await setup();
  await glen.mutation(api.recipes.setBaseServings, { id, count: 6 });
  expect(await millusha.query(api.recipes.get, { id })).toMatchObject({
    servings: "Serves 4",
    servingInfo: { count: 6, origin: "user" },
    ingredients,
  });
  for (const count of [0, 1.5, 101, NaN, Infinity])
    await expect(glen.mutation(api.recipes.setBaseServings, { id, count })).rejects.toThrow();
});
test("same account on another device resumes its adjustment, other members keep their own", async () => {
  const { t, glen, millusha, id } = await setup();
  const preference = {
    adjustment: {
      mode: "ingredient" as const,
      ingredientText: "Mutton- 1 kg",
      amount: 500,
      unit: "g",
    },
    units: "metric" as const,
  };
  await glen.mutation(api.recipes.setCookingPreference, { id, preference });
  const secondDevice = t.withIdentity({ subject: "glen" });
  expect(await secondDevice.query(api.recipes.getCookingPreference, { id })).toEqual(preference);
  expect(await millusha.query(api.recipes.getCookingPreference, { id })).toBeNull();
  await millusha.mutation(api.recipes.setCookingPreference, {
    id,
    preference: { adjustment: { mode: "servings", servings: 8 }, units: "original" },
  });
  await glen.mutation(api.recipes.setCookingPreference, {
    id,
    preference: { adjustment: { mode: "original" }, units: "original" },
  });
  expect(await millusha.query(api.recipes.getCookingPreference, { id })).toMatchObject({
    adjustment: { servings: 8 },
  });
  await glen.mutation(api.recipes.remove, { id });
  expect(await t.run((ctx) => ctx.db.query("recipeCookingPreferences").collect())).toEqual([]);
});
test("old recipes without servings automatically acquire estimates on read without source rewrites", async () => {
  const { glen, t } = await setup();
  const id = await glen.mutation(api.recipes.create, {
    name: "Rice",
    tags: [],
    ingredients: [{ text: "360 g rice" }],
  });
  expect(await glen.query(api.recipes.get, { id })).toMatchObject({
    servingInfo: { count: 4, origin: "estimated" },
  });
  expect((await t.run((ctx) => ctx.db.get(id)))?.servings).toBeUndefined();
  await glen.mutation(api.recipes.update, { id, ingredients: [{ text: "180 g rice" }] });
  expect(await glen.query(api.recipes.get, { id })).toMatchObject({
    servingInfo: { count: 2, origin: "estimated" },
  });
});
test("preference writes reject stale ingredients, incompatible units and invalid factors", async () => {
  const { glen, id } = await setup();
  for (const adjustment of [
    { mode: "ingredient" as const, ingredientText: "Mutton- 1 kg", amount: 500, unit: "mL" },
    {
      mode: "ingredient" as const,
      ingredientText: "Other recipe ingredient",
      amount: 500,
      unit: "g",
    },
    { mode: "servings" as const, servings: -1 },
    { mode: "servings" as const, servings: Infinity },
  ])
    await expect(
      glen.mutation(api.recipes.setCookingPreference, {
        id,
        preference: { adjustment, units: "original" },
      }),
    ).rejects.toThrow();
});
test("sign-in and recipe library membership are required for every serving operation", async () => {
  const { t, glen, id } = await setup();
  await t.run(async (ctx) => {
    const libraryId = await ctx.db.insert("libraries", {
      name: "Other",
      slug: "other",
      createdAt: 1,
    });
    await ctx.db.insert("memberships", {
      libraryId,
      userId: "other",
      email: "other@example.com",
      role: "owner",
      createdAt: 1,
    });
  });
  for (const caller of [t, t.withIdentity({ subject: "other" })]) {
    await expect(caller.query(api.recipes.getCookingPreference, { id })).rejects.toThrow();
    await expect(caller.mutation(api.recipes.setBaseServings, { id, count: 5 })).rejects.toThrow();
    await expect(
      caller.mutation(api.recipes.setCookingPreference, {
        id,
        preference: { adjustment: { mode: "original" }, units: "original" },
      }),
    ).rejects.toThrow();
  }
  expect(await glen.query(api.recipes.getCookingPreference, { id })).toBeNull();
});

test("saving the full editor re-estimates changed amounts without losing a user correction", async () => {
  const { glen } = await setup();
  const id = await glen.mutation(api.recipes.create, {
    name: "Rice",
    tags: [],
    ingredients: [{ text: "360 g rice" }],
  });
  await glen.mutation(api.recipes.update, {
    id,
    ingredients: [{ text: "180 g rice" }],
    servingInfo: { count: 4, origin: "estimated" },
  });
  expect(await glen.query(api.recipes.get, { id })).toMatchObject({
    servingInfo: { count: 2, origin: "estimated" },
  });
  await glen.mutation(api.recipes.update, {
    id,
    ingredients: [{ text: "360 g rice" }],
    servingInfo: { count: 3, origin: "user" },
  });
  expect(await glen.query(api.recipes.get, { id })).toMatchObject({
    servingInfo: { count: 3, origin: "user" },
  });
});
