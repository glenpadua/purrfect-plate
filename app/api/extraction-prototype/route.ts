import { allowLocalRequest } from "@/lib/recipe-server"
import { getJob, recentJobs, startJob } from "@/lib/extraction-prototype/jobs"
import { extractionInput } from "@/lib/extraction-prototype/types"
import { localMediaReady } from "@/lib/extraction-prototype/local-media"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } })

export async function GET(request: Request) {
  if (process.env.VERCEL) return json({ error: "The local test bench is not available here." }, 404)
  if (!allowLocalRequest(request)) return json({ error: "Forbidden" }, 403)
  const id = new URL(request.url).searchParams.get("id")
  if (id) {
    const job = getJob(id)
    if (job && new URL(request.url).searchParams.get("download") === "1") {
      return new Response(JSON.stringify(job, null, 2), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="recipe-extraction-${job.platform}-${job.id}.json"` } })
    }
    return job ? json(job) : json({ error: "This local run is no longer available. The server may have restarted or the run expired." }, 404)
  }
  return json({
    configuration: { localMedia: localMediaReady(), supadata: Boolean(process.env.SUPADATA_API_KEY), openai: Boolean(process.env.OPENAI_API_KEY), model: process.env.RECIPE_EXTRACTION_MODEL || "gpt-4.1-mini" },
    jobs: recentJobs(),
  })
}

export async function POST(request: Request) {
  if (process.env.VERCEL) return json({ error: "The local test bench is not available here." }, 404)
  if (!allowLocalRequest(request)) return json({ error: "Forbidden" }, 403)
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "JSON required" }, 415)
  // Bound the actual streamed body, not merely the caller's Content-Length.
  const reader = request.body?.getReader()
  if (!reader) return json({ error: "Request body required" }, 400)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) { await reader.cancel(); return json({ error: "Request too large" }, 413) }
      chunks.push(value)
    }
    const parsed = extractionInput.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")))
    if (!parsed.success) return json({ error: "Enter a valid recipe URL." }, 400)
    return json(startJob(parsed.data), 202)
  } catch (error) {
    return json({ error: error instanceof SyntaxError ? "Invalid JSON" : error instanceof Error ? error.message : "Could not start extraction." }, 400)
  }
}
