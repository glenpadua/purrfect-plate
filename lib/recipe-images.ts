"use client"

import imageCompression from "browser-image-compression"

import type { Id } from "@/convex/_generated/dataModel"

const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024

export type PreparedRecipeImage = {
  file: File
  previewUrl: string
}

export function validateRecipeImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.")
  }

  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 10 MB.")
  }
}

export async function prepareRecipeImage(
  file: File,
): Promise<PreparedRecipeImage> {
  validateRecipeImage(file)

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 2000,
      initialQuality: 0.85,
      useWebWorker: true,
      fileType: "image/jpeg",
    })

    const jpegFile = new File(
      [compressed],
      `${file.name.replace(/\.[^.]+$/, "") || "recipe"}.jpg`,
      {
        type: "image/jpeg",
        lastModified: Date.now(),
      },
    )

    return {
      file: jpegFile,
      previewUrl: URL.createObjectURL(jpegFile),
    }
  } catch {
    throw new Error(
      "This photo could not be prepared for upload. Try choosing a JPEG image.",
    )
  }
}

export async function uploadRecipeImage(
  uploadUrl: string,
  file: File,
): Promise<Id<"_storage">> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error("Photo upload failed. Try again.")
  }

  const { storageId } = (await response.json()) as { storageId?: string }

  if (!storageId) {
    throw new Error("Photo upload did not return a storage ID.")
  }

  return storageId as Id<"_storage">
}
