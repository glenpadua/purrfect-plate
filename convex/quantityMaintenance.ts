import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { withIngredientQuantity } from "../lib/cooking";

const comparable = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );

/** Bounded, repeatable backfill. Original lines and user corrections are retained. */
export const backfill = internalMutation({
  args: {
    table: v.union(v.literal("recipes"), v.literal("imports")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({ cursor: v.string(), done: v.boolean(), updated: v.number() }),
  handler: async (ctx, { table, cursor }) => {
    let updated = 0;
    if (table === "recipes") {
      const page = await ctx.db.query("recipes").paginate({ cursor, numItems: 50 });
      for (const recipe of page.page) {
        if (!recipe.ingredients) continue;
        const ingredients = recipe.ingredients.map(withIngredientQuantity);
        if (comparable(ingredients) === comparable(recipe.ingredients)) continue;
        await ctx.db.patch(recipe._id, { ingredients });
        updated++;
      }
      return { cursor: page.continueCursor, done: page.isDone, updated };
    }
    const page = await ctx.db.query("imports").paginate({ cursor, numItems: 50 });
    for (const job of page.page) {
      if (!job.draft) continue;
      const ingredients = job.draft.ingredients.map(withIngredientQuantity);
      if (comparable(ingredients) === comparable(job.draft.ingredients)) continue;
      await ctx.db.patch(job._id, { draft: { ...job.draft, ingredients } });
      updated++;
    }
    return { cursor: page.continueCursor, done: page.isDone, updated };
  },
});
