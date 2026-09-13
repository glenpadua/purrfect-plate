import { timingSafeEqual } from "node:crypto"
import { ConvexHttpClient } from "convex/browser"
import { z } from "zod"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { ImportSourceError } from "@/lib/recipe-import/guardrails"
import { importRecipe } from "@/lib/recipe-import/service"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const secret = process.env.IMPORT_WORKER_SECRET
  const expected = Buffer.from(`Bearer ${secret || ""}`)
  const received = Buffer.from(request.headers.get("authorization") || "")
  if (!secret || expected.length !== received.length || !timingSafeEqual(expected, received)) return new Response("Unauthorized", { status: 401 })
  const text = await request.text()
  if (text.length > 2048) return new Response("Too large", { status: 413 })
  let body: unknown
  try { body = JSON.parse(text) } catch { return new Response("Invalid job", { status: 400 }) }
  const parsed = z.object({ id: z.string().max(64), attempt: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) }).safeParse(body)
  if (!parsed.success) return new Response("Invalid job", { status: 400 })
  const client = new ConvexHttpClient(process.env.CONVEX_URL!)
  const args = { secret, id: parsed.data.id as Id<"imports">, attempt: parsed.data.attempt }
  const job = await client.query(api.imports.workerGet, args)
  if (!job) return Response.json({ status: "already_handled" })
  try {
    const result = await importRecipe(job.url, phase => client.mutation(api.imports.workerProgress, { ...args, phase }).then(() => undefined), { relevanceOverride: job.relevanceOverride })
    let imageStorageId: Id<"_storage"> | undefined
    if (result.image) {
      const uploadUrl = await client.mutation(api.imports.workerUploadUrl, { secret })
      const upload = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/webp" }, body: new Uint8Array(result.image) })
      if (upload.ok) imageStorageId = (await upload.json()).storageId
      else result.draft.warnings.push("The cover could not be saved; a placeholder is used.")
    }
    await client.mutation(api.imports.workerFinish, { ...args, draft: result.draft, evidenceJson: result.evidenceJson, author: result.author, imageStorageId })
    return Response.json({ status: "needs_review" })
  } catch (error) {
    const message = error instanceof z.ZodError ? "We read the source, but could not organise it into a valid recipe. Try importing again." : error instanceof ImportSourceError ? error.message : error instanceof Error && /source|recipe information|link/i.test(error.message) ? error.message.slice(0, 300) : "The recipe could not be imported. Check the link and try again."
    await client.mutation(api.imports.workerFinish, { ...args, error: message, ...(error instanceof ImportSourceError ? { failureCode: error.code, ...(error.audit ? { evidenceJson: JSON.stringify(error.audit) } : {}), ...(error.searchQuery ? { searchQuery: error.searchQuery } : {}) } : {}) })
    return Response.json({ status: "failed" })
  }
}
