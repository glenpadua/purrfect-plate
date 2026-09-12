import { ConvexError } from "convex/values"
import type { QueryCtx } from "./_generated/server"

export async function requireMembership(ctx: Pick<QueryCtx, "auth" | "db">) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError("Sign in to your recipe library.")
  const membership = await ctx.db.query("memberships").withIndex("by_user", q => q.eq("userId", identity.subject)).unique()
  if (!membership) throw new ConvexError("This account does not have access to a library.")
  return membership
}
