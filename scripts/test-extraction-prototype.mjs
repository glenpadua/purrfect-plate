// Real network checks through the running web API. No fixtures or mocked data.
import { mkdir, writeFile } from "node:fs/promises"

const args = process.argv.slice(2)
const base = process.env.EXTRACTION_TEST_BASE_URL || "http://localhost:3101"
const custom = args.flatMap((arg, i) => arg === "--url" ? [args[i + 1]] : [])
const urls = custom.length ? custom : [
  "https://www.instagram.com/p/Dc_6VZeTJPJ/",
  "https://www.instagram.com/p/DdFnOXsDGnV/?img_index=4",
  "https://www.instagram.com/reel/DdJyDKhKk1i/",
  "https://www.youtube.com/shorts/z1XshOQJmrw",
  "https://www.youtube.com/shorts/GiqOJyy3oWE",
  "https://www.youtube.com/shorts/_qFZJjnN73o",
  "https://www.tiktok.com/@biteswithesther/video/7351594254663159083",
  "https://www.recipetineats.com/one-pot-greek-chicken-lemon-rice/",
]
const useProvider = args.includes("--provider")
const directory = `outputs/extraction-prototype/${new Date().toISOString().replaceAll(":", "-")}`
await mkdir(directory, { recursive: true })
const results = []
for (const url of urls) {
  const response = await fetch(`${base}/api/extraction-prototype`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, useProvider, includeTranscript: true }), signal: AbortSignal.timeout(30000),
  })
  let job = await response.json()
  if (!response.ok) throw new Error(`Cannot start ${url}: ${job.error}`)
  console.log(`Started ${job.platform}: ${job.id}`)
  const deadline = Date.now() + 15 * 60_000
  while (job.status === "running" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const status = await fetch(`${base}/api/extraction-prototype?id=${job.id}`, { signal: AbortSignal.timeout(30000) })
    if (!status.ok) throw new Error(`Run ${job.id} could not be observed (HTTP ${status.status}); do not restart it without checking the server.`)
    job = await status.json()
  }
  await writeFile(`${directory}/${job.platform}-${job.id}.json`, JSON.stringify(job, null, 2))
  const result = { url, status: job.status, title: job.recipe?.title || job.title, ingredients: job.recipe?.ingredients.length ?? 0, steps: job.recipe?.steps.length ?? 0, evidence: job.evidence.map(({ kind, text, via }) => ({ kind, characters: text.length, via })), errors: job.attempts.filter((a) => a.outcome === "error" || a.outcome === "skipped"), providerCredits: job.providerCredits, aiUsage: job.aiUsage, jobId: job.id }
  results.push(result)
  console.log(JSON.stringify(result))
}
await writeFile(`${directory}/summary.json`, JSON.stringify({ testedAt: new Date().toISOString(), base, useProvider, results }, null, 2))
console.log(`Evidence written to ${directory}`)
if (results.some((result) => result.status !== "recipe_found")) process.exitCode = 2
