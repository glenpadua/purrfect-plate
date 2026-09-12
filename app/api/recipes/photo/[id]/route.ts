import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { allowLocalRequest, backend } from "@/lib/recipe-server"

export const runtime = "nodejs"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!allowLocalRequest(request)) return new Response("Forbidden", { status: 403 })
  try {
    const { id } = await context.params
    const { client } = await backend()
    const recipe = await client.query(api.recipes.get, { id: id as Id<"recipes"> })
    if (!recipe?.imageUrl) return new Response("Not found", { status: 404 })
    const photo = await fetch(recipe.imageUrl)
    if (!photo.ok) throw new Error("Photo unavailable")
    return new Response(photo.body, { headers: { "Content-Type": photo.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff" } })
  } catch {
    return new Response("Photo unavailable", { status: 502 })
  }
}
