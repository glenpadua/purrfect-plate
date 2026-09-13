import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { Reader, Ingredient } from "./ingredients";
import { normalizeIngredientName } from "../../lib/pantry";
export const MAX_SHOPPING = 300;
export async function shoppingRows(ctx: Reader, libraryId: Id<"libraries">) {
  const items = await ctx.db
    .query("shoppingItems")
    .withIndex("by_library_key", (q) => q.eq("libraryId", libraryId))
    .take(MAX_SHOPPING + 1);
  if (items.length > MAX_SHOPPING)
    throw new ConvexError(
      "The shopping list exceeds its supported size. Remove some items before continuing.",
    );
  return items;
}
export async function queue(
  ctx: MutationCtx,
  libraryId: Id<"libraries">,
  name: string,
  ingredient?: Ingredient | null,
  knownKeys?: Set<string>,
  createdAt?: number,
) {
  const key = ingredient ? `ingredient:${ingredient._id}` : `text:${normalizeIngredientName(name)}`;
  const keys = knownKeys ?? new Set((await shoppingRows(ctx, libraryId)).map((row) => row.key));
  if (keys.has(key)) return false;
  if (keys.size >= MAX_SHOPPING)
    throw new ConvexError("Your shopping list is full. Copy or clear it before adding more.");
  await ctx.db.insert("shoppingItems", {
    libraryId,
    key,
    name: ingredient?.name ?? name,
    ...(ingredient ? { ingredientId: ingredient._id } : {}),
    createdAt: createdAt ?? Date.now() + keys.size / 1000,
  });
  keys.add(key);
  return true;
}
