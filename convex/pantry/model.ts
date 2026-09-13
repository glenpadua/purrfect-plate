import { v } from "convex/values";
import type { Ingredient } from "./ingredients";
export const ingredientResult = v.object({
  id: v.id("pantryItems"),
  key: v.string(),
  name: v.string(),
  present: v.boolean(),
  updatedAt: v.number(),
});
export const shoppingResult = v.object({
  id: v.id("shoppingItems"),
  key: v.string(),
  name: v.string(),
  ingredientId: v.optional(v.id("pantryItems")),
  createdAt: v.number(),
});
export const matchResult = v.object({
  text: v.string(),
  chosen: v.boolean(),
  resolved: v.boolean(),
  present: v.boolean(),
  names: v.array(v.string()),
  ingredientIds: v.array(v.id("pantryItems")),
  onShoppingList: v.boolean(),
});
export const renameResult = v.union(
  v.object({ status: v.literal("saved") }),
  v.object({
    status: v.literal("merge_required"),
    targetId: v.id("pantryItems"),
    targetName: v.string(),
  }),
);
export const project = (item: Ingredient) => ({
  id: item._id,
  key: item.key,
  name: item.name,
  present: item.present,
  updatedAt: item.updatedAt,
});
