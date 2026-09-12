import { api } from "@/convex/_generated/api"
import { allowLocalRequest, backend, localPhoto } from "@/lib/recipe-server"

export const runtime = "nodejs"

export async function POST(request: Request, context: { params: Promise<{ operation: string }> }) {
  if (!allowLocalRequest(request)) return new Response("Forbidden", { status: 403 })
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new Response("JSON required", { status: 415 })
  const { operation } = await context.params
  try {
    const text = await request.text()
    if (text.length > 65536) return new Response("Too large", { status: 413 })
    const input = JSON.parse(text)
    if (!input || typeof input !== "object" || Array.isArray(input) || "serverSecret" in input) return new Response("Invalid request", { status: 400 })
    const { client } = await backend()
    const args = input
    let result
    switch (operation) {
      case "list": result = (await client.query(api.recipes.list, args)).map(localPhoto); break
      case "get": {
        const recipe = await client.query(api.recipes.get, args)
        result = recipe ? localPhoto(recipe) : null
        break
      }
      case "listTags": result = await client.query(api.recipes.listTags, args); break
      case "create": result = await client.mutation(api.recipes.create, args); break
      case "update": result = await client.mutation(api.recipes.update, args); break
      case "markCooked": result = await client.mutation(api.recipes.markCooked, args); break
      case "remove": result = await client.mutation(api.recipes.remove, args); break
      default: return new Response("Not found", { status: 404 })
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch {
    // Never return Convex error objects, which may contain the secret arguments.
    return new Response("Recipe request failed", { status: 502 })
  }
}
