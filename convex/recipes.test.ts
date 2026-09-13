/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"
import { recipeLinesFromText, recipeLinesToText } from "../lib/recipe-lines"
const modules = import.meta.glob("./**/!(*.test).ts")

async function setup() {
  const t = convexTest(schema, modules)
  await t.mutation(internal.libraries.bootstrap, { emails: ["glen@example.com", "millusha@example.com"] })
  const glen = t.withIdentity({ subject: "glen", email: "glen@example.com", emailVerified: true })
  const millusha = t.withIdentity({ subject: "millusha", email: "millusha@example.com", emailVerified: true })
  await glen.mutation(api.libraries.join, {})
  await millusha.mutation(api.libraries.join, {})
  return { t, glen, millusha }
}

describe("private shared recipe library", () => {
  test("editing can explicitly clear cooking times without changing other recipe content", async () => {
    const { glen, millusha } = await setup()
    const id = await glen.mutation(api.recipes.create, { name: "Rice", tags: [], prepMinutes: 10, cookMinutes: 20 })
    await millusha.mutation(api.recipes.update, { id, prepMinutes: null, cookMinutes: null })
    const recipe = await glen.query(api.recipes.get, { id })
    expect(recipe?.name).toBe("Rice")
    expect(recipe?.prepMinutes).toBeUndefined()
    expect(recipe?.cookMinutes).toBeUndefined()
  })
  test("editing grouped recipes preserves untouched source evidence and publisher notes", async () => {
    const { glen, millusha } = await setup()
    const original = [{ text: "1 cup rice\nrinsed and drained", group: "Rice", sourceIds: ["publisher"] }]
    const id = await glen.mutation(api.recipes.create, { name: "Rice", tags: [], ingredients: original, recipeNotes: [{ text: "Use long grain rice.", sourceIds: ["card"] }] })
    await millusha.mutation(api.recipes.update, { id, ingredients: recipeLinesFromText(recipeLinesToText(original), original) })
    expect(await glen.query(api.recipes.get, { id })).toMatchObject({ ingredients: original, recipeNotes: [{ text: "Use long grain rice.", sourceIds: ["card"] }] })
    await glen.mutation(api.recipes.update, { id, ingredients: recipeLinesFromText("## Rice\n2 cups rice", original), recipeNotes: [] })
    const edited = await millusha.query(api.recipes.get, { id })
    expect(edited?.ingredients?.map(({ quantity: _quantity, ...line }) => line)).toEqual([{ text: "2 cups rice", group: "Rice" }])
    expect(edited?.recipeNotes).toEqual([])
  })
  test("creates structured manual recipes, normalizes tags, and shares between members", async () => {
    const { glen, millusha } = await setup()
    const id = await glen.mutation(api.recipes.create, { name: "  Tomato Rice  ", tags: [" Dinner ", "dinner", ""], ingredients: [{ text: "1 cup rice" }], instructions: [{ text: "Cook the rice." }], note: " Weeknight staple " })
    expect(await millusha.query(api.recipes.get, { id })).toMatchObject({ name: "Tomato Rice", tags: ["dinner"], origin: "manual", note: "Weeknight staple", imageUrl: null, cookCount: 0, ingredients: [{ text: "1 cup rice" }] })
    await millusha.mutation(api.recipes.markCooked, { id })
    await millusha.mutation(api.recipes.update, { id, isFavorite: true, note: "" })
    const updated = await glen.query(api.recipes.get, { id })
    expect(updated).toMatchObject({ cookCount: 1, isFavorite: true })
    expect(updated?.note).toBeUndefined()
    await millusha.mutation(api.recipes.update, { id, name: "  Tomato Pilaf  ", tags: [" DINNER ", "dinner", " "] })
    expect(await glen.query(api.recipes.get, { id })).toMatchObject({ name: "Tomato Pilaf", tags: ["dinner"], ingredients: [{ text: "1 cup rice" }] })
  })
  test("all public operations reject signed-out callers", async () => {
    const { t, glen } = await setup()
    const id = await glen.mutation(api.recipes.create, { name: "Private", tags: [] })
    await expect(t.query(api.recipes.list, {})).rejects.toThrow("Sign in")
    await expect(t.query(api.recipes.get, { id })).rejects.toThrow("Sign in")
    await expect(t.query(api.recipes.listTags, {})).rejects.toThrow("Sign in")
    await expect(t.mutation(api.recipes.generateUploadUrl, {})).rejects.toThrow("Sign in")
    await expect(t.mutation(api.recipes.create, { name: "No", tags: [] })).rejects.toThrow("Sign in")
    await expect(t.mutation(api.recipes.update, { id, name: "No" })).rejects.toThrow("Sign in")
    await expect(t.mutation(api.recipes.remove, { id })).rejects.toThrow("Sign in")
    await expect(t.mutation(api.recipes.markCooked, { id })).rejects.toThrow("Sign in")
  })
  test("invites require verified emails and cannot be claimed by another address", async () => {
    const { t } = await setup()
    await expect(t.withIdentity({ subject: "fake", email: "glen@example.com", emailVerified: false }).mutation(api.libraries.join, {})).rejects.toThrow("verified")
    await expect(t.withIdentity({ subject: "outsider", email: "outsider@example.com", emailVerified: true }).mutation(api.libraries.join, {})).rejects.toThrow("private")
  })
  test("another library cannot read, change, or delete these recipes", async () => {
    const { t, glen } = await setup()
    const id = await glen.mutation(api.recipes.create, { name: "Private", tags: [] })
    await t.run(async ctx => {
      const libraryId = await ctx.db.insert("libraries", { name: "Other", slug: "other", createdAt: 1 })
      await ctx.db.insert("memberships", { libraryId, userId: "other", email: "other@example.com", role: "owner", createdAt: 1 })
    })
    const other = t.withIdentity({ subject: "other" })
    expect(await other.query(api.recipes.get, { id })).toBeNull()
    expect(await other.query(api.recipes.list, {})).toEqual([])
    await expect(other.mutation(api.recipes.update, { id, name: "Stolen" })).rejects.toThrow("not found")
    await expect(other.mutation(api.recipes.remove, { id })).rejects.toThrow("not found")
    await expect(other.mutation(api.recipes.markCooked, { id })).rejects.toThrow("not found")
  })
  test("search, tags, and pagination stay inside the shared library", async () => {
    const { glen } = await setup()
    await glen.mutation(api.recipes.create, { name: "Tomato Rice", tags: ["comfort", "dinner"] })
    await glen.mutation(api.recipes.create, { name: "Omelette", tags: ["breakfast", "dinner"] })
    expect((await glen.query(api.recipes.list, { search: "omelette", tags: ["dinner"] })).map(r => r.name)).toEqual(["Omelette"])
    expect(await glen.query(api.recipes.listTags, {})).toEqual(["breakfast", "comfort", "dinner"])
    const first = await glen.query(api.recipes.listPage, { paginationOpts: { numItems: 1, cursor: null } })
    const second = await glen.query(api.recipes.listPage, { paginationOpts: { numItems: 1, cursor: first.continueCursor } })
    expect(first.page[0]._id).not.toBe(second.page[0]._id)
  })
  test("new image storage is capped and belongs to its uploader", async () => {
    const { t, glen, millusha } = await setup()
    const storageId = await t.run(async ctx => {
      const id = await ctx.storage.store(new Blob(["small WebP"], { type: "image/webp" }))
      // convex-test omits contentType from storeBlob metadata; real HTTP uploads
      // include it. Seed that missing harness field to exercise our upload policy.
      await ctx.db.patch(id as never, { contentType: "image/webp" } as never)
      return id
    })
    await glen.mutation(api.recipes.registerUpload, { storageId })
    await expect(millusha.mutation(api.recipes.create, { name: "No", tags: [], imageStorageId: storageId })).rejects.toThrow("Upload")
    const id = await glen.mutation(api.recipes.create, { name: "Photo", tags: [], imageStorageId: storageId })
    await expect(glen.mutation(api.recipes.registerUpload, { storageId })).rejects.toThrow("unavailable")
    await expect(glen.mutation(api.recipes.create, { name: "Duplicate photo", tags: [], imageStorageId: storageId })).rejects.toThrow("Upload")
    expect((await glen.query(api.recipes.get, { id }))?.imageUrl).toContain("/api/storage/")
    await glen.mutation(api.recipes.remove, { id })
    expect(await t.run(ctx => ctx.storage.get(storageId))).toBeNull()
    const large = await t.run(ctx => ctx.storage.store(new Blob([new Uint8Array(350001)], { type: "image/webp" })))
    await expect(glen.mutation(api.recipes.registerUpload, { storageId: large })).rejects.toThrow("350 KB")
  })
  test("rejects empty names and unreasonable recipe sizes", async () => {
    const { glen } = await setup()
    await expect(glen.mutation(api.recipes.create, { name: " ", tags: [] })).rejects.toThrow("name")
    await expect(glen.mutation(api.recipes.create, { name: "Huge", tags: [], ingredients: Array.from({ length: 101 }, () => ({ text: "Salt" })) })).rejects.toThrow("100")
  })
})
