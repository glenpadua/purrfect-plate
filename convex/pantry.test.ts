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
  return { t, glen, millusha };
}
const firstPage = { paginationOpts: { cursor: null, numItems: 60 } };

test("Indian aliases share one identity while seeds, ground spices and leaves stay separate", async () => {
  const { glen, millusha } = await setup();
  const jeera = await glen.mutation(api.pantry.setPresence, { name: " Jeera ", present: true });
  const cumin = await millusha.mutation(api.pantry.setPresence, {
    name: "cumin seeds",
    present: true,
  });
  expect(jeera).toBe(cumin);
  await glen.mutation(api.pantry.setPresence, { name: "jeera powder", present: true });
  await glen.mutation(api.pantry.setPresence, { name: "dhania leaves", present: true });
  await glen.mutation(api.pantry.setPresence, { name: "dhania seeds", present: true });
  expect((await glen.query(api.pantry.page, firstPage)).page.map((item) => item.name)).toEqual([
    "coriander leaves",
    "coriander seeds",
    "cumin seeds",
    "ground cumin",
  ]);
  await glen.mutation(api.pantry.addToShopping, { name: "jeera" });
  await millusha.mutation(api.pantry.addToShopping, { name: "cumin seeds" });
  expect(await glen.query(api.pantry.shopping, {})).toHaveLength(1);
  expect((await glen.query(api.pantry.page, firstPage)).page).toHaveLength(4);
});

test("stock and shopping remain independent through every removal and clear/undo", async () => {
  const { glen, millusha } = await setup();
  const rice = await glen.mutation(api.pantry.setPresence, { name: "rice", present: true });
  await glen.mutation(api.pantry.addToShopping, { name: "rice" });
  const queued = await glen.query(api.pantry.shopping, {});
  await glen.mutation(api.pantry.setPresence, { ingredientId: rice, present: false });
  expect((await glen.query(api.pantry.page, firstPage)).page).toEqual([]);
  expect(await glen.query(api.pantry.shopping, {})).toEqual(queued);
  await millusha.mutation(api.pantry.setPresence, { ingredientId: rice, present: true });
  expect(await glen.query(api.pantry.shopping, {})).toEqual(queued);
  const removed = await glen.mutation(api.pantry.clearShopping, {});
  await millusha.mutation(api.pantry.addToShopping, { name: "onion" });
  await glen.mutation(api.pantry.restoreShopping, { items: removed });
  await glen.mutation(api.pantry.restoreShopping, { items: removed });
  const restored = await glen.query(api.pantry.shopping, {});
  expect(restored.map((item) => item.name)).toEqual(["rice", "onion"]);
  expect(restored[0].createdAt).toBe(queued[0].createdAt);
  expect((await glen.query(api.pantry.page, firstPage)).page.map((item) => item.id)).toEqual([
    rice,
  ]);
});

test("recipe checkboxes drive bulk shopping, aliases deduplicate, and unclear source lines are retained", async () => {
  const { glen } = await setup();
  const ingredients = [
    { text: "2 onions, finely chopped", sourceIds: ["publisher"] },
    { text: "1 tsp jeera" },
    { text: "2 tsp cumin seeds" },
    { text: "butter or oil" },
  ];
  const recipeId = await glen.mutation(api.recipes.create, {
    name: "Dinner",
    tags: [],
    ingredients,
  });
  await glen.mutation(api.pantry.setRecipePresence, {
    recipeId,
    text: ingredients[0].text,
    present: true,
  });
  expect((await glen.query(api.pantry.matches, { recipeId })).map((item) => item.present)).toEqual([
    true,
    false,
    false,
    false,
  ]);
  expect(await glen.mutation(api.pantry.addMissing, { recipeId })).toBe(2);
  expect((await glen.query(api.pantry.shopping, {})).map((item) => item.name)).toEqual([
    "cumin seeds",
    "butter or oil",
  ]);
  expect(await glen.mutation(api.pantry.addMissing, { recipeId })).toBe(0);
  await glen.mutation(api.pantry.setRecipePresence, {
    recipeId,
    text: ingredients[0].text,
    present: false,
  });
  expect(await glen.mutation(api.pantry.addMissing, { recipeId })).toBe(1);
  expect(
    (await glen.query(api.recipes.get, { id: recipeId }))?.ingredients?.map(
      ({ quantity: _quantity, ...line }) => line,
    ),
  ).toEqual(ingredients);
});

test("ambiguous choices persist per recipe, support combined lines, and never become global aliases", async () => {
  const { glen, millusha } = await setup();
  const ingredients = [{ text: "dhania" }, { text: "salt and pepper" }];
  const first = await glen.mutation(api.recipes.create, { name: "First", tags: [], ingredients });
  const second = await glen.mutation(api.recipes.create, { name: "Second", tags: [], ingredients });
  await expect(
    glen.mutation(api.pantry.setRecipePresence, { recipeId: first, text: "dhania", present: true }),
  ).rejects.toThrow("Choose");
  await glen.mutation(api.pantry.setRecipePresence, {
    recipeId: first,
    text: "dhania",
    present: true,
    names: ["coriander leaves"],
  });
  await glen.mutation(api.pantry.setRecipePresence, {
    recipeId: first,
    text: "salt and pepper",
    present: true,
    names: ["salt", "black pepper"],
  });
  expect(
    (await millusha.query(api.pantry.matches, { recipeId: first })).map((item) => item.present),
  ).toEqual([true, true]);
  expect(
    (await glen.query(api.pantry.matches, { recipeId: second })).map((item) => item.resolved),
  ).toEqual([false, false]);
  await glen.mutation(api.pantry.setRecipePresence, {
    recipeId: first,
    text: "salt and pepper",
    present: false,
  });
  expect((await glen.query(api.pantry.page, firstPage)).page.map((item) => item.name)).toEqual([
    "coriander leaves",
  ]);
  expect(await glen.query(api.pantry.coverage, { recipeIds: [first, second] })).toEqual([
    { recipeId: first, present: 1, total: 2 },
    { recipeId: second, present: 0, total: 2 },
  ]);
});

test("rename preserves IDs, previous names, source text, shopping labels and Undo references", async () => {
  const { glen } = await setup();
  const ingredientId = await glen.mutation(api.pantry.setPresence, {
    name: "jeera",
    present: true,
  });
  const recipeId = await glen.mutation(api.recipes.create, {
    name: "Rice",
    tags: [],
    ingredients: [{ text: "1 tsp jeera" }],
  });
  await glen.mutation(api.pantry.addToShopping, { name: "cumin seeds" });
  const cleared = await glen.mutation(api.pantry.clearShopping, {});
  expect(await glen.mutation(api.pantry.rename, { ingredientId, name: "Whole jeera" })).toEqual({
    status: "saved",
  });
  await glen.mutation(api.pantry.restoreShopping, { items: cleared });
  expect((await glen.query(api.pantry.shopping, {}))[0]).toMatchObject({
    name: "Whole jeera",
    ingredientId,
  });
  expect((await glen.query(api.pantry.matches, { recipeId }))[0]).toMatchObject({
    names: ["Whole jeera"],
    present: true,
    ingredientIds: [ingredientId],
  });
  expect(await glen.mutation(api.pantry.setPresence, { name: "cumin seeds", present: true })).toBe(
    ingredientId,
  );
  expect(
    (await glen.query(api.recipes.get, { id: recipeId }))?.ingredients?.map(
      ({ quantity: _quantity, ...line }) => line,
    ),
  ).toEqual([{ text: "1 tsp jeera" }]);
});

test("a rename collision previews before merge and combines stock, aliases, shopping and saved recipe choices", async () => {
  const { glen } = await setup();
  const source = await glen.mutation(api.pantry.setPresence, {
    name: "my special flour",
    present: true,
  });
  const target = await glen.mutation(api.pantry.setPresence, {
    name: "chickpea flour",
    present: false,
  });
  const recipeId = await glen.mutation(api.recipes.create, {
    name: "Pancakes",
    tags: [],
    ingredients: [{ text: "flour or besan" }],
  });
  await glen.mutation(api.pantry.setRecipePresence, {
    recipeId,
    text: "flour or besan",
    present: true,
    names: ["my special flour"],
  });
  await glen.mutation(api.pantry.addToShopping, { name: "my special flour" });
  await glen.mutation(api.pantry.addToShopping, { name: "besan" });
  expect(await glen.mutation(api.pantry.rename, { ingredientId: source, name: "besan" })).toEqual({
    status: "merge_required",
    targetId: target,
    targetName: "chickpea flour",
  });
  expect(await glen.query(api.pantry.shopping, {})).toHaveLength(2);
  await glen.mutation(api.pantry.rename, {
    ingredientId: source,
    name: "besan",
    mergeInto: target,
  });
  expect((await glen.query(api.pantry.page, firstPage)).page.map((item) => item.id)).toEqual([
    target,
  ]);
  expect((await glen.query(api.pantry.shopping, {})).map((item) => item.ingredientId)).toEqual([
    target,
  ]);
  expect((await glen.query(api.pantry.matches, { recipeId }))[0]).toMatchObject({
    ingredientIds: [target],
    present: true,
  });
  expect(
    await glen.mutation(api.pantry.setPresence, { name: "my special flour", present: true }),
  ).toBe(target);
});

test("freeform shopping edits stay editable and can link to an existing ingredient without changing stock", async () => {
  const { glen } = await setup();
  await glen.mutation(api.pantry.addToShopping, { name: "butter or oil" });
  let [row] = await glen.query(api.pantry.shopping, {});
  await glen.mutation(api.pantry.renameShopping, { id: row.id, name: "butter, any brand" });
  [row] = await glen.query(api.pantry.shopping, {});
  expect(row.name).toBe("butter, any brand");
  const butter = await glen.mutation(api.pantry.setPresence, { name: "butter", present: false });
  expect(
    await glen.mutation(api.pantry.renameShopping, { id: row.id, name: "butter" }),
  ).toMatchObject({ status: "merge_required", targetId: butter });
  await glen.mutation(api.pantry.renameShopping, { id: row.id, name: "butter", mergeInto: butter });
  expect((await glen.query(api.pantry.shopping, {}))[0].ingredientId).toBe(butter);
  expect((await glen.query(api.pantry.page, firstPage)).page).toEqual([]);
});

test("legacy upgrade preserves independent stock and shopping, merges only known equivalents, and is repeatable", async () => {
  const { t, glen } = await setup();
  await t.run(async (ctx) => {
    const libraryId = (await ctx.db.query("libraries").first())!._id;
    await ctx.db.insert("pantryItems", {
      libraryId,
      key: "jeera",
      name: "jeera",
      present: true,
      updatedAt: 1,
    });
    await ctx.db.insert("pantryItems", {
      libraryId,
      key: "cumin seeds",
      name: "cumin seeds",
      present: false,
      updatedAt: 2,
    });
    await ctx.db.insert("pantryItems", {
      libraryId,
      key: "rice",
      name: "rice",
      present: false,
      updatedAt: 3,
    });
    await ctx.db.insert("shoppingItems", { libraryId, key: "jeera", name: "jeera", createdAt: 1 });
    await ctx.db.insert("shoppingItems", { libraryId, key: "rice", name: "rice", createdAt: 2 });
  });
  await glen.mutation(api.pantry.initialize, {});
  const pantry = await glen.query(api.pantry.page, firstPage);
  expect(pantry.page).toHaveLength(1);
  expect(await glen.query(api.pantry.shopping, {})).toHaveLength(2);
  await glen.mutation(api.pantry.initialize, {});
  expect(await glen.query(api.pantry.page, firstPage)).toEqual(pantry);
});

test("pantry pagination and search work beyond the old 300-item ceiling", async () => {
  const { t, glen } = await setup();
  await glen.mutation(api.pantry.initialize, {});
  await t.run(async (ctx) => {
    const libraryId = (await ctx.db.query("libraries").first())!._id;
    for (let i = 0; i < 320; i++)
      await ctx.db.insert("pantryItems", {
        libraryId,
        key: `item ${i}`,
        name: `Ingredient ${String(i).padStart(3, "0")}`,
        present: true,
        updatedAt: i,
      });
  });
  let result = await glen.query(api.pantry.page, firstPage);
  const ids = new Set(result.page.map((item) => item.id));
  while (!result.isDone) {
    result = await glen.query(api.pantry.page, {
      paginationOpts: { numItems: 60, cursor: result.continueCursor },
    });
    result.page.forEach((item) => ids.add(item.id));
  }
  expect(ids.size).toBe(320);
  await glen.mutation(api.pantry.setPresence, { name: "rice", present: true });
  expect(
    (await glen.query(api.pantry.page, { ...firstPage, search: "rice" })).page.map(
      (item) => item.name,
    ),
  ).toEqual(["rice"]);
});

test("signed-out and other libraries cannot read, rename, merge, bind, clear, or restore this kitchen", async () => {
  const { t, glen } = await setup();
  const ingredientId = await glen.mutation(api.pantry.setPresence, { name: "rice", present: true });
  const recipeId = await glen.mutation(api.recipes.create, {
    name: "Rice",
    tags: [],
    ingredients: [{ text: "rice" }],
  });
  await glen.mutation(api.pantry.addToShopping, { name: "rice" });
  const [row] = await glen.query(api.pantry.shopping, {});
  await expect(t.query(api.pantry.shopping, {})).rejects.toThrow("Sign in");
  await expect(t.mutation(api.pantry.clearShopping, {})).rejects.toThrow("Sign in");
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
  const other = t.withIdentity({ subject: "other" });
  expect(await other.query(api.pantry.shopping, {})).toEqual([]);
  await expect(other.query(api.pantry.matches, { recipeId })).rejects.toThrow("not found");
  await expect(other.mutation(api.pantry.rename, { ingredientId, name: "stolen" })).rejects.toThrow(
    "not found",
  );
  await expect(other.mutation(api.pantry.removeShopping, { id: row.id })).rejects.toThrow(
    "not found",
  );
  await expect(
    other.mutation(api.pantry.renameShopping, { id: row.id, name: "other" }),
  ).rejects.toThrow("not found");
  await expect(
    other.mutation(api.pantry.setRecipePresence, {
      recipeId,
      text: "rice",
      present: true,
      names: ["rice"],
    }),
  ).rejects.toThrow("not found");
  await expect(
    other.mutation(api.pantry.restoreShopping, { items: [{ name: "rice", ingredientId }] }),
  ).rejects.toThrow("not found");
  expect(await glen.query(api.pantry.shopping, {})).toHaveLength(1);
});

test("failed batches roll back, and stale recipe lines cannot acquire a binding", async () => {
  const { glen } = await setup();
  const recipeId = await glen.mutation(api.recipes.create, {
    name: "Soup",
    tags: [],
    ingredients: [{ text: "salt and pepper" }],
  });
  await expect(
    glen.mutation(api.pantry.setRecipePresence, {
      recipeId,
      text: "salt and pepper",
      present: true,
      names: ["salt", "dhania"],
    }),
  ).rejects.toThrow("specific");
  expect((await glen.query(api.pantry.page, firstPage)).page).toEqual([]);
  await expect(
    glen.mutation(api.pantry.setRecipePresence, {
      recipeId,
      text: "gone",
      present: true,
      names: ["salt"],
    }),
  ).rejects.toThrow("changed");
  await expect(
    glen.mutation(api.pantry.setPresence, { name: "a".repeat(121), present: true }),
  ).rejects.toThrow("120");
});
