import { z } from "zod"

export type ImportFailureCode = "wrong_link" | "not_recipe" | "insufficient" | "unavailable"
export class ImportSourceError extends Error {
  constructor(message: string, public code: ImportFailureCode, public searchQuery?: string, public audit?: Record<string, unknown>) { super(message); this.name = "ImportSourceError" }
}

/** Pure target checks also run before a durable job consumes quota. DNS/redirect
 * safety is still enforced by the fetcher; shape checks are not SSRF protection. */
export function checkImportTarget(value: string) {
  const url = new URL(value)
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "")
  let specific = true
  if (host === "youtube.com" || host === "youtu.be") {
    const id = host === "youtu.be" ? url.pathname.slice(1) : url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)\/?$/)?.[1]
    specific = !!id && /^[\w-]{11}$/.test(id)
  } else if (host === "instagram.com") specific = /^\/(?:p|reel|tv)\/[\w-]+\/?$/.test(url.pathname)
  else if (host === "tiktok.com") specific = /^\/@[\w.-]+\/video\/\d+\/?$/.test(url.pathname) || /^\/t\/[\w-]+\/?$/.test(url.pathname)
  if (!specific) throw new ImportSourceError("Share a specific recipe page, post or video. Profiles, feeds, search pages and playlists cannot be imported.", "wrong_link")
  if (/\.(?:pdf|zip|exe|dmg|mp[34]|mov|jpg|png|webp)$/i.test(url.pathname)) throw new ImportSourceError("Share the recipe page or original social post instead of a direct file link.", "wrong_link")
}

const decisionSchema = z.object({ classification: z.enum(["recipe", "cooking", "unrelated", "unknown"]), quote: z.string().max(500), dish: z.string().max(80).nullable() })
const normalized = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase()
export function readPreflightDecision(raw: unknown, source: string) {
  const decision = decisionSchema.parse(raw)
  // A title, missing keyword, or invented explanation cannot justify rejection.
  if (decision.classification === "unrelated" && (source.length > 8000 || decision.quote.trim().length < 20 || !normalized(source).includes(normalized(decision.quote)))) decision.classification = "unknown"
  if (decision.dish && !normalized(source).includes(normalized(decision.dish))) decision.dish = null
  return decision
}
