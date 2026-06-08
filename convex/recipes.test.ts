/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/!(*.test).ts")

async function storeImage(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    return await ctx.storage.store(
      new Blob(["recipe photo"], { type: "image/jpeg" }),
    )
  })
}

describe("recipes", () => {
  test("generates a recipe photo upload URL", async () => {
    const t = convexTest(schema, modules)

    const uploadUrl = await t.mutation(api.recipes.generateUploadUrl)

    expect(uploadUrl).toContain("/api/storage/upload")
  })

  test("creates recipes with normalized tags and resolved image URLs", async () => {
    const t = convexTest(schema, modules)
    const imageStorageId = await storeImage(t)

    const id = await t.mutation(api.recipes.create, {
      name: "  Tomato Rice  ",
      imageStorageId,
      tags: [" Quick ", "comfort", "quick", ""],
      note: "  Weeknight staple  ",
    })

    const recipe = await t.query(api.recipes.get, { id })

    expect(recipe).toMatchObject({
      name: "Tomato Rice",
      imageStorageId,
      imageUrl: expect.stringContaining("/api/storage/"),
      tags: ["quick", "comfort"],
      note: "Weeknight staple",
      cookCount: 0,
      isFavorite: false,
    })
  })

  test("lists by search and tag filters", async () => {
    const t = convexTest(schema, modules)
    const quickImageStorageId = await storeImage(t)
    const breakfastImageStorageId = await storeImage(t)

    await t.mutation(api.recipes.create, {
      name: "Tomato Rice",
      imageStorageId: quickImageStorageId,
      tags: ["quick", "comfort"],
    })
    await t.mutation(api.recipes.create, {
      name: "Masala Omelette",
      imageStorageId: breakfastImageStorageId,
      tags: ["breakfast", "quick"],
      note: "Sunday",
    })

    const results = await t.query(api.recipes.list, {
      search: "omelette",
      tags: ["quick"],
    })

    expect(results).toHaveLength(1)
    expect(results[0]?.name).toBe("Masala Omelette")
  })

  test("lists tags from existing recipes", async () => {
    const t = convexTest(schema, modules)
    const firstImageStorageId = await storeImage(t)
    const secondImageStorageId = await storeImage(t)

    await t.mutation(api.recipes.create, {
      name: "Tomato Rice",
      imageStorageId: firstImageStorageId,
      tags: ["comfort", "quick"],
    })
    await t.mutation(api.recipes.create, {
      name: "Pancakes",
      imageStorageId: secondImageStorageId,
      tags: ["breakfast", "comfort"],
    })

    await expect(t.query(api.recipes.listTags)).resolves.toEqual([
      "breakfast",
      "comfort",
      "quick",
    ])
  })

  test("marks recipes as cooked", async () => {
    const t = convexTest(schema, modules)
    const imageStorageId = await storeImage(t)

    const id = await t.mutation(api.recipes.create, {
      name: "Tomato Rice",
      imageStorageId,
      tags: [],
    })

    await t.mutation(api.recipes.markCooked, { id })
    const recipe = await t.query(api.recipes.get, { id })

    expect(recipe?.cookCount).toBe(1)
    expect(recipe?.lastCookedAt).toEqual(expect.any(Number))
  })

  test("returns a random recipe matching all selected tags", async () => {
    const t = convexTest(schema, modules)
    const quickImageStorageId = await storeImage(t)
    const breakfastImageStorageId = await storeImage(t)

    await t.mutation(api.recipes.create, {
      name: "Tomato Rice",
      imageStorageId: quickImageStorageId,
      tags: ["quick", "comfort"],
    })
    await t.mutation(api.recipes.create, {
      name: "Masala Omelette",
      imageStorageId: breakfastImageStorageId,
      tags: ["quick", "breakfast"],
    })

    const recipe = await t.action(api.recipes.random, {
      tags: ["breakfast", "quick"],
    })

    expect(recipe?.name).toBe("Masala Omelette")
  })
})
