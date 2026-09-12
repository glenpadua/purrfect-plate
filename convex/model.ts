import { v } from "convex/values"

export const recipeLine = v.object({ text: v.string(), group: v.optional(v.string()), sourceIds: v.optional(v.array(v.string())) })
export const sourcePlatform = v.union(v.literal("instagram"), v.literal("youtube"), v.literal("tiktok"), v.literal("website"))
export const recipeContent = {
  name: v.string(), imageStorageId: v.optional(v.id("_storage")), tags: v.array(v.string()), note: v.optional(v.string()),
  ingredients: v.optional(v.array(recipeLine)), instructions: v.optional(v.array(recipeLine)),
  recipeNotes: v.optional(v.array(recipeLine)),
  servings: v.optional(v.string()), prepMinutes: v.optional(v.number()), cookMinutes: v.optional(v.number()),
}
export const recipeMetadata = {
  importWarnings: v.optional(v.array(v.string())),
  // Optional only while migrating the pre-auth photo catalogue.
  libraryId: v.optional(v.id("libraries")), createdBy: v.optional(v.string()),
  origin: v.optional(v.union(v.literal("manual"), v.literal("imported"))),
  sourceUrl: v.optional(v.string()), sourceKey: v.optional(v.string()), sourcePlatform: v.optional(sourcePlatform),
  sourceAuthor: v.optional(v.string()), importId: v.optional(v.id("imports")), editedAt: v.optional(v.number()),
  lastCookedAt: v.optional(v.number()), cookCount: v.number(), isFavorite: v.boolean(), createdAt: v.number(), updatedAt: v.number(),
}
export const recipeResult = v.object({ _id: v.id("recipes"), _creationTime: v.number(), ...recipeContent, ...recipeMetadata, imageUrl: v.union(v.string(), v.null()) })
export const importStatus = v.union(v.literal("queued"), v.literal("processing"), v.literal("needs_review"), v.literal("failed"), v.literal("saved"))
export const importDraft = v.object({
  name: v.string(), tags: v.array(v.string()), ingredients: v.array(recipeLine), instructions: v.array(recipeLine),
  recipeNotes: v.optional(v.array(recipeLine)),
  servings: v.optional(v.string()), prepMinutes: v.optional(v.number()), cookMinutes: v.optional(v.number()), warnings: v.array(v.string()),
})

export const importFailureCode = v.union(v.literal("wrong_link"), v.literal("not_recipe"), v.literal("insufficient"), v.literal("unavailable"))
