import { lookup } from "node:dns/promises"
import { request } from "node:https"
import ipaddr from "ipaddr.js"

export type MediaSession = {
  userAgent?: string | null; referer?: string
  cookies: { name: string; value: string; domain: string; path: string; secure: boolean; hostOnly: boolean; expires?: number | null }[]
}

export function mediaHeaders(url: URL, session?: MediaSession, now = Date.now()) {
  const headers: Record<string, string> = {}
  if (!session) return headers
  if (session.userAgent && !/[\r\n]/.test(session.userAgent)) headers["User-Agent"] = session.userAgent
  if (session.referer) headers.Referer = publicUrl(session.referer).href
  const cookies = session.cookies.filter((c) => {
    const domain = c.domain.replace(/^\./, "").toLowerCase()
    const hostMatches = url.hostname === domain || (!c.hostOnly && url.hostname.endsWith(`.${domain}`))
    const pathMatches = url.pathname === c.path || (url.pathname.startsWith(c.path) && (c.path.endsWith("/") || url.pathname[c.path.length] === "/"))
    return domain.includes(".") && hostMatches && pathMatches && (!c.secure || url.protocol === "https:") &&
      (c.expires == null || c.expires * 1000 > now) && /^[!#$%&'*+.^_`|~\w-]+$/.test(c.name) && !/[;\r\n]/.test(c.value)
  })
  if (cookies.length) headers.Cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ")
  return headers
}

export function isPublicAddress(address: string) {
  try { return ipaddr.process(address).range() === "unicast" } catch { return false }
}

export function publicUrl(input: string) {
  const url = new URL(input)
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Use a public HTTPS link without credentials or a custom port.")
  }
  const host = url.hostname.replace(/^\[|\]$/g, "")
  if (!host.includes(".") || /\.(local|localhost|internal|test|invalid)$/i.test(host) || (ipaddr.isValid(host) && !isPublicAddress(host))) {
    throw new Error("Local and private network URLs are not supported.")
  }
  url.hash = ""
  return url
}

// Pin the connection to a checked DNS answer, including every redirect. A URL
// extractor on the household LAN must not become a proxy to private services.
export async function fetchPublicBytes(input: string, maxBytes = 3_000_000, redirects = 0, session?: MediaSession, signal = AbortSignal.timeout(maxBytes > 3_000_000 ? 45000 : 20000)): Promise<{ bytes: Buffer; url: string; status: number; contentType: string }> {
  signal.throwIfAborted()
  if (redirects > 4) throw new Error("Too many redirects.")
  const url = publicUrl(input)
  // One deadline covers DNS and every redirect, rather than restarting a timer
  // at each hop. An expired lookup must not open a connection afterward.
  const addresses = await new Promise<Awaited<ReturnType<typeof lookup>>[]>((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener("abort", abort, { once: true })
    lookup(url.hostname, { all: true }).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort))
  })
  signal.throwIfAborted()
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error("The link resolves to a non-public address.")
  const address = addresses.find((entry) => entry.family === 4) ?? addresses[0]
  const result = await new Promise<{ bytes: Buffer; status: number; location?: string; contentType: string }>((resolve, reject) => {
    const req = request(url, {
      agent: false,
      lookup: (_host, options, callback) => {
        if (options.all) callback(null, [address])
        else callback(null, address.address, address.family)
      },
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PurrfectPlatePrototype/0.1)", Accept: "text/html,application/json,text/xml;q=0.9,*/*;q=0.1", "Accept-Encoding": "identity", ...mediaHeaders(url, session) },
      signal,
    }, (response) => {
      const status = response.statusCode ?? 0
      if (status >= 300 && status < 400) {
        response.resume()
        resolve({ bytes: Buffer.alloc(0), status, location: response.headers.location, contentType: "" })
        return
      }
      const chunks: Buffer[] = []
      let bytes = 0
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length
        if (bytes > maxBytes) { response.destroy(new Error(`Source exceeds the prototype's ${Math.round(maxBytes / 1_000_000)} MB limit.`)); return }
        chunks.push(chunk)
      })
      response.on("error", reject)
      response.on("end", () => resolve({ bytes: Buffer.concat(chunks), status, contentType: String(response.headers["content-type"] ?? "") }))
    })
    req.on("error", reject)
    req.end()
  })
  if (result.location) return fetchPublicBytes(new URL(result.location, url).href, maxBytes, redirects + 1, session, signal)
  return { ...result, url: url.href }
}

export async function fetchPublicPage(input: string, signal?: AbortSignal) {
  const { bytes, ...result } = await fetchPublicBytes(input, undefined, 0, undefined, signal)
  return { ...result, text: bytes.toString("utf8") }
}
