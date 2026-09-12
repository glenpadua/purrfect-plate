import { z } from "zod"

export type Platform = "instagram" | "tiktok" | "youtube" | "website"
export type Evidence = { id: string; kind: "page" | "structured_recipe" | "recipe_card" | "caption" | "transcript" | "image_text" | "visual_observation"; text: string; via: string }
export type Attempt = { stage: string; outcome: "ok" | "unavailable" | "error" | "skipped"; detail: string; elapsedMs: number }
const sourcedText = z.object({ text: z.string().min(1).max(12000), sourceId: z.string(), quote: z.string().min(1).max(12000) }).strict()
export const recipeSchema = z.object({
  title: z.string().min(1).max(500),
  ingredients: z.array(sourcedText).max(100),
  steps: z.array(sourcedText).max(100),
  servings: z.string().nullable(),
  warnings: z.array(z.string()).max(30),
}).strict()
export type ExtractedRecipe = z.infer<typeof recipeSchema>
export type ExtractionJob = {
  id: string; url: string; platform: Platform; startedAt: string; finishedAt?: string;
  status: "running" | "recipe_found" | "partial" | "blocked" | "failed";
  phase: string; title?: string; author?: string; finalUrl?: string;
  evidence: Evidence[]; attempts: Attempt[]; recipe?: ExtractedRecipe;
  warnings: string[]; providerCredits: number | null;
  aiUsage?: { model: string; inputTokens: number; outputTokens: number };
  aiCandidate?: ExtractedRecipe;
  transcriptJobId?: string;
}
export const extractionInput = z.object({
  url: z.string().trim().url().max(2048),
  useProvider: z.boolean().default(true),
  includeTranscript: z.boolean().default(true),
  useLocalMedia: z.boolean().default(true),
  includeFrames: z.boolean().default(true),
}).strict()
export type ExtractionInput = z.infer<typeof extractionInput>

export function platformFor(url: URL): Platform {
  const host = url.hostname.toLowerCase()
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram"
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok"
  if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) return "youtube"
  return "website"
}

export function recipeGaps(recipe: ExtractedRecipe) {
  return [!recipe.ingredients.length && "The source did not provide an ingredient list.", !recipe.steps.length && "The source did not provide cooking instructions.", recipe.warnings.some((w) => /^An unsupported (ingredient|step) was removed/.test(w)) && "Some proposed recipe content could not be verified; this result needs review."].filter(Boolean) as string[]
}
