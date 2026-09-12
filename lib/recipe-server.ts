import "server-only"

import { ConvexHttpClient } from "convex/browser"
import { auth } from "@clerk/nextjs/server"

export async function backend() {
  const { getToken, userId } = await auth()
  if (!userId) throw new Error("Unauthorized")
  const token = await getToken({ template: "convex" })
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url || !token) throw new Error("Recipe authentication is not configured")
  const client = new ConvexHttpClient(url)
  client.setAuth(token)
  return { client }
}

// No CORS. Limit accepted hostnames and reject cross-origin browser requests,
// including DNS rebinding to this otherwise intentionally shared LAN service.
export function allowLocalRequest(request: Request) {
  const host = request.headers.get("host") ?? ""
  const hostname = host.split(":")[0]
  const allowed = (process.env.RECIPE_ALLOWED_HOSTS ?? "localhost,127.0.0.1").split(",")
  if (!allowed.includes(hostname)) return false
  const origin = request.headers.get("origin")
  if (origin && origin !== `http://${host}` && origin !== `https://${host}`) return false
  const site = request.headers.get("sec-fetch-site")
  return !site || site === "same-origin" || site === "none"
}

export function localPhoto<T extends { _id: string; imageUrl: string | null }>(recipe: T): T {
  return { ...recipe, imageUrl: recipe.imageUrl ? `/api/recipes/photo/${recipe._id}` : null }
}
