import { ConvexError, v } from "convex/values"
import { internalMutation, mutation, query } from "./_generated/server"

export const current = query({
  args: {}, returns: v.union(v.object({ id: v.id("libraries"), name: v.string(), role: v.string() }), v.null()),
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const member = await ctx.db.query("memberships").withIndex("by_user", q => q.eq("userId", identity.subject)).unique()
    if (!member) return null
    const library = await ctx.db.get(member.libraryId)
    return library ? { id: library._id, name: library.name, role: member.role } : null
  },
})

export const join = mutation({
  args: {}, returns: v.id("libraries"),
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || identity.emailVerified !== true || !identity.email) throw new ConvexError("Sign in with a verified email address.")
    const existing = await ctx.db.query("memberships").withIndex("by_user", q => q.eq("userId", identity.subject)).unique()
    if (existing) return existing.libraryId
    const email = identity.email.toLowerCase().trim()
    const invite = await ctx.db.query("libraryInvites").withIndex("by_email", q => q.eq("email", email)).unique()
    if (!invite) throw new ConvexError("This library is currently private. Sign in with your invited email address.")
    await ctx.db.insert("memberships", { libraryId: invite.libraryId, userId: identity.subject, email, role: invite.role, createdAt: Date.now() })
    return invite.libraryId
  },
})

// CLI-only bootstrap/migration, never a public client function.
export const bootstrap = internalMutation({
  args: { emails: v.array(v.string()) }, returns: v.object({ libraryId: v.id("libraries"), migrated: v.number() }),
  handler: async (ctx, { emails }) => {
    const library = await ctx.db.query("libraries").withIndex("by_slug", q => q.eq("slug", "glen-and-millusha")).unique()
    const libraryId = library?._id ?? await ctx.db.insert("libraries", { name: "Our recipe library", slug: "glen-and-millusha", createdAt: Date.now() })
    for (const email of emails.map(e => e.trim().toLowerCase())) {
      const existing = await ctx.db.query("libraryInvites").withIndex("by_email", q => q.eq("email", email)).unique()
      if (!existing) await ctx.db.insert("libraryInvites", { libraryId, email, role: "owner" })
    }
    const legacy = await ctx.db.query("recipes").withIndex("by_library_created", q => q.eq("libraryId", undefined)).take(200)
    for (const recipe of legacy) await ctx.db.patch(recipe._id, { libraryId, origin: "manual" })
    return { libraryId, migrated: legacy.length }
  },
})
