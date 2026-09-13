import { ConvexError, v } from "convex/values"
import { mutation } from "./_generated/server"
import { internal } from "./_generated/api"

// Deliberately restricted to this project's development deployment. Production
// keeps its hosted dispatcher; the local worker needs no public tunnel.
export function usesLocalImportWorker() {
  return process.env.CONVEX_CLOUD_URL === "https://basic-poodle-462.convex.cloud"
}
export const claimNext = mutation({
  args: { secret: v.string() },
  returns: v.union(v.object({ id: v.id("imports"), attempt: v.number() }), v.null()),
  handler: async (ctx, { secret }) => {
    if (!usesLocalImportWorker() || !process.env.IMPORT_WORKER_SECRET || secret !== process.env.IMPORT_WORKER_SECRET) throw new ConvexError("Unauthorized")
    const job = await ctx.db.query("imports").withIndex("by_status_updated", q => q.eq("status", "queued")).first()
    if (!job) return null
    const now = Date.now()
    await ctx.db.patch(job._id, { status: "processing", phase: "Reading the original recipe", leaseExpiresAt: now + 360_000, updatedAt: now })
    await ctx.scheduler.runAfter(360_000, internal.imports.expire, { id: job._id, attempt: job.attempt })
    return { id: job._id, attempt: job.attempt }
  },
})
