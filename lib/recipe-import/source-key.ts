export function sourceKey(value: string) {
  const url = new URL(value)
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "")
  if (host === "youtube.com" || host === "youtu.be") {
    const id = host === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]
    if (id) return `youtube:${id}`
  }
  if (host === "instagram.com") {
    const id = url.pathname.match(/^\/(?:p|reel|tv)\/([^/]+)/)?.[1]
    if (id) return `instagram:${id}`
  }
  if (host === "tiktok.com") {
    const id = url.pathname.match(/\/video\/(\d+)/)?.[1]
    if (id) return `tiktok:${id}`
  }
  url.hash = ""
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|igsh|stkn|fbclid)/i.test(key)) url.searchParams.delete(key)
  return url.href
}
