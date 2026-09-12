import { ConvexError, v } from "convex/values"
import { paginationOptsValidator } from "convex/server"
import { ingredientIdentity, normalizeIngredientName } from "../lib/pantry"
import { requireMembership } from "./access"
import { query, mutation } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"

type Reader = Pick<QueryCtx, "db">
type Ingredient = Doc<"pantryItems">
const MAX_SHOPPING = 300
const ingredientResult = v.object({ id: v.id("pantryItems"), key: v.string(), name: v.string(), present: v.boolean(), updatedAt: v.number() })
const shoppingResult = v.object({ id: v.id("shoppingItems"), key: v.string(), name: v.string(), ingredientId: v.optional(v.id("pantryItems")), createdAt: v.number() })
const matchResult = v.object({ text: v.string(), chosen: v.boolean(), resolved: v.boolean(), present: v.boolean(), names: v.array(v.string()), ingredientIds: v.array(v.id("pantryItems")), onShoppingList: v.boolean() })
const renameResult = v.union(v.object({ status: v.literal("saved") }), v.object({ status: v.literal("merge_required"), targetId: v.id("pantryItems"), targetName: v.string() }))
const project = (item: Ingredient) => ({ id: item._id, key: item.key, name: item.name, present: item.present, updatedAt: item.updatedAt })

function label(text: string, max = 120) {
  const name = text.normalize("NFKC").trim().replace(/\s+/g, " ")
  if (!name || name.length > max || /[\u0000-\u001f\u007f]/.test(name)) throw new ConvexError(`Enter a name of up to ${max} characters.`)
  return name
}

// Merges retain redirects rather than rewriting every recipe in the library.
// A bounded traversal protects queries; normal renames never create redirects.
async function root(ctx: Reader, item: Ingredient): Promise<Ingredient> {
  for (let depth = 0; item.mergedInto; depth++) {
    if (depth >= 32) throw new ConvexError("This ingredient needs its merge history compacted.")
    const next = await ctx.db.get(item.mergedInto)
    if (!next || next.libraryId !== item.libraryId) throw new ConvexError("Ingredient not found.")
    item = next
  }
  return item
}
async function byId(ctx: Reader, libraryId: Id<"libraries">, id: Id<"pantryItems">) {
  const item = await ctx.db.get(id)
  if (!item || item.libraryId !== libraryId) throw new ConvexError("Ingredient not found.")
  return root(ctx, item)
}
async function lookup(ctx: Reader, libraryId: Id<"libraries">, text: string) {
  const identity = ingredientIdentity(text)
  // Explicit learned aliases take precedence, including a user's chosen label.
  for (const key of new Set([normalizeIngredientName(text), ...(identity ? [identity.key] : [])])) {
    const alias = await ctx.db.query("ingredientAliases").withIndex("by_library_key", q => q.eq("libraryId", libraryId).eq("key", key)).unique()
    if (alias) return byId(ctx, libraryId, alias.ingredientId)
    const item = await ctx.db.query("pantryItems").withIndex("by_library_key", q => q.eq("libraryId", libraryId).eq("key", key)).unique()
    if (item) return root(ctx, item)
  }
  return null
}
async function remember(ctx: MutationCtx, libraryId: Id<"libraries">, key: string, ingredientId: Id<"pantryItems">) {
  const existing = await ctx.db.query("ingredientAliases").withIndex("by_library_key", q => q.eq("libraryId", libraryId).eq("key", key)).unique()
  if (existing) {
    const owner = await byId(ctx, libraryId, existing.ingredientId)
    if (owner._id !== ingredientId) throw new ConvexError("That name already belongs to another ingredient. Merge them first.")
  } else await ctx.db.insert("ingredientAliases", { libraryId, key, ingredientId })
}
async function ensureIngredient(ctx: MutationCtx, libraryId: Id<"libraries">, text: string) {
  const name = label(text)
  const existing = await lookup(ctx, libraryId, name)
  if (existing) return existing
  const identity = ingredientIdentity(name)
  const key = identity?.key ?? normalizeIngredientName(name)
  const id = await ctx.db.insert("pantryItems", { libraryId, key, name: identity?.name ?? name, present: false, updatedAt: Date.now() })
  await remember(ctx, libraryId, key, id)
  return (await ctx.db.get(id))!
}
async function stock(ctx: MutationCtx, item: Ingredient, present: boolean) {
  if (item.present !== present) await ctx.db.patch(item._id, { present, updatedAt: Date.now() })
}
async function shoppingRows(ctx: Reader, libraryId: Id<"libraries">) {
  const items = await ctx.db.query("shoppingItems").withIndex("by_library_key", q => q.eq("libraryId", libraryId)).take(MAX_SHOPPING + 1)
  if (items.length > MAX_SHOPPING) throw new ConvexError("The shopping list exceeds its supported size. Remove some items before continuing.")
  return items
}
async function queue(ctx: MutationCtx, libraryId: Id<"libraries">, name: string, ingredient?: Ingredient | null, knownKeys?: Set<string>, createdAt?: number) {
  const key = ingredient ? `ingredient:${ingredient._id}` : `text:${normalizeIngredientName(name)}`
  const keys = knownKeys ?? new Set((await shoppingRows(ctx, libraryId)).map(row => row.key))
  if (keys.has(key)) return false
  if (keys.size >= MAX_SHOPPING) throw new ConvexError("Your shopping list is full. Copy or clear it before adding more.")
  await ctx.db.insert("shoppingItems", { libraryId, key, name: ingredient?.name ?? name, ...(ingredient ? { ingredientId: ingredient._id } : {}), createdAt: createdAt ?? Date.now() + keys.size / 1000 })
  keys.add(key)
  return true
}
async function merge(ctx: MutationCtx, libraryId: Id<"libraries">, source: Ingredient, target: Ingredient) {
  if (source._id === target._id) return
  await stock(ctx, target, source.present || target.present)
  await ctx.db.patch(source._id, { present: false, mergedInto: target._id, updatedAt: Date.now() })
  // Only the short-lived list is reconciled eagerly. Recipe references follow redirects.
  for (const row of await shoppingRows(ctx, libraryId)) {
    if (row.ingredientId === source._id) {
      await ctx.db.delete(row._id)
      await queue(ctx, libraryId, target.name, target)
    }
  }
}

// Idempotent upgrade from the previous capped (300-entry) pantry. Stock and
// shopping intent are preserved independently; old shopping never implies stock.
async function initializeLibrary(ctx: MutationCtx, libraryId: Id<"libraries">) {
  const library = await ctx.db.get(libraryId)
  if (library?.pantryVersion === 2) return
  const old = await ctx.db.query("pantryItems").withIndex("by_library_key", q => q.eq("libraryId", libraryId)).take(301)
  if (old.length > 300) throw new ConvexError("The legacy pantry needs a paginated upgrade before continuing.")
  const groups = new Map<string, Ingredient>()
  for (const row of old) {
    const key = ingredientIdentity(row.name)?.key ?? normalizeIngredientName(row.name)
    const target = groups.get(key)
    if (target) {
      await merge(ctx, libraryId, row, (await ctx.db.get(target._id))!)
      await remember(ctx, libraryId, row.key, target._id)
    } else {
      groups.set(key, row)
      await remember(ctx, libraryId, row.key, row._id)
      if (key !== row.key) await remember(ctx, libraryId, key, row._id)
    }
  }
  const previousShopping = await shoppingRows(ctx, libraryId)
  for (const row of previousShopping) await ctx.db.delete(row._id)
  const shoppingKeys = new Set<string>()
  for (const row of previousShopping) {
    const found = await lookup(ctx, libraryId, row.name)
    const item = found ?? (ingredientIdentity(row.name) ? await ensureIngredient(ctx, libraryId, row.name) : null)
    await queue(ctx, libraryId, row.name, item, shoppingKeys, row.createdAt)
  }
  await ctx.db.patch(libraryId, { pantryVersion: 2 })
}
async function writableLibrary(ctx: MutationCtx) {
  const { libraryId } = await requireMembership(ctx)
  await initializeLibrary(ctx, libraryId)
  return libraryId
}
export const initialized = query({ args: {}, returns: v.boolean(), handler: async ctx => {
  const { libraryId } = await requireMembership(ctx)
  return (await ctx.db.get(libraryId))?.pantryVersion === 2
}})
export const initialize = mutation({ args: {}, returns: v.null(), handler: async ctx => { await writableLibrary(ctx); return null } })

export const page = query({
  args: { paginationOpts: paginationOptsValidator, search: v.optional(v.string()) },
  returns: v.object({ page: v.array(ingredientResult), isDone: v.boolean(), continueCursor: v.string(), splitCursor: v.optional(v.union(v.string(), v.null())), pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())) }),
  handler: async (ctx, args) => {
    const { libraryId } = await requireMembership(ctx)
    const requestedSearch = args.search?.trim()
    const exact = requestedSearch ? await lookup(ctx, libraryId, requestedSearch) : null
    const search = exact?.present ? exact.name : requestedSearch
    const result = search
      ? await ctx.db.query("pantryItems").withSearchIndex("search_name", q => q.search("name", search).eq("libraryId", libraryId).eq("present", true)).paginate(args.paginationOpts)
      : await ctx.db.query("pantryItems").withIndex("by_library_present_name", q => q.eq("libraryId", libraryId).eq("present", true)).paginate(args.paginationOpts)
    return { ...result, page: result.page.map(project) }
  },
})
export const shopping = query({ args: {}, returns: v.array(shoppingResult), handler: async ctx => {
  const { libraryId } = await requireMembership(ctx)
  return Promise.all((await shoppingRows(ctx, libraryId)).sort((a, b) => a.createdAt - b.createdAt).map(async row => {
    const item = row.ingredientId ? await byId(ctx, libraryId, row.ingredientId) : null
    return { id: row._id, key: row.key, createdAt: row.createdAt, name: item?.name ?? row.name, ...(item ? { ingredientId: item._id } : {}) }
  }))
}})
export const suggestions = query({ args: { search: v.string() }, returns: v.array(ingredientResult), handler: async (ctx, { search }) => {
  const { libraryId } = await requireMembership(ctx)
  if (!search.trim()) return []
  const exact = await lookup(ctx, libraryId, search)
  const items = await ctx.db.query("pantryItems").withSearchIndex("search_name", q => q.search("name", search).eq("libraryId", libraryId)).take(12)
  const unique = new Map(items.filter(item => !item.mergedInto).map(item => [item._id, item]))
  if (exact) unique.set(exact._id, exact)
  return [...unique.values()].map(project)
}})
export const setPresence = mutation({ args: { name: v.optional(v.string()), ingredientId: v.optional(v.id("pantryItems")), present: v.boolean() }, returns: v.id("pantryItems"), handler: async (ctx, args) => {
  const libraryId = await writableLibrary(ctx)
  if (!args.name && !args.ingredientId) throw new ConvexError("Choose an ingredient.")
  const item = args.ingredientId ? await byId(ctx, libraryId, args.ingredientId) : await ensureIngredient(ctx, libraryId, args.name!)
  await stock(ctx, item, args.present)
  return item._id
}})
export const addToShopping = mutation({ args: { name: v.string() }, returns: v.null(), handler: async (ctx, { name: raw }) => {
  const libraryId = await writableLibrary(ctx)
  const name = label(raw, 3000)
  const item = await lookup(ctx, libraryId, name) ?? (ingredientIdentity(name) ? await ensureIngredient(ctx, libraryId, name) : null)
  await queue(ctx, libraryId, name, item)
  return null
}})
export const removeShopping = mutation({ args: { id: v.id("shoppingItems") }, returns: v.null(), handler: async (ctx, { id }) => {
  const libraryId = await writableLibrary(ctx)
  const row = await ctx.db.get(id)
  if (row && row.libraryId !== libraryId) throw new ConvexError("Shopping item not found.")
  if (row) await ctx.db.delete(id)
  return null
}})
// Return precisely the deleted snapshot so Undo never overwrites additions made
// by the other member in the meantime. Restoring resolves any intervening rename.
const restoreItem = v.object({ name: v.string(), ingredientId: v.optional(v.id("pantryItems")), createdAt: v.optional(v.number()) })
export const clearShopping = mutation({ args: {}, returns: v.array(restoreItem), handler: async ctx => {
  const libraryId = await writableLibrary(ctx)
  const rows = await shoppingRows(ctx, libraryId)
  for (const row of rows) await ctx.db.delete(row._id)
  return rows.map(row => ({ name: row.name, createdAt: row.createdAt, ...(row.ingredientId ? { ingredientId: row.ingredientId } : {}) }))
}})
export const restoreShopping = mutation({ args: { items: v.array(restoreItem) }, returns: v.null(), handler: async (ctx, { items }) => {
  const libraryId = await writableLibrary(ctx)
  if (items.length > MAX_SHOPPING) throw new ConvexError("Too many items to restore.")
  const shoppingKeys = new Set((await shoppingRows(ctx, libraryId)).map(row => row.key))
  for (const row of items) {
    const name = label(row.name, 3000)
    const item = row.ingredientId ? await byId(ctx, libraryId, row.ingredientId) : await lookup(ctx, libraryId, name)
    await queue(ctx, libraryId, name, item, shoppingKeys, row.createdAt !== undefined && Number.isFinite(row.createdAt) ? row.createdAt : undefined)
  }
  return null
}})
async function renameIngredient(ctx: MutationCtx, libraryId: Id<"libraries">, id: Id<"pantryItems">, raw: string, mergeInto?: Id<"pantryItems">) {
  const item = await byId(ctx, libraryId, id)
  const name = label(raw)
  const target = await lookup(ctx, libraryId, name)
  if (target && target._id !== item._id) {
    if (mergeInto !== target._id) return { status: "merge_required" as const, targetId: target._id, targetName: target.name }
    await merge(ctx, libraryId, item, target)
  } else {
    if (mergeInto) throw new ConvexError("That ingredient changed. Save the name again to review the match.")
    await remember(ctx, libraryId, normalizeIngredientName(item.name), item._id)
    await remember(ctx, libraryId, normalizeIngredientName(name), item._id)
    const identity = ingredientIdentity(name)
    if (identity) await remember(ctx, libraryId, identity.key, item._id)
    await ctx.db.patch(item._id, { name, updatedAt: Date.now() })
  }
  return { status: "saved" as const }
}
export const rename = mutation({ args: { ingredientId: v.id("pantryItems"), name: v.string(), mergeInto: v.optional(v.id("pantryItems")) }, returns: renameResult, handler: async (ctx, args) => {
  return renameIngredient(ctx, await writableLibrary(ctx), args.ingredientId, args.name, args.mergeInto)
}})
export const renameShopping = mutation({ args: { id: v.id("shoppingItems"), name: v.string(), mergeInto: v.optional(v.id("pantryItems")) }, returns: renameResult, handler: async (ctx, args) => {
  const libraryId = await writableLibrary(ctx)
  const row = await ctx.db.get(args.id)
  if (!row || row.libraryId !== libraryId) throw new ConvexError("Shopping item not found.")
  if (row.ingredientId) return renameIngredient(ctx, libraryId, row.ingredientId, args.name, args.mergeInto)
  const name = label(args.name, 3000)
  const found = await lookup(ctx, libraryId, name)
  if (found && args.mergeInto !== found._id) return { status: "merge_required" as const, targetId: found._id, targetName: found.name }
  if (args.mergeInto && found?._id !== args.mergeInto) throw new ConvexError("That ingredient changed. Save the name again.")
  const item = found ?? (ingredientIdentity(name) ? await ensureIngredient(ctx, libraryId, name) : null)
  await ctx.db.delete(row._id)
  await queue(ctx, libraryId, name, item)
  return { status: "saved" as const }
}})

async function recipe(ctx: Reader, libraryId: Id<"libraries">, recipeId: Id<"recipes">) {
  const item = await ctx.db.get(recipeId)
  if (!item || item.libraryId !== libraryId) throw new ConvexError("Recipe not found.")
  return item
}
async function resolveLine(ctx: Reader, libraryId: Id<"libraries">, recipeId: Id<"recipes">, text: string) {
  const binding = await ctx.db.query("recipeIngredientBindings").withIndex("by_recipe_text", q => q.eq("recipeId", recipeId).eq("text", text)).unique()
  if (binding) {
    const items = await Promise.all(binding.ingredientIds.map(id => byId(ctx, libraryId, id)))
    const unique = [...new Map(items.map(item => [item._id, item])).values()]
    return { items: unique, names: unique.map(item => item.name), resolved: true, chosen: true }
  }
  const identity = ingredientIdentity(text)
  // Bare ambiguous terms need a recipe-specific choice, even if someone has
  // entered the generic term in pantry. An explicit binding is authoritative.
  if (!identity) return { items: [], names: [], resolved: false, chosen: false }
  const item = await lookup(ctx, libraryId, text)
  return { items: item ? [item] : [], names: [item?.name ?? identity.name], resolved: true, chosen: false }
}
export const matches = query({ args: { recipeId: v.id("recipes") }, returns: v.array(matchResult), handler: async (ctx, { recipeId }) => {
  const { libraryId } = await requireMembership(ctx)
  const r = await recipe(ctx, libraryId, recipeId)
  const shopping = await shoppingRows(ctx, libraryId)
  return Promise.all((r.ingredients ?? []).map(async ({ text }) => {
    const match = await resolveLine(ctx, libraryId, recipeId, text)
    return { text, chosen: match.chosen, resolved: match.resolved, present: match.items.length > 0 && match.items.every(item => item.present), names: match.names, ingredientIds: match.items.map(item => item._id), onShoppingList: shopping.some(row => match.items.some(item => item._id === row.ingredientId) || row.key === `text:${normalizeIngredientName(text)}`) }
  }))
}})
export const setRecipePresence = mutation({ args: { recipeId: v.id("recipes"), text: v.string(), present: v.boolean(), names: v.optional(v.array(v.string())) }, returns: v.null(), handler: async (ctx, args) => {
  const libraryId = await writableLibrary(ctx)
  const r = await recipe(ctx, libraryId, args.recipeId)
  if (!r.ingredients?.some(line => line.text === args.text)) throw new ConvexError("This ingredient line changed. Reload the recipe.")
  let match = await resolveLine(ctx, libraryId, args.recipeId, args.text)
  if (args.names) {
    if (!args.names.length || args.names.length > 10) throw new ConvexError("Choose between one and ten ingredients.")
    const items: Ingredient[] = []
    for (const name of args.names) {
      const existing = await lookup(ctx, libraryId, name)
      if (!existing && !ingredientIdentity(name)) throw new ConvexError("Use a specific name, such as coriander seeds or coriander leaves.")
      items.push(existing ?? await ensureIngredient(ctx, libraryId, name))
    }
    const ingredientIds = [...new Set(items.map(item => item._id))]
    const existing = await ctx.db.query("recipeIngredientBindings").withIndex("by_recipe_text", q => q.eq("recipeId", args.recipeId).eq("text", args.text)).unique()
    if (existing) await ctx.db.patch(existing._id, { ingredientIds })
    else await ctx.db.insert("recipeIngredientBindings", { libraryId, recipeId: args.recipeId, text: args.text, ingredientIds })
    match = { items, names: items.map(item => item.name), resolved: true, chosen: true }
  }
  if (!match.resolved) throw new ConvexError("Choose the ingredient you mean first.")
  const items = match.items.length ? match.items : [await ensureIngredient(ctx, libraryId, match.names[0])]
  for (const item of items) await stock(ctx, item, args.present)
  return null
}})
export const addMissing = mutation({ args: { recipeId: v.id("recipes") }, returns: v.number(), handler: async (ctx, { recipeId }) => {
  const libraryId = await writableLibrary(ctx)
  const r = await recipe(ctx, libraryId, recipeId)
  let added = 0
  const shoppingKeys = new Set((await shoppingRows(ctx, libraryId)).map(row => row.key))
  for (const line of r.ingredients ?? []) {
    const match = await resolveLine(ctx, libraryId, recipeId, line.text)
    if (!match.resolved) { if (await queue(ctx, libraryId, line.text, null, shoppingKeys)) added++; continue }
    const items = match.items.length ? match.items : [await ensureIngredient(ctx, libraryId, match.names[0])]
    for (const item of items) if (!item.present && await queue(ctx, libraryId, item.name, item, shoppingKeys)) added++
  }
  return added
}})
export const coverage = query({ args: { recipeIds: v.array(v.id("recipes")) }, returns: v.array(v.object({ recipeId: v.id("recipes"), present: v.number(), total: v.number() })), handler: async (ctx, { recipeIds }) => {
  const { libraryId } = await requireMembership(ctx)
  if (recipeIds.length > 100) throw new ConvexError("Check up to 100 recipes at a time.")
  return Promise.all(recipeIds.map(async recipeId => {
    const r = await ctx.db.get(recipeId)
    // A recipe can disappear while a subscribed library batch is still mounted.
    if (!r || r.libraryId !== libraryId) return { recipeId, present: 0, total: 0 }
    let present = 0
    for (const line of r.ingredients ?? []) {
      const match = await resolveLine(ctx, libraryId, recipeId, line.text)
      if (match.items.length && match.items.every(item => item.present)) present++
    }
    return { recipeId, present, total: r.ingredients?.length ?? 0 }
  }))
}})
