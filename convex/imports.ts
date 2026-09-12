import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation, mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { requireMembership } from "./access"
import { importFailureCode, importDraft, importStatus, sourcePlatform } from "./model"
import { cleanContent } from "./recipes"
import { sourceKey } from "../lib/recipe-import/source-key"
import { platformFor } from "../lib/recipe-import/extraction/types"
import { checkImportTarget } from "../lib/recipe-import/guardrails"

const summary = v.object({ id: v.id("imports"), url: v.string(), platform: sourcePlatform, status: importStatus, phase: v.string(), createdAt: v.number(), updatedAt: v.number(), attempt: v.number(), recipeId: v.optional(v.id("recipes")), error: v.optional(v.string()), failureCode: v.optional(importFailureCode), searchQuery: v.optional(v.string()), name: v.optional(v.string()) })
function machine(secret: string) {
  if (!process.env.IMPORT_WORKER_SECRET || secret !== process.env.IMPORT_WORKER_SECRET) throw new ConvexError("Unauthorized")
}
async function quota(ctx: MutationCtx, libraryId: Id<"libraries">) {
  const day = new Date().toISOString().slice(0, 10)
  const usage = await ctx.db.query("importUsage").withIndex("by_library_day", q => q.eq("libraryId", libraryId).eq("day", day)).unique()
  if ((usage?.count ?? 0) >= 30) throw new ConvexError("This library has reached its 30 imports for today. Try again tomorrow.")
  const processing = await ctx.db.query("imports").withIndex("by_library_status", q => q.eq("libraryId", libraryId).eq("status", "processing")).take(2)
  const queued = await ctx.db.query("imports").withIndex("by_library_status", q => q.eq("libraryId", libraryId).eq("status", "queued")).take(2)
  if (processing.length + queued.length >= 2) throw new ConvexError("Two imports are already running. Let one finish first.")
  if (usage) await ctx.db.patch(usage._id, { count: usage.count + 1 })
  else await ctx.db.insert("importUsage", { libraryId, day, count: 1 })
}
export const start = mutation({
  args: { url: v.string() }, returns: v.id("imports"),
  handler: async (ctx, args) => {
    const member = await requireMembership(ctx)
    let url: URL
    try { url = new URL(args.url.trim()) } catch { throw new ConvexError("Paste a complete recipe link.") }
    if (args.url.length > 2048 || url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new ConvexError("Use a public HTTPS recipe link.")
    try { checkImportTarget(url.href) } catch (error) { throw new ConvexError(error instanceof Error ? error.message : "Use a specific recipe link.") }
    url.hash = ""
    const key = sourceKey(url.href)
    const existing = await ctx.db.query("imports").withIndex("by_library_source", q => q.eq("libraryId", member.libraryId).eq("sourceKey", key)).unique()
    if (existing) return existing._id
    await quota(ctx, member.libraryId)
    const now = Date.now()
    const id = await ctx.db.insert("imports", { libraryId: member.libraryId, createdBy: member.userId, url: url.href, sourceKey: key, platform: platformFor(url), status: "queued", phase: "Queued for import", attempt: 1, createdAt: now, updatedAt: now })
    await ctx.scheduler.runAfter(0, internal.importWorker.dispatch, { id, attempt: 1 })
    return id
  },
})
export const retry = mutation({
  args: { id: v.id("imports"), continueAnyway: v.optional(v.boolean()) }, returns: v.null(),
  handler: async (ctx, { id, continueAnyway }) => {
    const member = await requireMembership(ctx)
    const job = await ctx.db.get(id)
    if (!job || job.libraryId !== member.libraryId) throw new ConvexError("Import not found.")
    if (job.status !== "failed") return null
    if (continueAnyway && job.failureCode !== "not_recipe") throw new ConvexError("Only a relevance check can be overridden.")
    if (job.attempt % 3 === 0 && Date.now() - job.updatedAt < 15 * 60_000) throw new ConvexError("This link has failed three times. Wait 15 minutes before trying again.")
    await quota(ctx, member.libraryId)
    const attempt = job.attempt + 1
    await ctx.db.patch(id, { relevanceOverride: continueAnyway || job.relevanceOverride || undefined, status: "queued", phase: "Queued to retry", attempt, error: undefined, failureCode: undefined, searchQuery: undefined, updatedAt: Date.now() })
    await ctx.scheduler.runAfter(0, internal.importWorker.dispatch, { id, attempt })
    return null
  },
})
export const recheckDraft = mutation({
  args: { id: v.id("imports"), expectedUpdatedAt: v.number() }, returns: v.null(),
  handler: async (ctx, { id, expectedUpdatedAt }) => {
    const member = await requireMembership(ctx)
    const job = await ctx.db.get(id)
    if (!job || job.libraryId !== member.libraryId) throw new ConvexError("Import not found.")
    if (job.status !== "needs_review" || job.recipeId) throw new ConvexError("Only an unsaved draft can be re-extracted.")
    if (job.updatedAt !== expectedUpdatedAt) throw new ConvexError("This draft changed. Reload it before re-extracting.")
    await quota(ctx, member.libraryId)
    const attempt = job.attempt + 1
    await ctx.db.patch(id, { status: "queued", phase: "Rechecking the source", attempt, relevanceOverride: undefined, updatedAt: Date.now() })
    await ctx.scheduler.runAfter(0, internal.importWorker.dispatch, { id, attempt })
    return null
  },
})
export const list = query({
  args: {}, returns: v.array(summary),
  handler: async ctx => {
    const member = await requireMembership(ctx)
    const jobs = await ctx.db.query("imports").withIndex("by_library_created", q => q.eq("libraryId", member.libraryId)).order("desc").take(30)
    return jobs.map(j => ({ id: j._id, url: j.url, platform: j.platform, status: j.status, phase: j.phase, createdAt: j.createdAt, updatedAt: j.updatedAt, attempt: j.attempt, recipeId: j.recipeId, error: j.error, failureCode: j.failureCode, searchQuery: j.searchQuery, name: j.draft?.name }))
  },
})
export const get = query({
  args: { id: v.id("imports") }, returns: v.union(v.object({ ...summary.fields, draft: v.optional(importDraft), imageUrl: v.union(v.string(), v.null()), evidenceJson: v.optional(v.string()) }), v.null()),
  handler: async (ctx, { id }) => {
    const member = await requireMembership(ctx)
    const j = await ctx.db.get(id)
    if (!j || j.libraryId !== member.libraryId) return null
    return { id: j._id, url: j.url, platform: j.platform, status: j.status, phase: j.phase, createdAt: j.createdAt, updatedAt: j.updatedAt, attempt: j.attempt, recipeId: j.recipeId, error: j.error, failureCode: j.failureCode, searchQuery: j.searchQuery, name: j.draft?.name, draft: j.draft, evidenceJson: j.evidenceJson, imageUrl: j.imageStorageId ? await ctx.storage.getUrl(j.imageStorageId) : null }
  },
})
export const save = mutation({
  args: { id: v.id("imports"), draft: importDraft }, returns: v.id("recipes"),
  handler: async (ctx, { id, draft }) => {
    const member = await requireMembership(ctx)
    const job = await ctx.db.get(id)
    if (!job || job.libraryId !== member.libraryId) throw new ConvexError("Import not found.")
    if (job.recipeId && await ctx.db.get(job.recipeId)) return job.recipeId
    if (job.status !== "needs_review") throw new ConvexError("Wait for the import to finish.")
    const cleaned = cleanContent(draft)
    const existing = await ctx.db.query("recipes").withIndex("by_library_source", q => q.eq("libraryId", member.libraryId).eq("sourceKey", job.sourceKey)).first()
    const { warnings, ...content } = cleaned
    if (warnings.length > 20 || warnings.some(w => w.length > 500)) throw new ConvexError("Use up to 20 import checks of 500 characters each.")
    const now = Date.now()
    const recipeId = existing?._id ?? await ctx.db.insert("recipes", { ...content, libraryId: member.libraryId, createdBy: member.userId, origin: "imported", imageStorageId: job.imageStorageId, sourceUrl: job.url, sourceKey: job.sourceKey, sourcePlatform: job.platform, sourceAuthor: job.author, importId: id, importWarnings: warnings, cookCount: 0, isFavorite: false, createdAt: now, updatedAt: now })
    await ctx.db.patch(id, { status: "saved", phase: "Saved to your library", recipeId, updatedAt: now })
    return recipeId
  },
})
export const claim = internalMutation({
  args: { id: v.id("imports"), attempt: v.number() }, returns: v.boolean(),
  handler: async (ctx, { id, attempt }) => {
    const job = await ctx.db.get(id)
    if (!job || job.status !== "queued" || job.attempt !== attempt) return false
    await ctx.db.patch(id, { status: "processing", phase: "Reading the original recipe", leaseExpiresAt: Date.now() + 360_000, updatedAt: Date.now() })
    await ctx.scheduler.runAfter(360_000, internal.imports.expire, { id, attempt })
    return true
  },
})
export const expire = internalMutation({
  args: { id: v.id("imports"), attempt: v.number() }, returns: v.null(),
  handler: async (ctx, { id, attempt }) => {
    const job = await ctx.db.get(id)
    if (job?.status === "processing" && job.attempt === attempt) await ctx.db.patch(id, { status: "failed", error: "This import was interrupted. Your source link is safe; you can retry.", phase: "Import interrupted", updatedAt: Date.now() })
    return null
  },
})
export const workerGet = query({
  args: { secret: v.string(), id: v.id("imports"), attempt: v.number() }, returns: v.union(v.object({ url: v.string(), platform: sourcePlatform, relevanceOverride: v.optional(v.boolean()) }), v.null()),
  handler: async (ctx, args) => { machine(args.secret); const j = await ctx.db.get(args.id); return j?.status === "processing" && j.attempt === args.attempt ? { url: j.url, platform: j.platform, relevanceOverride: j.relevanceOverride } : null },
})
export const workerProgress = mutation({
  args: { secret: v.string(), id: v.id("imports"), attempt: v.number(), phase: v.string() }, returns: v.null(),
  handler: async (ctx, args) => { machine(args.secret); const j = await ctx.db.get(args.id); if (j?.status === "processing" && j.attempt === args.attempt) await ctx.db.patch(j._id, { phase: args.phase.slice(0, 200), updatedAt: Date.now() }); return null },
})
export const workerUploadUrl = mutation({ args: { secret: v.string() }, returns: v.string(), handler: async (ctx, args) => { machine(args.secret); return ctx.storage.generateUploadUrl() } })
export const workerFinish = mutation({
  args: { secret: v.string(), id: v.id("imports"), attempt: v.number(), draft: v.optional(importDraft), evidenceJson: v.optional(v.string()), imageStorageId: v.optional(v.id("_storage")), author: v.optional(v.string()), error: v.optional(v.string()), failureCode: v.optional(importFailureCode), searchQuery: v.optional(v.string()) }, returns: v.boolean(),
  handler: async (ctx, args) => {
    machine(args.secret)
    const job = await ctx.db.get(args.id)
    if (!job || job.status !== "processing" || job.attempt !== args.attempt) { if (args.imageStorageId && args.imageStorageId !== job?.imageStorageId) await ctx.storage.delete(args.imageStorageId); return false }
    if (args.imageStorageId) { const file = await ctx.db.system.get(args.imageStorageId); if (!file || file.size > 350_000 || file.contentType !== "image/webp") throw new ConvexError("Image exceeded storage policy.") }
    if ((args.evidenceJson?.length ?? 0) > 500_000) throw new ConvexError("Evidence exceeded storage limit.")
    if (args.draft) cleanContent(args.draft)
    if (job.imageStorageId && job.imageStorageId !== args.imageStorageId && !job.recipeId) await ctx.storage.delete(job.imageStorageId)
    await ctx.db.patch(job._id, { status: args.error || !args.draft ? "failed" : "needs_review", phase: args.error ? "Could not finish this import" : "Ready for your review", draft: args.draft, evidenceJson: args.evidenceJson, imageStorageId: args.imageStorageId, author: args.author?.slice(0, 200), error: args.error?.slice(0, 500), failureCode: args.failureCode, searchQuery: args.searchQuery?.slice(0, 100), updatedAt: Date.now(), leaseExpiresAt: undefined })
    return true
  },
})
