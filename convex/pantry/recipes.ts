import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { byId, lookup, type Reader } from "./ingredients";
import { ingredientIdentity } from "../../lib/pantry";
export async function recipe(ctx: Reader, libraryId: Id<"libraries">, recipeId: Id<"recipes">) {
  const item = await ctx.db.get(recipeId);
  if (!item || item.libraryId !== libraryId) throw new ConvexError("Recipe not found.");
  return item;
}
export async function resolveLine(
  ctx: Reader,
  libraryId: Id<"libraries">,
  recipeId: Id<"recipes">,
  text: string,
) {
  const binding = await ctx.db
    .query("recipeIngredientBindings")
    .withIndex("by_recipe_text", (q) => q.eq("recipeId", recipeId).eq("text", text))
    .unique();
  if (binding) {
    const items = await Promise.all(binding.ingredientIds.map((id) => byId(ctx, libraryId, id)));
    const unique = [...new Map(items.map((item) => [item._id, item])).values()];
    return { items: unique, names: unique.map((item) => item.name), resolved: true, chosen: true };
  }
  const identity = ingredientIdentity(text);
  // Bare ambiguous terms need a recipe-specific choice, even if someone has
  // entered the generic term in pantry. An explicit binding is authoritative.
  if (!identity) return { items: [], names: [], resolved: false, chosen: false };
  const item = await lookup(ctx, libraryId, text);
  return {
    items: item ? [item] : [],
    names: [item?.name ?? identity.name],
    resolved: true,
    chosen: false,
  };
}
