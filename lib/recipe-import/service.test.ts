// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest"
import { importRecipe } from "./service"
import { ImportSourceError } from "./guardrails"

// Network adapters are external seams; parsing, relevance, media validation and
// normalization remain real. DNS fails like a cloud-blocked public video page.
vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => { throw new Error("Source unavailable") }) }))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

function setupProviders(media: Record<string, unknown>, title = "") {
  vi.stubEnv("MEDIA_WORKER_URL", "https://media.example.com")
  vi.stubEnv("MEDIA_WORKER_SECRET", "private-worker-test-secret")
  vi.stubEnv("OPENAI_API_KEY", "private-openai-test-secret")
  const fetch = vi.fn(async (url: string, _options?: RequestInit): Promise<Response> => {
    if (url.endsWith("/metadata")) return Response.json({ title })
    if (url.endsWith("/analyze")) return Response.json({ transcript: "", frames: [], warnings: ["No spoken instructions were recovered."], analysisUsage: { model: "video-model", inputTokens: 5100, outputTokens: 770, seconds: 6 }, ...media })
    throw new Error(`Unexpected provider request: ${url}`)
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

test("a visual-only import keeps its bounded evidence and media cost when no readable recipe exists", async () => {
  const fetch = setupProviders({ visualObservations: [{ seconds: 4, text: "An unidentified powder is added to a pot." }] })
  const url = "https://youtube.com/shorts/_qFZJjnN73o"
  const failure = await importRecipe(url, async () => {}).catch(error => error)
  expect(failure).toBeInstanceOf(ImportSourceError)
  expect(failure.code).toBe("insufficient")
  expect(failure.audit).toMatchObject({
    url, finalUrl: url, platform: "youtube",
    evidence: [{ kind: "visual_observation", text: "An unidentified powder is added to a pot." }],
    mediaUsage: { model: "video-model", inputTokens: 5100, outputTokens: 770 },
    preflight: { classification: "unknown" },
    warnings: expect.arrayContaining(["No spoken instructions were recovered."]),
  })
  expect(failure.audit.usage).toBeUndefined()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(JSON.stringify(failure.audit)).not.toContain("private-worker-test-secret")
})

test("empty normalized recipes retain model usage and citations, with oversized diagnostics explicitly bounded", async () => {
  const fetch = setupProviders({
    videoText: [{ seconds: 1, text: "Creator watermark" }],
    visualObservations: Array.from({ length: 200 }, (_, index) => ({ seconds: index, text: "Unidentified ingredients in a pot. ".repeat(80) })),
  }, "Biryani: a silent cooking video with no ingredient quantities")
  const network = fetch.getMockImplementation()!
  fetch.mockImplementation(async (url, options) => {
    if (url !== "https://api.openai.com/v1/responses") return network(url, options)
    const body = JSON.parse(String(options?.body))
    const preflight = body.text.format.name === "recipe_preflight"
    return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(preflight
      ? { classification: "unknown", quote: "", dish: "Biryani" }
      : { name: "Biryani", tags: [], ingredients: [], instructions: [], servings: null, warnings: ["The only readable text was a creator watermark."] }) }] }], usage: { input_tokens: preflight ? 200 : 700, output_tokens: preflight ? 30 : 90 } })
  })
  const failure = await importRecipe("https://youtube.com/shorts/_qFZJjnN73o", async () => {}).catch(error => error)
  expect(failure.code).toBe("insufficient")
  expect(failure.searchQuery).toBe("Biryani recipe")
  expect(failure.audit).toMatchObject({
    sourceTitle: "Biryani: a silent cooking video with no ingredient quantities",
    usage: { model: "gpt-5.4-2026-03-05", inputTokens: 700, outputTokens: 90 },
    mediaUsage: { inputTokens: 5100 },
    preflight: { usage: { inputTokens: 200, outputTokens: 30 } },
    citations: { passages: [{ text: "Creator watermark" }], selection: { ingredients: [], instructions: [] } },
    warnings: expect.arrayContaining(["The only readable text was a creator watermark."]),
    evidenceTruncated: true,
  })
  expect(failure.audit.evidence[0]).toMatchObject({ kind: "image_text", text: "Creator watermark" })
  const serialized = JSON.stringify(failure.audit)
  expect(serialized.length).toBeLessThan(200000)
  expect(serialized).not.toContain("private-openai-test-secret")
  expect(serialized).not.toContain("imageUrl")
  expect(fetch).toHaveBeenCalledTimes(4)
})
