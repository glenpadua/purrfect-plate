import { v } from "convex/values"
import { internalMutation } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { canonicalizeRecipeTags } from "../lib/recipe-tags"

/** Admin-only audited cleanup. Replacement tags are always derived server-side. */
export const canonicalizeBatch = internalMutation({
  args: {
    recipes: v.array(v.object({
      id: v.id("recipes"), expectedTags: v.array(v.string()), expectedUpdatedAt: v.number(),
    })),
  },
  returns: v.object({ changed: v.array(v.id("recipes")), skipped: v.array(v.id("recipes")) }),
  handler: async (ctx, { recipes }) => {
    if (recipes.length > 100) throw new Error("Use at most 100 recipe snapshots per cleanup batch.")
    const changed: Id<"recipes">[] = []
    const skipped: Id<"recipes">[] = []
    for (const snapshot of recipes) {
      const recipe = await ctx.db.get("recipes", snapshot.id)
      if (!recipe || recipe.updatedAt !== snapshot.expectedUpdatedAt ||
        JSON.stringify(recipe.tags) !== JSON.stringify(snapshot.expectedTags)) {
        skipped.push(snapshot.id)
        continue
      }
      const tags = canonicalizeRecipeTags(recipe.name, recipe.tags)
      if (JSON.stringify(tags) === JSON.stringify(recipe.tags)) {
        skipped.push(recipe._id)
        continue
      }
      await ctx.db.patch("recipes", recipe._id, { tags, updatedAt: Date.now() })
      changed.push(recipe._id)
    }
    return { changed, skipped }
  },
})
