import sharp from "sharp"
import { fetchPublicBytes } from "./extraction/http"
import { MAX_SOURCE_IMAGE_BYTES, MAX_STORED_IMAGE_BYTES, RECIPE_IMAGE_ENCODINGS } from "../recipe-image-policy"
export { MAX_STORED_IMAGE_BYTES } from "../recipe-image-policy"

/** Shared server boundary for uploaded photos and imported covers. No metadata. */
export async function optimizeRecipeImage(bytes: Buffer) {
  if (bytes.length > MAX_SOURCE_IMAGE_BYTES) throw new Error("Image exceeds 10 MB.")
  const image = sharp(bytes, { limitInputPixels: 25_000_000, animated: false }).rotate()
  for (const [size, quality] of RECIPE_IMAGE_ENCODINGS) {
    const output = await image.clone().resize({ width: size, height: size, fit: "inside", withoutEnlargement: true }).webp({ quality, effort: 4 }).toBuffer()
    if (output.length <= MAX_STORED_IMAGE_BYTES) return output
  }
  throw new Error("This image could not be compressed enough. Choose a simpler photo.")
}

export async function retrieveRecipeImage(url: string, signal?: AbortSignal) {
  const response = await fetchPublicBytes(url, MAX_SOURCE_IMAGE_BYTES, 0, undefined, signal)
  if (response.status !== 200 || !response.contentType.startsWith("image/")) throw new Error("Source image unavailable.")
  return optimizeRecipeImage(response.bytes)
}
