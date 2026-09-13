import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { ingredientIdentity, normalizeIngredientName } from "../../lib/pantry";
export type Reader = Pick<QueryCtx, "db">;
export type Ingredient = Doc<"pantryItems">;
export function label(text: string, max = 120) {
  const name = text.normalize("NFKC").trim().replace(/\s+/g, " ");
  // Reject control characters in user-entered labels.
  // eslint-disable-next-line no-control-regex
  if (!name || name.length > max || /[\u0000-\u001f\u007f]/.test(name))
    throw new ConvexError(`Enter a name of up to ${max} characters.`);
  return name;
}

// Merges retain redirects rather than rewriting every recipe in the library.
// A bounded traversal protects queries; normal renames never create redirects.
export async function root(ctx: Reader, item: Ingredient): Promise<Ingredient> {
  for (let depth = 0; item.mergedInto; depth++) {
    if (depth >= 32) throw new ConvexError("This ingredient needs its merge history compacted.");
    const next = await ctx.db.get(item.mergedInto);
    if (!next || next.libraryId !== item.libraryId) throw new ConvexError("Ingredient not found.");
    item = next;
  }
  return item;
}
export async function byId(ctx: Reader, libraryId: Id<"libraries">, id: Id<"pantryItems">) {
  const item = await ctx.db.get(id);
  if (!item || item.libraryId !== libraryId) throw new ConvexError("Ingredient not found.");
  return root(ctx, item);
}
export async function lookup(ctx: Reader, libraryId: Id<"libraries">, text: string) {
  const identity = ingredientIdentity(text);
  // Explicit learned aliases take precedence, including a user's chosen label.
  for (const key of new Set([normalizeIngredientName(text), ...(identity ? [identity.key] : [])])) {
    const alias = await ctx.db
      .query("ingredientAliases")
      .withIndex("by_library_key", (q) => q.eq("libraryId", libraryId).eq("key", key))
      .unique();
    if (alias) return byId(ctx, libraryId, alias.ingredientId);
    const item = await ctx.db
      .query("pantryItems")
      .withIndex("by_library_key", (q) => q.eq("libraryId", libraryId).eq("key", key))
      .unique();
    if (item) return root(ctx, item);
  }
  return null;
}
export async function remember(
  ctx: MutationCtx,
  libraryId: Id<"libraries">,
  key: string,
  ingredientId: Id<"pantryItems">,
) {
  const existing = await ctx.db
    .query("ingredientAliases")
    .withIndex("by_library_key", (q) => q.eq("libraryId", libraryId).eq("key", key))
    .unique();
  if (existing) {
    const owner = await byId(ctx, libraryId, existing.ingredientId);
    if (owner._id !== ingredientId)
      throw new ConvexError("That name already belongs to another ingredient. Merge them first.");
  } else await ctx.db.insert("ingredientAliases", { libraryId, key, ingredientId });
}
export async function ensureIngredient(ctx: MutationCtx, libraryId: Id<"libraries">, text: string) {
  const name = label(text);
  const existing = await lookup(ctx, libraryId, name);
  if (existing) return existing;
  const identity = ingredientIdentity(name);
  const key = identity?.key ?? normalizeIngredientName(name);
  const id = await ctx.db.insert("pantryItems", {
    libraryId,
    key,
    name: identity?.name ?? name,
    present: false,
    updatedAt: Date.now(),
  });
  await remember(ctx, libraryId, key, id);
  return (await ctx.db.get(id))!;
}
export async function stock(ctx: MutationCtx, item: Ingredient, present: boolean) {
  if (item.present !== present) await ctx.db.patch(item._id, { present, updatedAt: Date.now() });
}
