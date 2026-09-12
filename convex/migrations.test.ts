/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { internal } from "./_generated/api"
import schema from "./schema"
const modules = import.meta.glob("./**/!(*.test).ts")

test("draft repairs retain source evidence and reject stale or already-saved results", async () => {
  const t = convexTest(schema, modules)
  const evidenceJson = JSON.stringify({ url: "https://example.com/recipe", evidence: [{ id: "speech", text: "Add flour." }] })
  const id = await t.run(async ctx => {
    const libraryId = await ctx.db.insert("libraries", { name: "Test", slug: "test", createdAt: 1 })
    return ctx.db.insert("imports", { libraryId, createdBy: "test", url: "https://example.com/recipe", sourceKey: "test", platform: "website", status: "needs_review", phase: "Ready", attempt: 1, createdAt: 1, updatedAt: 1, evidenceJson })
  })
  const args = { id, expectedUpdatedAt: 1, draft: { name: "Sauce", tags: [], warnings: [], ingredients: [{ text: "Flour" }], instructions: [{ text: "Add flour." }] }, evidenceJson }
  await expect(t.mutation(internal.migrations.repairUnsavedDraft, { ...args, evidenceJson: evidenceJson.replace("Add flour.", "Bake it.") })).rejects.toThrow("unchanged")
  await t.mutation(internal.migrations.repairUnsavedDraft, args)
  expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ draft: args.draft, evidenceJson })
  await expect(t.mutation(internal.migrations.repairUnsavedDraft, args)).rejects.toThrow("changed")
  await t.run(ctx => ctx.db.patch(id, { status: "saved", updatedAt: 1 }))
  await expect(t.mutation(internal.migrations.repairUnsavedDraft, args)).rejects.toThrow("changed")
})
