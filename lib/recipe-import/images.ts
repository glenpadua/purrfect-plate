import sharp from "sharp"
import { fetchPublicBytes } from "./extraction/http"

export const MAX_STORED_IMAGE_BYTES = 350_000

/** Shared server boundary for uploaded photos and imported covers. No metadata. */
export async function optimizeRecipeImage(bytes: Buffer) {
  if (bytes.length > 10_000_000) throw new Error("Image exceeds 10 MB.")
  const image = sharp(bytes, { limitInputPixels: 25_000_000, animated: false }).rotate()
  for (const [size, quality] of [[1440, 78], [1200, 68], [960, 58]] as const) {
    const output = await image.clone().resize({ width: size, height: size, fit: "inside", withoutEnlargement: true }).webp({ quality, effort: 4 }).toBuffer()
    if (output.length <= MAX_STORED_IMAGE_BYTES) return output
  }
  throw new Error("This image could not be compressed enough. Choose a simpler photo.")
}

export async function retrieveRecipeImage(url: string, signal?: AbortSignal) {
  const response = await fetchPublicBytes(url, 10_000_000, 0, undefined, signal)
  if (response.status !== 200 || !response.contentType.startsWith("image/")) throw new Error("Source image unavailable.")
  return optimizeRecipeImage(response.bytes)
}
