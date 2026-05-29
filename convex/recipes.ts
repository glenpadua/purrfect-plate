import { ConvexError, v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"

const recipeFields = v.object({
  _id: v.id("recipes"),
  _creationTime: v.number(),
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

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
  )
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const list = query({
  args: {
    search: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.array(recipeFields),
  handler: async (ctx, args) => {
    const search = args.search?.trim().toLowerCase() ?? ""
    const selectedTags = normalizeTags(args.tags ?? [])

    let recipes = await ctx.db.query("recipes").withIndex("by_created_at").order("desc").collect()

    if (search) {
      recipes = recipes.filter((recipe) => {
        const haystack = `${recipe.name} ${recipe.note ?? ""} ${recipe.tags.join(" ")}`.toLowerCase()
        return haystack.includes(search)
      })
    }

    if (selectedTags.length) {
      recipes = recipes.filter((recipe) =>
        selectedTags.every((tag) => recipe.tags.includes(tag)),
      )
    }

    return recipes
  },
})

export const get = query({
  args: {
    id: v.id("recipes"),
  },
  returns: v.union(recipeFields, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    imageUrl: v.string(),
    tags: v.array(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.id("recipes"),
  handler: async (ctx, args): Promise<Id<"recipes">> => {
    const name = args.name.trim()
    const imageUrl = args.imageUrl.trim()

    if (!name) {
      throw new ConvexError("Recipe name is required")
    }

    if (!imageUrl) {
      throw new ConvexError("Recipe photo is required")
    }

    const now = Date.now()

    return await ctx.db.insert("recipes", {
      name,
      imageUrl,
      tags: normalizeTags(args.tags),
      note: normalizeOptionalText(args.note),
      cookCount: 0,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("recipes"),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
    isFavorite: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.id)

    if (!recipe) {
      throw new ConvexError("Recipe not found")
    }

    const patch: Partial<typeof recipe> = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) {
      const name = args.name.trim()
      if (!name) {
        throw new ConvexError("Recipe name is required")
      }
      patch.name = name
    }

    if (args.imageUrl !== undefined) {
      const imageUrl = args.imageUrl.trim()
      if (!imageUrl) {
        throw new ConvexError("Recipe photo is required")
      }
      patch.imageUrl = imageUrl
    }

    if (args.tags !== undefined) {
      patch.tags = normalizeTags(args.tags)
    }

    if (args.note !== undefined) {
      patch.note = normalizeOptionalText(args.note)
    }

    if (args.isFavorite !== undefined) {
      patch.isFavorite = args.isFavorite
    }

    await ctx.db.patch(args.id, patch)
    return null
  },
})

export const markCooked = mutation({
  args: {
    id: v.id("recipes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.id)

    if (!recipe) {
      throw new ConvexError("Recipe not found")
    }

    const now = Date.now()

    await ctx.db.patch(args.id, {
      cookCount: recipe.cookCount + 1,
      lastCookedAt: now,
      updatedAt: now,
    })

    return null
  },
})

export const remove = mutation({
  args: {
    id: v.id("recipes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.id)

    if (!recipe) {
      throw new ConvexError("Recipe not found")
    }

    await ctx.db.delete(args.id)
    return null
  },
})
