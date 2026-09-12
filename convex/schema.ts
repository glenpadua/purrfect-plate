import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { importFailureCode, importDraft, importStatus, recipeContent, recipeMetadata, sourcePlatform } from "./model"

export default defineSchema({
  migrationRecords: defineTable({ legacyId: v.string(), recipeId: v.id("recipes") }).index("by_legacy", ["legacyId"]),
  libraries: defineTable({ name: v.string(), slug: v.string(), createdAt: v.number() }).index("by_slug", ["slug"]),
  memberships: defineTable({ libraryId: v.id("libraries"), userId: v.string(), email: v.string(), role: v.union(v.literal("owner"), v.literal("member")), createdAt: v.number() })
    .index("by_user", ["userId"]).index("by_library_user", ["libraryId", "userId"]),
  libraryInvites: defineTable({ libraryId: v.id("libraries"), email: v.string(), role: v.union(v.literal("owner"), v.literal("member")) }).index("by_email", ["email"]),
  pantryItems: defineTable({ libraryId: v.id("libraries"), key: v.string(), name: v.string(), present: v.boolean(), updatedAt: v.number() })
    .index("by_library_key", ["libraryId", "key"]),
  shoppingItems: defineTable({ libraryId: v.id("libraries"), key: v.string(), name: v.string(), createdAt: v.number() })
    .index("by_library_key", ["libraryId", "key"]),
  recipes: defineTable({ ...recipeContent, ...recipeMetadata })
    .index("by_created_at", ["createdAt"]).index("by_updated_at", ["updatedAt"])
    .index("by_library_created", ["libraryId", "createdAt"])
    .index("by_library_source", ["libraryId", "sourceKey"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["libraryId"] }),
  uploads: defineTable({ libraryId: v.id("libraries"), userId: v.string(), storageId: v.id("_storage"), createdAt: v.number(), consumed: v.optional(v.boolean()) }).index("by_storage", ["storageId"]),
  importUsage: defineTable({ libraryId: v.id("libraries"), day: v.string(), count: v.number() }).index("by_library_day", ["libraryId", "day"]),
  imports: defineTable({
    libraryId: v.id("libraries"), createdBy: v.string(), url: v.string(), sourceKey: v.string(), platform: sourcePlatform,
    relevanceOverride: v.optional(v.boolean()), status: importStatus, phase: v.string(), attempt: v.number(), createdAt: v.number(), updatedAt: v.number(),
    lease: v.optional(v.string()), leaseExpiresAt: v.optional(v.number()), dismissedAt: v.optional(v.number()),
    draft: v.optional(importDraft), evidenceJson: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")), author: v.optional(v.string()),
    recipeId: v.optional(v.id("recipes")), error: v.optional(v.string()), failureCode: v.optional(importFailureCode), searchQuery: v.optional(v.string()),
  }).index("by_library_created", ["libraryId", "createdAt"])
    .index("by_library_dismissed_created", ["libraryId", "dismissedAt", "createdAt"])
    .index("by_library_source", ["libraryId", "sourceKey"])
    .index("by_library_status", ["libraryId", "status"])
    .index("by_status_updated", ["status", "updatedAt"]),
})
