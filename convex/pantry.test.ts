/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"
import { ingredientAvailability, recipePantryCoverage } from "../lib/pantry"

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

test("members share a binary pantry and repeated additions keep one ingredient", async () => {
  const { glen, millusha } = await setup()
  await glen.mutation(api.pantry.setPresence, { name: " Onions ", present: true })
  await millusha.mutation(api.pantry.setPresence, { name: "onion", present: true })
  const state = await glen.query(api.pantry.list, {})
  expect(state.pantry).toHaveLength(1)
  expect(state.pantry[0]).toMatchObject({ key: "onion", name: "onion", present: true })
  expect(state.shopping).toEqual([])
  await millusha.mutation(api.pantry.setPresence, { name: "onion", present: false })
  expect((await glen.query(api.pantry.list, {})).pantry[0].present).toBe(false)
})

test("correcting pantry from a recipe queues one shopping item and buying reconciles both", async () => {
  const { glen, millusha } = await setup()
  await glen.mutation(api.pantry.setPresence, { name: "onion", present: true })
  await glen.mutation(api.pantry.addToShopping, { name: "onions" })
  await millusha.mutation(api.pantry.addToShopping, { name: "onion" })
  const needed = await glen.query(api.pantry.list, {})
  expect(needed.pantry[0].present).toBe(false)
  expect(needed.shopping).toHaveLength(1)
  await millusha.mutation(api.pantry.purchase, { id: needed.shopping[0].id })
  await millusha.mutation(api.pantry.purchase, { id: needed.shopping[0].id })
  const bought = await glen.query(api.pantry.list, {})
  expect(bought.pantry[0].present).toBe(true)
  expect(bought.shopping).toEqual([])
  await glen.mutation(api.pantry.addToShopping, { name: "onion" })
  await millusha.mutation(api.pantry.setPresence, { name: "onion", present: true })
  expect((await glen.query(api.pantry.list, {})).shopping).toEqual([])
})

test("removing a shopping item does not claim it was bought, and forgetting removes pantry memory", async () => {
  const { glen, millusha } = await setup()
  await glen.mutation(api.pantry.addToShopping, { name: "rice" })
  const state = await glen.query(api.pantry.list, {})
  await millusha.mutation(api.pantry.removeShopping, { id: state.shopping[0].id })
  expect((await glen.query(api.pantry.list, {})).pantry[0].present).toBe(false)
  expect((await glen.query(api.pantry.list, {})).shopping).toEqual([])
  await millusha.mutation(api.pantry.forget, { id: state.pantry[0].id })
  expect((await glen.query(api.pantry.list, {})).pantry).toEqual([])
})

test("recipe availability matches clear ingredient identities without changing source text or guessing substitutes", async () => {
  const { glen } = await setup()
  for (const name of ["onions", "olive oil", "courgettes", "garlic", "tomatoes"]) {
    await glen.mutation(api.pantry.setPresence, { name, present: true })
  }
  await glen.mutation(api.pantry.setPresence, { name: "rice", present: false })
  const ingredients = [
    { text: "2 onions, finely chopped", sourceIds: ["publisher"] },
    { text: "1/2 cup olive oil" }, { text: "2 zucchini" }, { text: "3 cloves garlic, minced" },
    { text: "200g tomatoes" }, { text: "1 cup rice" }, { text: "1 tsp onion powder" },
    { text: "salt and pepper to taste" }, { text: "oil or butter" }, { text: "1 red onion" },
  ]
  const recipeId = await glen.mutation(api.recipes.create, { name: "Vegetables", tags: [], ingredients })
  const { pantry } = await glen.query(api.pantry.list, {})
  const statuses = ingredients.map(line => ingredientAvailability(line.text, pantry).status)
  expect(statuses).toEqual(["present", "present", "present", "present", "present", "missing", "unknown", "unknown", "unknown", "unknown"])
  expect(recipePantryCoverage(ingredients, pantry)).toEqual({ present: 5, missing: 1, unknown: 4, total: 10 })
  expect((await glen.query(api.recipes.get, { id: recipeId }))?.ingredients).toEqual(ingredients)
})

test("signed-out callers and other libraries cannot access or reconcile this pantry", async () => {
  const { t, glen } = await setup()
  await glen.mutation(api.pantry.addToShopping, { name: "onion" })
  const state = await glen.query(api.pantry.list, {})
  await expect(t.query(api.pantry.list, {})).rejects.toThrow("Sign in")
  await expect(t.mutation(api.pantry.setPresence, { name: "onion", present: true })).rejects.toThrow("Sign in")
  await expect(t.mutation(api.pantry.addToShopping, { name: "onion" })).rejects.toThrow("Sign in")
  await expect(t.mutation(api.pantry.purchase, { id: state.shopping[0].id })).rejects.toThrow("Sign in")
  await expect(t.mutation(api.pantry.removeShopping, { id: state.shopping[0].id })).rejects.toThrow("Sign in")
  await expect(t.mutation(api.pantry.forget, { id: state.pantry[0].id })).rejects.toThrow("Sign in")
  await t.run(async ctx => {
    const libraryId = await ctx.db.insert("libraries", { name: "Other", slug: "other", createdAt: 1 })
    await ctx.db.insert("memberships", { libraryId, userId: "other", email: "other@example.com", role: "owner", createdAt: 1 })
  })
  const other = t.withIdentity({ subject: "other" })
  expect(await other.query(api.pantry.list, {})).toEqual({ pantry: [], shopping: [] })
  await expect(other.mutation(api.pantry.purchase, { id: state.shopping[0].id })).rejects.toThrow("not found")
  await expect(other.mutation(api.pantry.removeShopping, { id: state.shopping[0].id })).rejects.toThrow("not found")
  await expect(other.mutation(api.pantry.forget, { id: state.pantry[0].id })).rejects.toThrow("not found")
  await other.mutation(api.pantry.setPresence, { name: "onion", present: true })
  expect((await glen.query(api.pantry.list, {})).pantry[0].present).toBe(false)
})

test("invalid and oversized pantry updates fail without leaving partial shopping changes", async () => {
  const { glen } = await setup()
  for (const name of [" ", "salt and pepper", "a".repeat(121), "2 x 400g tins tomatoes"]) {
    await expect(glen.mutation(api.pantry.addToShopping, { name })).rejects.toThrow("ingredient name")
  }
  for (let i = 0; i < 300; i += 1) {
    const name = `ingredient ${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + i % 26)}`
    await glen.mutation(api.pantry.setPresence, { name, present: true })
  }
  await expect(glen.mutation(api.pantry.addToShopping, { name: "rice" })).rejects.toThrow("300")
  const state = await glen.query(api.pantry.list, {})
  expect(state.pantry).toHaveLength(300)
  expect(state.shopping).toEqual([])
  await glen.mutation(api.pantry.setPresence, { name: "ingredient aa", present: false })
  expect((await glen.query(api.pantry.list, {})).pantry.find(item => item.key === "ingredient aa")?.present).toBe(false)
})
