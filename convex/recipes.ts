import { ConvexError, v } from "convex/values"
import { paginationOptsValidator } from "convex/server"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireMembership } from "./access"
import { recipeContent, recipeResult } from "./model"
import { canonicalizeRecipeTags } from "../lib/recipe-tags"

export function cleanContent<T extends { name: string; tags: string[]; note?: string; ingredients?: { text: string; group?: string }[]; instructions?: { text: string; group?: string }[]; recipeNotes?: { text: string; group?: string }[]; servings?: string; prepMinutes?: number; cookMinutes?: number }>(input: T): T {
  if (!input.name.trim() || input.name.length > 200) throw new ConvexError("Give the recipe a name of up to 200 characters.")
  if (input.tags.length > 20 || input.tags.some(t => t.length > 40)) throw new ConvexError("Use up to 20 short tags.")
  if ((input.note?.length ?? 0) > 5000) throw new ConvexError("Keep notes under 5,000 characters.")
  for (const lines of [input.ingredients, input.instructions, input.recipeNotes]) {
    if (lines && (lines.length > 100 || lines.some(l => !l.text.trim() || l.text.length > 3000))) throw new ConvexError("Use up to 100 non-empty recipe lines, each under 3,000 characters.")
    if (lines?.some(l => l.group !== undefined && (!l.group.trim() || l.group.length > 200))) throw new ConvexError("Use group headings of up to 200 characters.")
  }
  if ((input.servings?.length ?? 0) > 100) throw new ConvexError("Keep servings short.")
  for (const minutes of [input.prepMinutes, input.cookMinutes]) if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 0 || minutes > 10080)) throw new ConvexError("Enter a valid cooking time.")
  return { ...input, name: input.name.trim(), tags: canonicalizeRecipeTags(input.name, input.tags), note: input.note?.trim() || undefined }
}

async function result(ctx: Pick<QueryCtx, "storage">, recipe: Doc<"recipes">) {
  return { ...recipe, imageUrl: recipe.imageStorageId ? await ctx.storage.getUrl(recipe.imageStorageId) : null }
}
async function owned(ctx: Pick<QueryCtx, "auth" | "db">, id: Id<"recipes">) {
  const member = await requireMembership(ctx)
  const recipe = await ctx.db.get(id)
  if (!recipe || recipe.libraryId !== member.libraryId) throw new ConvexError("Recipe not found.")
  return { member, recipe }
}
async function consumeUpload(ctx: MutationCtx, storageId: Id<"_storage">, libraryId: Id<"libraries">, userId: string) {
  const upload = await ctx.db.query("uploads").withIndex("by_storage", q => q.eq("storageId", storageId)).unique()
  if (!upload || upload.consumed || upload.libraryId !== libraryId || upload.userId !== userId) throw new ConvexError("Upload this photo before saving the recipe.")
  await ctx.db.patch(upload._id, { consumed: true })
}

// Compatibility for existing small-library callers. New library UI uses listPage.
export const list = query({
  args: { search: v.optional(v.string()), tags: v.optional(v.array(v.string())) }, returns: v.array(recipeResult),
  handler: async (ctx, args) => {
    const member = await requireMembership(ctx)
    const recipes = await ctx.db.query("recipes").withIndex("by_library_created", q => q.eq("libraryId", member.libraryId)).order("desc").take(500)
    return Promise.all(recipes.filter(r => (!args.search || `${r.name} ${r.note ?? ""} ${r.tags.join(" ")}`.toLowerCase().includes(args.search.toLowerCase())) && (args.tags ?? []).every(t => r.tags.includes(t))).map(r => result(ctx, r)))
  },
})
export const listPage = query({
  args: { paginationOpts: paginationOptsValidator, search: v.optional(v.string()) },
  returns: v.object({ page: v.array(recipeResult), isDone: v.boolean(), continueCursor: v.string(), splitCursor: v.optional(v.union(v.string(), v.null())), pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())) }),
  handler: async (ctx, args) => {
    const member = await requireMembership(ctx)
    const page = args.search?.trim()
      ? await ctx.db.query("recipes").withSearchIndex("search_name", q => q.search("name", args.search!.trim()).eq("libraryId", member.libraryId)).paginate(args.paginationOpts)
      : await ctx.db.query("recipes").withIndex("by_library_created", q => q.eq("libraryId", member.libraryId)).order("desc").paginate(args.paginationOpts)
    return { ...page, page: await Promise.all(page.page.map(r => result(ctx, r))) }
  },
})
export const get = query({ args: { id: v.id("recipes") }, returns: v.union(recipeResult, v.null()), handler: async (ctx, { id }) => {
  const member = await requireMembership(ctx)
  const recipe = await ctx.db.get(id)
  return recipe?.libraryId === member.libraryId ? result(ctx, recipe) : null
}})
export const create = mutation({ args: recipeContent, returns: v.id("recipes"), handler: async (ctx, args) => {
  const member = await requireMembership(ctx)
  const content = cleanContent(args)
  if (args.imageStorageId) await consumeUpload(ctx, args.imageStorageId, member.libraryId, member.userId)
  const now = Date.now()
  return ctx.db.insert("recipes", { ...content, libraryId: member.libraryId, createdBy: member.userId, origin: "manual", cookCount: 0, isFavorite: false, createdAt: now, updatedAt: now })
}})
export const generateUploadUrl = mutation({ args: {}, returns: v.string(), handler: async ctx => {
  await requireMembership(ctx)
  return ctx.storage.generateUploadUrl()
}})
export const registerUpload = mutation({ args: { storageId: v.id("_storage") }, returns: v.null(), handler: async (ctx, { storageId }) => {
  const member = await requireMembership(ctx)
  const file = await ctx.db.system.get(storageId)
  if (!file || file.size > 350_000 || file.contentType !== "image/webp") throw new ConvexError("Use an optimized WebP image under 350 KB.")
  if (Date.now() - file._creationTime > 15 * 60_000) throw new ConvexError("This upload expired. Please upload the image again.")
  const existing = await ctx.db.query("uploads").withIndex("by_storage", q => q.eq("storageId", storageId)).unique()
  if (existing && (existing.consumed || existing.userId !== member.userId || existing.libraryId !== member.libraryId)) throw new ConvexError("Photo unavailable.")
  // Uploaded file IDs are random capabilities returned only to the uploader.
  if (!existing) await ctx.db.insert("uploads", { storageId, libraryId: member.libraryId, userId: member.userId, createdAt: Date.now() })
  return null
}})
export const update = mutation({
  args: { id: v.id("recipes"), name: v.optional(recipeContent.name), imageStorageId: recipeContent.imageStorageId, tags: v.optional(recipeContent.tags), note: recipeContent.note, ingredients: recipeContent.ingredients, instructions: recipeContent.instructions, recipeNotes: recipeContent.recipeNotes, servings: recipeContent.servings, prepMinutes: v.optional(v.union(v.number(), v.null())), cookMinutes: v.optional(v.union(v.number(), v.null())), isFavorite: v.optional(v.boolean()) },
  returns: v.null(), handler: async (ctx, { id, ...updates }) => {
    const { recipe, member } = await owned(ctx, id)
    const patch = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined).map(([key, value]) => [key, value === null ? undefined : value]))
    const cleaned = cleanContent({ ...recipe, ...patch })
    // Apply only requested fields, using the same normalization as creation.
    const normalizedPatch = Object.fromEntries(Object.keys(patch).map(key => [key, cleaned[key as keyof typeof cleaned]]))
    if (updates.imageStorageId && updates.imageStorageId !== recipe.imageStorageId) {
      await consumeUpload(ctx, updates.imageStorageId, member.libraryId, member.userId)
      if (recipe.imageStorageId) await ctx.storage.delete(recipe.imageStorageId)
    }
    const contentEdit = Object.keys(patch).some(k => k !== "isFavorite")
    await ctx.db.patch(id, { ...normalizedPatch, ...(contentEdit ? { editedAt: Date.now() } : {}), updatedAt: Date.now() })
    return null
  },
})
export const markCooked = mutation({ args: { id: v.id("recipes") }, returns: v.null(), handler: async (ctx, { id }) => {
  const { recipe } = await owned(ctx, id)
  await ctx.db.patch(id, { cookCount: recipe.cookCount + 1, lastCookedAt: Date.now(), updatedAt: Date.now() })
  return null
}})
export const listTags = query({ args: {}, returns: v.array(v.string()), handler: async ctx => {
  const member = await requireMembership(ctx)
  const recipes = await ctx.db.query("recipes").withIndex("by_library_created", q => q.eq("libraryId", member.libraryId)).take(1000)
  return [...new Set(recipes.flatMap(r => r.tags))].sort()
}})
export const remove = mutation({ args: { id: v.id("recipes") }, returns: v.null(), handler: async (ctx, { id }) => {
  const { recipe } = await owned(ctx, id)
  if (recipe.importId) {
    const job = await ctx.db.get(recipe.importId)
    if (job?.recipeId === id) await ctx.db.patch(job._id, { recipeId: undefined, imageStorageId: undefined, status: "needs_review", phase: "Ready to save again", updatedAt: Date.now() })
  }
  if (recipe.imageStorageId) await ctx.storage.delete(recipe.imageStorageId)
  await ctx.db.delete(id)
  return null
}})
