/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/!(*.test).ts")

async function setup() {
  const t = convexTest(schema, modules)
  const tags = ["pasta", "mac n cheese", "comfort food"]
  const id = await t.run(async ctx => {
    const libraryId = await ctx.db.insert("libraries", { name: "Test", slug: "tags-test", createdAt: 1 })
    await ctx.db.insert("memberships", { libraryId, userId: "owner", email: "owner@example.com", role: "owner", createdAt: 1 })
    return ctx.db.insert("recipes", {
      libraryId, name: "Baked Mac & Cheese", tags, origin: "manual",
      note: "Family favourite", ingredients: [{ text: "250 g pasta" }],
      cookCount: 2, isFavorite: true, createdAt: 1, updatedAt: 1,
    })
  })
  return { t, owner: t.withIdentity({ subject: "owner" }), id, snapshot: { id, expectedTags: tags, expectedUpdatedAt: 1 } }
}

test("the audited tag cleanup changes only tags and timestamp and is safe to repeat", async () => {
  const { t, owner, id, snapshot } = await setup()
  const before = await owner.query(api.recipes.get, { id })
  expect(await t.mutation(internal.tagMaintenance.canonicalizeBatch, { recipes: [snapshot] }))
    .toEqual({ changed: [id], skipped: [] })
  const after = await owner.query(api.recipes.get, { id })
  expect(after).toEqual({ ...before, tags: ["mac and cheese", "pasta"], updatedAt: after?.updatedAt })
  expect(after!.updatedAt).toBeGreaterThan(1)
  expect(await t.mutation(internal.tagMaintenance.canonicalizeBatch, { recipes: [snapshot] }))
    .toEqual({ changed: [], skipped: [id] })
  expect(await owner.query(api.recipes.get, { id })).toEqual(after)
})

test("cleanup preserves concurrent edits, mismatched tags, and deleted recipes", async () => {
  const { t, owner, id, snapshot } = await setup()
  expect(await t.mutation(internal.tagMaintenance.canonicalizeBatch, {
    recipes: [{ ...snapshot, expectedTags: ["different tags"] }],
  })).toEqual({ changed: [], skipped: [id] })
  await owner.mutation(api.recipes.update, { id, name: "My updated pasta", note: "Keep my edits" })
  const edited = await owner.query(api.recipes.get, { id })
  expect(await t.mutation(internal.tagMaintenance.canonicalizeBatch, { recipes: [snapshot] }))
    .toEqual({ changed: [], skipped: [id] })
  expect(await owner.query(api.recipes.get, { id })).toEqual(edited)
  await owner.mutation(api.recipes.remove, { id })
  expect(await t.mutation(internal.tagMaintenance.canonicalizeBatch, { recipes: [snapshot] }))
    .toEqual({ changed: [], skipped: [id] })
  expect(await owner.query(api.recipes.get, { id })).toBeNull()
})

test("oversized cleanup batches fail before changing any recipe", async () => {
  const { t, owner, id, snapshot } = await setup()
  const before = await owner.query(api.recipes.get, { id })
  await expect(t.mutation(internal.tagMaintenance.canonicalizeBatch, {
    recipes: Array.from({ length: 101 }, () => snapshot),
  })).rejects.toThrow("100")
  expect(await owner.query(api.recipes.get, { id })).toEqual(before)
})
