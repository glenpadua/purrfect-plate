import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { ingredientIdentity, normalizeIngredientName } from "../lib/pantry";
import { requireMembership } from "./access";
import { query, mutation } from "./_generated/server";
import {
  ingredientResult,
  shoppingResult,
  matchResult,
  renameResult,
  project,
} from "./pantry/model";
import {
  byId,
  lookup,
  label,
  stock,
  ensureIngredient,
  type Ingredient,
} from "./pantry/ingredients";
import { MAX_SHOPPING, shoppingRows, queue } from "./pantry/shopping";
import { writableLibrary, renameIngredient } from "./pantry/maintenance";
import { recipe, resolveLine } from "./pantry/recipes";

export const initialized = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const { libraryId } = await requireMembership(ctx);
    return (await ctx.db.get(libraryId))?.pantryVersion === 2;
  },
});
export const initialize = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await writableLibrary(ctx);
    return null;
  },
});

export const page = query({
  args: { paginationOpts: paginationOptsValidator, search: v.optional(v.string()) },
  returns: v.object({
    page: v.array(ingredientResult),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null()),
    ),
  }),
  handler: async (ctx, args) => {
    const { libraryId } = await requireMembership(ctx);
    const requestedSearch = args.search?.trim();
    const exact = requestedSearch ? await lookup(ctx, libraryId, requestedSearch) : null;
    const search = exact?.present ? exact.name : requestedSearch;
    const result = search
      ? await ctx.db
          .query("pantryItems")
          .withSearchIndex("search_name", (q) =>
            q.search("name", search).eq("libraryId", libraryId).eq("present", true),
          )
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("pantryItems")
          .withIndex("by_library_present_name", (q) =>
            q.eq("libraryId", libraryId).eq("present", true),
          )
          .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(project) };
  },
});
export const shopping = query({
  args: {},
  returns: v.array(shoppingResult),
  handler: async (ctx) => {
    const { libraryId } = await requireMembership(ctx);
    return Promise.all(
      (await shoppingRows(ctx, libraryId))
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(async (row) => {
          const item = row.ingredientId ? await byId(ctx, libraryId, row.ingredientId) : null;
          return {
            id: row._id,
            key: row.key,
            createdAt: row.createdAt,
            name: item?.name ?? row.name,
            ...(item ? { ingredientId: item._id } : {}),
          };
        }),
    );
  },
});
export const suggestions = query({
  args: { search: v.string() },
  returns: v.array(ingredientResult),
  handler: async (ctx, { search }) => {
    const { libraryId } = await requireMembership(ctx);
    if (!search.trim()) return [];
    const exact = await lookup(ctx, libraryId, search);
    const items = await ctx.db
      .query("pantryItems")
      .withSearchIndex("search_name", (q) => q.search("name", search).eq("libraryId", libraryId))
      .take(12);
    const unique = new Map(
      items.filter((item) => !item.mergedInto).map((item) => [item._id, item]),
    );
    if (exact) unique.set(exact._id, exact);
    return [...unique.values()].map(project);
  },
});
export const setPresence = mutation({
  args: {
    name: v.optional(v.string()),
    ingredientId: v.optional(v.id("pantryItems")),
    present: v.boolean(),
  },
  returns: v.id("pantryItems"),
  handler: async (ctx, args) => {
    const libraryId = await writableLibrary(ctx);
    if (!args.name && !args.ingredientId) throw new ConvexError("Choose an ingredient.");
    const item = args.ingredientId
      ? await byId(ctx, libraryId, args.ingredientId)
      : await ensureIngredient(ctx, libraryId, args.name!);
    await stock(ctx, item, args.present);
    return item._id;
  },
});
export const addToShopping = mutation({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, { name: raw }) => {
    const libraryId = await writableLibrary(ctx);
    const name = label(raw, 3000);
    const item =
      (await lookup(ctx, libraryId, name)) ??
      (ingredientIdentity(name) ? await ensureIngredient(ctx, libraryId, name) : null);
    await queue(ctx, libraryId, name, item);
    return null;
  },
});
export const removeShopping = mutation({
  args: { id: v.id("shoppingItems") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const libraryId = await writableLibrary(ctx);
    const row = await ctx.db.get(id);
    if (row && row.libraryId !== libraryId) throw new ConvexError("Shopping item not found.");
    if (row) await ctx.db.delete(id);
    return null;
  },
});
// Return precisely the deleted snapshot so Undo never overwrites additions made
// by the other member in the meantime. Restoring resolves any intervening rename.
const restoreItem = v.object({
  name: v.string(),
  ingredientId: v.optional(v.id("pantryItems")),
  createdAt: v.optional(v.number()),
});
export const clearShopping = mutation({
  args: {},
  returns: v.array(restoreItem),
  handler: async (ctx) => {
    const libraryId = await writableLibrary(ctx);
    const rows = await shoppingRows(ctx, libraryId);
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.map((row) => ({
      name: row.name,
      createdAt: row.createdAt,
      ...(row.ingredientId ? { ingredientId: row.ingredientId } : {}),
    }));
  },
});
export const restoreShopping = mutation({
  args: { items: v.array(restoreItem) },
  returns: v.null(),
  handler: async (ctx, { items }) => {
    const libraryId = await writableLibrary(ctx);
    if (items.length > MAX_SHOPPING) throw new ConvexError("Too many items to restore.");
    const shoppingKeys = new Set((await shoppingRows(ctx, libraryId)).map((row) => row.key));
    for (const row of items) {
      const name = label(row.name, 3000);
      const item = row.ingredientId
        ? await byId(ctx, libraryId, row.ingredientId)
        : await lookup(ctx, libraryId, name);
      await queue(
        ctx,
        libraryId,
        name,
        item,
        shoppingKeys,
        row.createdAt !== undefined && Number.isFinite(row.createdAt) ? row.createdAt : undefined,
      );
    }
    return null;
  },
});
export const rename = mutation({
  args: {
    ingredientId: v.id("pantryItems"),
    name: v.string(),
    mergeInto: v.optional(v.id("pantryItems")),
  },
  returns: renameResult,
  handler: async (ctx, args) => {
    return renameIngredient(
      ctx,
      await writableLibrary(ctx),
      args.ingredientId,
      args.name,
      args.mergeInto,
    );
  },
});
export const renameShopping = mutation({
  args: { id: v.id("shoppingItems"), name: v.string(), mergeInto: v.optional(v.id("pantryItems")) },
  returns: renameResult,
  handler: async (ctx, args) => {
    const libraryId = await writableLibrary(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.libraryId !== libraryId) throw new ConvexError("Shopping item not found.");
    if (row.ingredientId)
      return renameIngredient(ctx, libraryId, row.ingredientId, args.name, args.mergeInto);
    const name = label(args.name, 3000);
    const found = await lookup(ctx, libraryId, name);
    if (found && args.mergeInto !== found._id)
      return { status: "merge_required" as const, targetId: found._id, targetName: found.name };
    if (args.mergeInto && found?._id !== args.mergeInto)
      throw new ConvexError("That ingredient changed. Save the name again.");
    const item =
      found ?? (ingredientIdentity(name) ? await ensureIngredient(ctx, libraryId, name) : null);
    await ctx.db.delete(row._id);
    await queue(ctx, libraryId, name, item);
    return { status: "saved" as const };
  },
});

export const matches = query({
  args: { recipeId: v.id("recipes") },
  returns: v.array(matchResult),
  handler: async (ctx, { recipeId }) => {
    const { libraryId } = await requireMembership(ctx);
    const r = await recipe(ctx, libraryId, recipeId);
    const shopping = await shoppingRows(ctx, libraryId);
    return Promise.all(
      (r.ingredients ?? []).map(async ({ text }) => {
        const match = await resolveLine(ctx, libraryId, recipeId, text);
        return {
          text,
          chosen: match.chosen,
          resolved: match.resolved,
          present: match.items.length > 0 && match.items.every((item) => item.present),
          names: match.names,
          ingredientIds: match.items.map((item) => item._id),
          onShoppingList: shopping.some(
            (row) =>
              match.items.some((item) => item._id === row.ingredientId) ||
              row.key === `text:${normalizeIngredientName(text)}`,
          ),
        };
      }),
    );
  },
});
export const setRecipePresence = mutation({
  args: {
    recipeId: v.id("recipes"),
    text: v.string(),
    present: v.boolean(),
    names: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const libraryId = await writableLibrary(ctx);
    const r = await recipe(ctx, libraryId, args.recipeId);
    if (!r.ingredients?.some((line) => line.text === args.text))
      throw new ConvexError("This ingredient line changed. Reload the recipe.");
    let match = await resolveLine(ctx, libraryId, args.recipeId, args.text);
    if (args.names) {
      if (!args.names.length || args.names.length > 10)
        throw new ConvexError("Choose between one and ten ingredients.");
      const items: Ingredient[] = [];
      for (const name of args.names) {
        const existing = await lookup(ctx, libraryId, name);
        if (!existing && !ingredientIdentity(name))
          throw new ConvexError(
            "Use a specific name, such as coriander seeds or coriander leaves.",
          );
        items.push(existing ?? (await ensureIngredient(ctx, libraryId, name)));
      }
      const ingredientIds = [...new Set(items.map((item) => item._id))];
      const existing = await ctx.db
        .query("recipeIngredientBindings")
        .withIndex("by_recipe_text", (q) => q.eq("recipeId", args.recipeId).eq("text", args.text))
        .unique();
      if (existing) await ctx.db.patch(existing._id, { ingredientIds });
      else
        await ctx.db.insert("recipeIngredientBindings", {
          libraryId,
          recipeId: args.recipeId,
          text: args.text,
          ingredientIds,
        });
      match = { items, names: items.map((item) => item.name), resolved: true, chosen: true };
    }
    if (!match.resolved) throw new ConvexError("Choose the ingredient you mean first.");
    const items = match.items.length
      ? match.items
      : [await ensureIngredient(ctx, libraryId, match.names[0])];
    for (const item of items) await stock(ctx, item, args.present);
    return null;
  },
});
export const addMissing = mutation({
  args: { recipeId: v.id("recipes") },
  returns: v.number(),
  handler: async (ctx, { recipeId }) => {
    const libraryId = await writableLibrary(ctx);
    const r = await recipe(ctx, libraryId, recipeId);
    let added = 0;
    const shoppingKeys = new Set((await shoppingRows(ctx, libraryId)).map((row) => row.key));
    for (const line of r.ingredients ?? []) {
      const match = await resolveLine(ctx, libraryId, recipeId, line.text);
      if (!match.resolved) {
        if (await queue(ctx, libraryId, line.text, null, shoppingKeys)) added++;
        continue;
      }
      const items = match.items.length
        ? match.items
        : [await ensureIngredient(ctx, libraryId, match.names[0])];
      for (const item of items)
        if (!item.present && (await queue(ctx, libraryId, item.name, item, shoppingKeys))) added++;
    }
    return added;
  },
});
export const coverage = query({
  args: { recipeIds: v.array(v.id("recipes")) },
  returns: v.array(v.object({ recipeId: v.id("recipes"), present: v.number(), total: v.number() })),
  handler: async (ctx, { recipeIds }) => {
    const { libraryId } = await requireMembership(ctx);
    if (recipeIds.length > 100) throw new ConvexError("Check up to 100 recipes at a time.");
    return Promise.all(
      recipeIds.map(async (recipeId) => {
        const r = await ctx.db.get(recipeId);
        // A recipe can disappear while a subscribed library batch is still mounted.
        if (!r || r.libraryId !== libraryId) return { recipeId, present: 0, total: 0 };
        let present = 0;
        for (const line of r.ingredients ?? []) {
          const match = await resolveLine(ctx, libraryId, recipeId, line.text);
          if (match.items.length && match.items.every((item) => item.present)) present++;
        }
        return { recipeId, present, total: r.ingredients?.length ?? 0 };
      }),
    );
  },
});
