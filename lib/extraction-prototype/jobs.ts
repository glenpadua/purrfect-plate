import { randomUUID } from "node:crypto";
import { publicUrl } from "./http";
import { runExtraction } from "./run";
import { platformFor, recipeGaps, type ExtractionInput, type ExtractionJob } from "./types";

// Local prototype only: jobs survive page closure and Next hot reload, but not
// process restarts. This is not a durable/serverless production worker queue.
const globalStore = globalThis as typeof globalThis & {
  recipeExtractionJobs?: Map<string, ExtractionJob>;
};
const jobs = (globalStore.recipeExtractionJobs ??= new Map());
export function getJob(id: string) {
  const job = jobs.get(id);
  if (job?.status === "recipe_found" && job.recipe && recipeGaps(job.recipe).length) {
    job.status = "partial";
    job.phase = "Some extracted content did not pass source verification";
  }
  return job;
}
export function recentJobs() {
  return [...jobs.keys()]
    .reverse()
    .map((id) => getJob(id)!)
    .map(({ id, url, platform, status, phase, title, recipe, startedAt, finishedAt }) => ({
      id,
      url,
      platform,
      status,
      phase,
      title: recipe?.title || title?.split(" on Instagram:")[0],
      startedAt,
      finishedAt,
    }));
}
export function startJob(input: ExtractionInput) {
  const url = publicUrl(input.url);
  // Strip tracking without losing carousel slide selection or video IDs.
  for (const key of [...url.searchParams.keys()])
    if (/^(utm_|igsh|stkn|fbclid)/i.test(key)) url.searchParams.delete(key);
  const running = [...jobs.values()].filter((job) => job.status === "running");
  const duplicate = running.find((job) => job.url === url.href);
  if (duplicate) return duplicate;
  if (running.length >= 3)
    throw new Error("Three imports are already running. Wait for one to finish.");
  for (const [id, job] of jobs) {
    if (
      job.status !== "running" &&
      (jobs.size >= 30 || Date.now() - Date.parse(job.startedAt) > 3_600_000)
    )
      jobs.delete(id);
  }
  const job: ExtractionJob = {
    id: randomUUID(),
    url: url.href,
    platform: platformFor(url),
    startedAt: new Date().toISOString(),
    status: "running",
    phase: "Starting",
    evidence: [],
    attempts: [],
    warnings: [],
    providerCredits: null,
  };
  jobs.set(job.id, job);
  void runExtraction(job, { ...input, url: url.href });
  return job;
}
