import { api } from "@/convex/_generated/api";
import { allowLocalRequest, backend } from "@/lib/recipe-server";
import { optimizeRecipeImage } from "@/lib/recipe-import/images";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!allowLocalRequest(request)) return new Response("Forbidden", { status: 403 });
  if (request.headers.get("content-type") !== "image/jpeg")
    return new Response("JPEG required", { status: 415 });
  const limit = 10 * 1024 * 1024;
  const reader = request.body?.getReader();
  if (!reader) return new Response("Photo required", { status: 400 });
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        return new Response("Photo too large", { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
      return new Response("Invalid JPEG", { status: 400 });
    const { client } = await backend();
    const optimized = await optimizeRecipeImage(bytes);
    const url = await client.mutation(api.recipes.generateUploadUrl, {});
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "image/webp" },
      body: new Uint8Array(optimized),
    });
    if (!response.ok) throw new Error("Upload failed");
    const { storageId } = await response.json();
    await client.mutation(api.recipes.registerUpload, { storageId });
    return Response.json({ storageId }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response("Photo upload failed", { status: 502 });
  }
}
