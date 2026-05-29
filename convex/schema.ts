import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  recipes: defineTable({
    name: v.string(),
    imageUrl: v.string(),
    tags: v.array(v.string()),
    note: v.optional(v.string()),
    lastCookedAt: v.optional(v.number()),
    cookCount: v.number(),
    isFavorite: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_updated_at", ["updatedAt"]),
})
