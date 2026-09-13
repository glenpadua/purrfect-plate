import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireMembership } from "../access";
import { ingredientIdentity, normalizeIngredientName } from "../../lib/pantry";
import {
  stock,
  remember,
  lookup,
  byId,
  label,
  ensureIngredient,
  type Ingredient,
} from "./ingredients";
import { shoppingRows, queue } from "./shopping";
async function merge(
  ctx: MutationCtx,
  libraryId: Id<"libraries">,
  source: Ingredient,
  target: Ingredient,
) {
  if (source._id === target._id) return;
  await stock(ctx, target, source.present || target.present);
  await ctx.db.patch(source._id, { present: false, mergedInto: target._id, updatedAt: Date.now() });
  // Only the short-lived list is reconciled eagerly. Recipe references follow redirects.
  for (const row of await shoppingRows(ctx, libraryId)) {
    if (row.ingredientId === source._id) {
      await ctx.db.delete(row._id);
      await queue(ctx, libraryId, target.name, target);
    }
  }
}

// Idempotent upgrade from the previous capped (300-entry) pantry. Stock and
// shopping intent are preserved independently; old shopping never implies stock.
async function initializeLibrary(ctx: MutationCtx, libraryId: Id<"libraries">) {
  const library = await ctx.db.get(libraryId);
  if (library?.pantryVersion === 2) return;
  const old = await ctx.db
    .query("pantryItems")
    .withIndex("by_library_key", (q) => q.eq("libraryId", libraryId))
    .take(301);
  if (old.length > 300)
    throw new ConvexError("The legacy pantry needs a paginated upgrade before continuing.");
  const groups = new Map<string, Ingredient>();
  for (const row of old) {
    const key = ingredientIdentity(row.name)?.key ?? normalizeIngredientName(row.name);
    const target = groups.get(key);
    if (target) {
      await merge(ctx, libraryId, row, (await ctx.db.get(target._id))!);
      await remember(ctx, libraryId, row.key, target._id);
    } else {
      groups.set(key, row);
      await remember(ctx, libraryId, row.key, row._id);
      if (key !== row.key) await remember(ctx, libraryId, key, row._id);
    }
  }
  const previousShopping = await shoppingRows(ctx, libraryId);
  for (const row of previousShopping) await ctx.db.delete(row._id);
  const shoppingKeys = new Set<string>();
  for (const row of previousShopping) {
    const found = await lookup(ctx, libraryId, row.name);
    const item =
      found ??
      (ingredientIdentity(row.name) ? await ensureIngredient(ctx, libraryId, row.name) : null);
    await queue(ctx, libraryId, row.name, item, shoppingKeys, row.createdAt);
  }
  await ctx.db.patch(libraryId, { pantryVersion: 2 });
}
export async function writableLibrary(ctx: MutationCtx) {
  const { libraryId } = await requireMembership(ctx);
  await initializeLibrary(ctx, libraryId);
  return libraryId;
}
export async function renameIngredient(
  ctx: MutationCtx,
  libraryId: Id<"libraries">,
  id: Id<"pantryItems">,
  raw: string,
  mergeInto?: Id<"pantryItems">,
) {
  const item = await byId(ctx, libraryId, id);
  const name = label(raw);
  const target = await lookup(ctx, libraryId, name);
  if (target && target._id !== item._id) {
    if (mergeInto !== target._id)
      return { status: "merge_required" as const, targetId: target._id, targetName: target.name };
    await merge(ctx, libraryId, item, target);
  } else {
    if (mergeInto)
      throw new ConvexError("That ingredient changed. Save the name again to review the match.");
    await remember(ctx, libraryId, normalizeIngredientName(item.name), item._id);
    await remember(ctx, libraryId, normalizeIngredientName(name), item._id);
    const identity = ingredientIdentity(name);
    if (identity) await remember(ctx, libraryId, identity.key, item._id);
    await ctx.db.patch(item._id, { name, updatedAt: Date.now() });
  }
  return { status: "saved" as const };
}
