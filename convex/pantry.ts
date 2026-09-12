import { ConvexError, v } from "convex/values"
import { ingredientIdentity } from "../lib/pantry"
import { requireMembership } from "./access"
import { query, mutation } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"

const MAX_ITEMS = 300
const pantryItem = v.object({ id: v.id("pantryItems"), key: v.string(), name: v.string(), present: v.boolean(), updatedAt: v.number() })
const shoppingItem = v.object({ id: v.id("shoppingItems"), key: v.string(), name: v.string(), createdAt: v.number() })

function identity(name: string) {
  const item = ingredientIdentity(name)
  if (!item) throw new ConvexError("Enter one ingredient name, up to 120 characters.")
  return item
}

async function writePresence(ctx: MutationCtx, libraryId: Id<"libraries">, item: { key: string; name: string }, present: boolean) {
  const existing = await ctx.db.query("pantryItems").withIndex("by_library_key", q => q.eq("libraryId", libraryId).eq("key", item.key)).unique()
  if (existing) await ctx.db.patch("pantryItems", existing._id, { present, updatedAt: Date.now() })
  else {
    const count = await ctx.db.query("pantryItems").withIndex("by_library_key", q => q.eq("libraryId", libraryId)).take(MAX_ITEMS)
    if (count.length >= MAX_ITEMS) throw new ConvexError("Your pantry holds 300 ingredients. Forget an old item before adding another.")
    await ctx.db.insert("pantryItems", { libraryId, ...item, present, updatedAt: Date.now() })
  }
}

export const list = query({
  args: {}, returns: v.object({ pantry: v.array(pantryItem), shopping: v.array(shoppingItem) }),
  handler: async ctx => {
    const { libraryId } = await requireMembership(ctx)
    const [pantry, shopping] = await Promise.all([
      ctx.db.query("pantryItems").withIndex("by_library_key", q => q.eq("libraryId", libraryId)).take(MAX_ITEMS + 1),
      ctx.db.query("shoppingItems").withIndex("by_library_key", q => q.eq("libraryId", libraryId)).take(MAX_ITEMS + 1),
    ])
    if (pantry.length > MAX_ITEMS || shopping.length > MAX_ITEMS) throw new ConvexError("This library exceeds the supported pantry size.")
    return {
      pantry: pantry.map(({ _id: id, key, name, present, updatedAt }) => ({ id, key, name, present, updatedAt })),
      shopping: shopping.map(({ _id: id, key, name, createdAt }) => ({ id, key, name, createdAt })),
    }
  },
})

export const setPresence = mutation({
  args: { name: v.string(), present: v.boolean() }, returns: v.null(),
  handler: async (ctx, args) => {
    const { libraryId } = await requireMembership(ctx)
    const item = identity(args.name)
    await writePresence(ctx, libraryId, item, args.present)
    if (args.present) {
      const shopping = await ctx.db.query("shoppingItems").withIndex("by_library_key", q => q.eq("libraryId", libraryId).eq("key", item.key)).unique()
      if (shopping) await ctx.db.delete("shoppingItems", shopping._id)
    }
    return null
  },
})

export const addToShopping = mutation({
  args: { name: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const { libraryId } = await requireMembership(ctx)
    const item = identity(args.name)
    const existing = await ctx.db.query("shoppingItems").withIndex("by_library_key", q => q.eq("libraryId", libraryId).eq("key", item.key)).unique()
    if (!existing) {
      const count = await ctx.db.query("shoppingItems").withIndex("by_library_key", q => q.eq("libraryId", libraryId)).take(MAX_ITEMS)
      if (count.length >= MAX_ITEMS) throw new ConvexError("Your shopping list holds 300 ingredients. Remove an item before adding another.")
      await ctx.db.insert("shoppingItems", { libraryId, ...item, createdAt: Date.now() })
    }
    await writePresence(ctx, libraryId, item, false)
    return null
  },
})

export const purchase = mutation({
  args: { id: v.id("shoppingItems") }, returns: v.null(),
  handler: async (ctx, { id }) => {
    const { libraryId } = await requireMembership(ctx)
    const item = await ctx.db.get("shoppingItems", id)
    if (!item) return null
    if (item.libraryId !== libraryId) throw new ConvexError("Shopping item not found.")
    await writePresence(ctx, libraryId, item, true)
    await ctx.db.delete("shoppingItems", id)
    return null
  },
})

export const removeShopping = mutation({
  args: { id: v.id("shoppingItems") }, returns: v.null(),
  handler: async (ctx, { id }) => {
    const { libraryId } = await requireMembership(ctx)
    const item = await ctx.db.get("shoppingItems", id)
    if (!item) return null
    if (item.libraryId !== libraryId) throw new ConvexError("Shopping item not found.")
    await ctx.db.delete("shoppingItems", id)
    return null
  },
})

export const forget = mutation({
  args: { id: v.id("pantryItems") }, returns: v.null(),
  handler: async (ctx, { id }) => {
    const { libraryId } = await requireMembership(ctx)
    const item = await ctx.db.get("pantryItems", id)
    if (!item) return null
    if (item.libraryId !== libraryId) throw new ConvexError("Pantry item not found.")
    await ctx.db.delete("pantryItems", id)
    return null
  },
})
