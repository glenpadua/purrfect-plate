/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { afterEach, expect, test, vi } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"
const modules = import.meta.glob("./**/!(*.test).ts")
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })
test("local polling claims once, needs the worker secret, and cannot claim production jobs", async () => {
  vi.useFakeTimers()
  vi.stubEnv("CONVEX_CLOUD_URL", "https://basic-poodle-462.convex.cloud")
  vi.stubEnv("IMPORT_WORKER_SECRET", "test-secret")
  const t = convexTest(schema, modules)
  const id = await t.run(async ctx => {
    const libraryId = await ctx.db.insert("libraries", { name: "Test", slug: "test", createdAt: 1 })
    return ctx.db.insert("imports", { libraryId, createdBy: "test", url: "https://example.com/recipe", sourceKey: "test", platform: "website", status: "queued", phase: "Queued", attempt: 1, createdAt: 1, updatedAt: 1 })
  })
  await expect(t.mutation(api.localImportWorker.claimNext, { secret: "wrong" })).rejects.toThrow("Unauthorized")
  vi.stubEnv("CONVEX_CLOUD_URL", "https://spotted-gazelle-950.convex.cloud")
  await expect(t.mutation(api.localImportWorker.claimNext, { secret: "test-secret" })).rejects.toThrow("Unauthorized")
  vi.stubEnv("CONVEX_CLOUD_URL", "https://basic-poodle-462.convex.cloud")
  expect(await t.mutation(api.localImportWorker.claimNext, { secret: "test-secret" })).toEqual({ id, attempt: 1 })
  expect(await t.mutation(api.localImportWorker.claimNext, { secret: "test-secret" })).toBeNull()
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  expect((await t.run(ctx => ctx.db.get(id)))?.status).toBe("failed")
})
