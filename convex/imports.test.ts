/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"
const modules = import.meta.glob("./**/!(*.test).ts")
const draft = { name: "Eggs", tags: ["quick"], ingredients: [{ text: "2 eggs" }], instructions: [{ text: "Stir gently." }], warnings: [] }
beforeEach(() => { vi.useFakeTimers(); vi.stubEnv("IMPORT_WORKER_SECRET", "test-worker") })
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })
async function setup() {
  const t = convexTest(schema, modules)
  await t.mutation(internal.libraries.bootstrap, { emails: ["glen@example.com"] })
  const user = t.withIdentity({ subject: "glen", email: "glen@example.com", emailVerified: true })
  await user.mutation(api.libraries.join, {})
  return { t, user }
}
test("canonical links share one job and repeated save creates one recipe", async () => {
  const { t, user } = await setup()
  const id = await user.mutation(api.imports.start, { url: "https://www.youtube.com/shorts/_qFZJjnN73o?si=abc" })
  expect(await user.mutation(api.imports.start, { url: "https://www.youtube.com/watch?v=_qFZJjnN73o" })).toBe(id)
  expect(await t.mutation(internal.imports.claim, { id, attempt: 1 })).toBe(true)
  expect(await t.mutation(internal.imports.claim, { id, attempt: 1 })).toBe(false)
  await t.mutation(api.imports.workerFinish, { secret: "test-worker", id, attempt: 1, draft })
  const recipeId = await user.mutation(api.imports.save, { id, draft })
  expect(await user.mutation(api.imports.save, { id, draft })).toBe(recipeId)
  expect(await user.query(api.recipes.list, {})).toHaveLength(1)
  await user.mutation(api.recipes.remove, { id: recipeId })
  expect((await user.query(api.imports.get, { id }))?.status).toBe("needs_review")
  expect(await user.mutation(api.imports.save, { id, draft })).not.toBe(recipeId)
})
test("late results cannot overwrite a retried or completed import", async () => {
  const { t, user } = await setup()
  const id = await user.mutation(api.imports.start, { url: "https://example.com/recipe" })
  await t.mutation(internal.imports.claim, { id, attempt: 1 })
  await t.mutation(internal.imports.expire, { id, attempt: 1 })
  await user.mutation(api.imports.retry, { id })
  await t.mutation(internal.imports.claim, { id, attempt: 2 })
  expect(await t.mutation(api.imports.workerFinish, { secret: "test-worker", id, attempt: 1, draft })).toBe(false)
  await t.mutation(api.imports.workerFinish, { secret: "test-worker", id, attempt: 2, draft })
  await t.mutation(internal.imports.expire, { id, attempt: 2 })
  expect((await user.query(api.imports.get, { id }))?.status).toBe("needs_review")
})
test("auth, worker secret and concurrency limits are enforced", async () => {
  const { t, user } = await setup()
  await expect(t.mutation(api.imports.start, { url: "https://example.com/recipe" })).rejects.toThrow("Sign in")
  const id = await user.mutation(api.imports.start, { url: "https://example.com/1" })
  await user.mutation(api.imports.start, { url: "https://example.com/2" })
  await expect(user.mutation(api.imports.start, { url: "https://example.com/3" })).rejects.toThrow("Two imports")
  await expect(t.mutation(api.imports.workerFinish, { secret: "wrong", id, attempt: 1, draft })).rejects.toThrow("Unauthorized")
  await expect(t.query(api.imports.get, { id })).rejects.toThrow("Sign in")
})
test("long import warnings do not prevent subsequent recipe edits", async () => {
  const { t, user } = await setup()
  const id = await user.mutation(api.imports.start, { url: "https://example.com/notes" })
  await t.mutation(internal.imports.claim, { id, attempt: 1 })
  const withWarnings = { ...draft, warnings: Array.from({ length: 11 }, () => "x".repeat(500)) }
  await t.mutation(api.imports.workerFinish, { secret: "test-worker", id, attempt: 1, draft: withWarnings })
  const recipeId = await user.mutation(api.imports.save, { id, draft: withWarnings })
  await user.mutation(api.recipes.update, { id: recipeId, isFavorite: true })
  expect((await user.query(api.recipes.get, { id: recipeId }))?.isFavorite).toBe(true)
})
test("a repeatedly failed link can recover after a cooldown without creating duplicate jobs", async () => {
  const { t, user } = await setup()
  const id = await user.mutation(api.imports.start, { url: "https://example.com/retry" })
  for (let attempt = 1; attempt <= 3; attempt++) {
    await t.mutation(internal.imports.claim, { id, attempt })
    await t.mutation(internal.imports.expire, { id, attempt })
    if (attempt < 3) await user.mutation(api.imports.retry, { id })
  }
  await expect(user.mutation(api.imports.retry, { id })).rejects.toThrow()
  vi.setSystemTime(Date.now() + 15 * 60_000)
  await user.mutation(api.imports.retry, { id })
  expect(await t.mutation(internal.imports.claim, { id, attempt: 4 })).toBe(true)
  expect(await user.mutation(api.imports.start, { url: "https://example.com/retry" })).toBe(id)
})
test("wrong link shapes never create a job, and partial-source failures keep their recovery hint", async () => {
  const { t, user } = await setup()
  await expect(user.mutation(api.imports.start, { url: "https://youtube.com/@chef" })).rejects.toThrow("specific")
  expect(await user.query(api.imports.list, {})).toEqual([])
  const id = await user.mutation(api.imports.start, { url: "https://youtube.com/shorts/GiqOJyy3oWE" })
  await t.mutation(internal.imports.claim, { id, attempt: 1 })
  await t.mutation(api.imports.workerFinish, { secret: "test-worker", id, attempt: 1, error: "No readable recipe details.", failureCode: "insufficient", searchQuery: "biryani recipe" })
  expect(await user.query(api.imports.get, { id })).toMatchObject({ status: "failed", failureCode: "insufficient", searchQuery: "biryani recipe" })
  await user.mutation(api.imports.retry, { id })
  expect((await user.query(api.imports.get, { id }))?.failureCode).toBeUndefined()
})
test("members can override only a relevance decision, with the same durable job", async () => {
  const { t, user } = await setup()
  const id = await user.mutation(api.imports.start, { url: "https://example.com/cooking-story" })
  await t.mutation(internal.imports.claim, { id, attempt: 1 })
  await t.mutation(api.imports.workerFinish, { secret: "test-worker", id, attempt: 1, error: "May be unrelated.", failureCode: "not_recipe" })
  await expect(t.mutation(api.imports.retry, { id, continueAnyway: true })).rejects.toThrow("Sign in")
  await user.mutation(api.imports.retry, { id, continueAnyway: true })
  await t.mutation(internal.imports.claim, { id, attempt: 2 })
  expect(await t.query(api.imports.workerGet, { secret: "test-worker", id, attempt: 2 })).toMatchObject({ relevanceOverride: true })
  await t.mutation(api.imports.workerFinish, { secret: "test-worker", id, attempt: 2, error: "Unavailable.", failureCode: "unavailable" })
  await expect(user.mutation(api.imports.retry, { id, continueAnyway: true })).rejects.toThrow("Only a relevance")
})
