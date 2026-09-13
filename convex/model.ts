import { v } from "convex/values";

const quantityMeasure = {
  amount: v.number(),
  maximum: v.optional(v.number()),
  approximate: v.optional(v.string()),
  unit: v.string(),
  tail: v.string(),
};
export const ingredientQuantity = v.object({
  version: v.literal(1),
  sourceText: v.string(),
  scalingText: v.optional(v.string()),
  status: v.union(v.literal("scalable"), v.literal("unmeasured"), v.literal("review")),
  parsed: v.optional(
    v.object({
      ...quantityMeasure,
      prefix: v.string(),
      label: v.string(),
      alternate: v.optional(v.object(quantityMeasure)),
      additions: v.optional(v.array(v.object(quantityMeasure))),
    }),
  ),
});
export const recipeLine = v.object({
  text: v.string(),
  group: v.optional(v.string()),
  sourceIds: v.optional(v.array(v.string())),
  quantity: v.optional(ingredientQuantity),
});
export const sourcePlatform = v.union(
  v.literal("instagram"),
  v.literal("youtube"),
  v.literal("tiktok"),
  v.literal("website"),
);
export const servingInfo = v.object({
  count: v.number(),
  origin: v.union(v.literal("source"), v.literal("estimated"), v.literal("user")),
  reason: v.optional(v.string()),
});
export const cookingPreference = v.object({
  adjustment: v.union(
    v.object({ mode: v.literal("original") }),
    v.object({ mode: v.literal("servings"), servings: v.number() }),
    v.object({
      mode: v.literal("ingredient"),
      ingredientText: v.string(),
      amount: v.number(),
      unit: v.string(),
    }),
  ),
  units: v.union(v.literal("original"), v.literal("metric"), v.literal("us")),
});
export const recipeContent = {
  name: v.string(),
  imageStorageId: v.optional(v.id("_storage")),
  tags: v.array(v.string()),
  note: v.optional(v.string()),
  ingredients: v.optional(v.array(recipeLine)),
  instructions: v.optional(v.array(recipeLine)),
  recipeNotes: v.optional(v.array(recipeLine)),
  servings: v.optional(v.string()),
  prepMinutes: v.optional(v.number()),
  cookMinutes: v.optional(v.number()),
  servingInfo: v.optional(servingInfo),
};
export const recipeMetadata = {
  importWarnings: v.optional(v.array(v.string())),
  // Optional only while migrating the pre-auth photo catalogue.
  libraryId: v.optional(v.id("libraries")),
  createdBy: v.optional(v.string()),
  origin: v.optional(v.union(v.literal("manual"), v.literal("imported"))),
  sourceUrl: v.optional(v.string()),
  sourceKey: v.optional(v.string()),
  sourcePlatform: v.optional(sourcePlatform),
  sourceAuthor: v.optional(v.string()),
  importId: v.optional(v.id("imports")),
  editedAt: v.optional(v.number()),
  lastCookedAt: v.optional(v.number()),
  cookCount: v.number(),
  isFavorite: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
};
export const recipeResult = v.object({
  _id: v.id("recipes"),
  _creationTime: v.number(),
  ...recipeContent,
  ...recipeMetadata,
  imageUrl: v.union(v.string(), v.null()),
});
export const importStatus = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("needs_review"),
  v.literal("failed"),
  v.literal("saved"),
);
export const importDraft = v.object({
  name: v.string(),
  tags: v.array(v.string()),
  ingredients: v.array(recipeLine),
  instructions: v.array(recipeLine),
  recipeNotes: v.optional(v.array(recipeLine)),
  servings: v.optional(v.string()),
  prepMinutes: v.optional(v.number()),
  cookMinutes: v.optional(v.number()),
  warnings: v.array(v.string()),
  servingInfo: v.optional(servingInfo),
});

export const importFailureCode = v.union(
  v.literal("wrong_link"),
  v.literal("not_recipe"),
  v.literal("insufficient"),
  v.literal("unavailable"),
);
