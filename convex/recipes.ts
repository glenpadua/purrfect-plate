import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"
import { action, internalQuery, mutation, query } from "./_generated/server"

type RecipeResult = {
  _id: Id<"recipes">
  _creationTime: number
  name: string
  imageStorageId: Id<"_storage">
  imageUrl: string | null
  tags: string[]
  note?: string
  lastCookedAt?: number
  cookCount: number
  isFavorite: boolean
  createdAt: number
  updatedAt: number
}

const recipeFields = v.object({
  _id: v.id("recipes"),
  _creationTime: v.number(),
  name: v.string(),
  imageStorageId: v.id("_storage"),
  imageUrl: v.union(v.string(), v.null()),
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

async function toRecipeResult(
  ctx: Pick<QueryCtx, "storage">,
  recipe: {
    _id: Id<"recipes">
    _creationTime: number
    name: string
    imageStorageId: Id<"_storage">
    tags: string[]
    note?: string
    lastCookedAt?: number
    cookCount: number
    isFavorite: boolean
    createdAt: number
    updatedAt: number
  },
): Promise<RecipeResult> {
  return {
    ...recipe,
    imageUrl: await ctx.storage.getUrl(recipe.imageStorageId),
  }
}

function matchesTags(recipeTags: string[], selectedTags: string[]) {
  return selectedTags.every((tag) => recipeTags.includes(tag))
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

    let recipes = await ctx.db
      .query("recipes")
      .withIndex("by_created_at")
      .order("desc")
      .collect()

    if (search) {
      recipes = recipes.filter((recipe) => {
        const haystack =
          `${recipe.name} ${recipe.note ?? ""} ${recipe.tags.join(" ")}`.toLowerCase()
        return haystack.includes(search)
      })
    }

    if (selectedTags.length) {
      recipes = recipes.filter((recipe) => matchesTags(recipe.tags, selectedTags))
    }

    return await Promise.all(
      recipes.map((recipe) => toRecipeResult(ctx, recipe)),
    )
  },
})

export const get = query({
  args: {
    id: v.id("recipes"),
  },
  returns: v.union(recipeFields, v.null()),
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.id)
    return recipe ? await toRecipeResult(ctx, recipe) : null
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    imageStorageId: v.id("_storage"),
    tags: v.array(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.id("recipes"),
  handler: async (ctx, args): Promise<Id<"recipes">> => {
    const name = args.name.trim()

    if (!name) {
      throw new ConvexError("Recipe name is required")
    }

    const now = Date.now()

    return await ctx.db.insert("recipes", {
      name,
      imageStorageId: args.imageStorageId,
      tags: normalizeTags(args.tags),
      note: normalizeOptionalText(args.note),
      cookCount: 0,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

export const update = mutation({
  args: {
    id: v.id("recipes"),
    name: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
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

    if (args.imageStorageId !== undefined) {
      patch.imageStorageId = args.imageStorageId
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

export const random = action({
  args: {
    tags: v.optional(v.array(v.string())),
  },
  returns: v.union(recipeFields, v.null()),
  handler: async (ctx, args): Promise<RecipeResult | null> => {
    const recipes = (await ctx.runQuery(
      internal.recipes.listRandomCandidates,
      {
        tags: args.tags,
      },
    )) as RecipeResult[]

    if (!recipes.length) {
      return null
    }

    return recipes[Math.floor(Math.random() * recipes.length)]
  },
})

export const listTags = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const recipes = await ctx.db.query("recipes").collect()
    return Array.from(new Set(recipes.flatMap((recipe) => recipe.tags))).sort()
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

    await ctx.storage.delete(recipe.imageStorageId)
    await ctx.db.delete(args.id)
    return null
  },
})

export const listRandomCandidates = internalQuery({
  args: {
    tags: v.optional(v.array(v.string())),
  },
  returns: v.array(recipeFields),
  handler: async (ctx, args) => {
    const selectedTags = normalizeTags(args.tags ?? [])
    let recipes = await ctx.db.query("recipes").collect()

    if (selectedTags.length) {
      recipes = recipes.filter((recipe) => matchesTags(recipe.tags, selectedTags))
    }

    return await Promise.all(
      recipes.map((recipe) => toRecipeResult(ctx, recipe)),
    )
  },
})
