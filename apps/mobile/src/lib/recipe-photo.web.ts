import {
  MAX_SOURCE_IMAGE_BYTES,
  MAX_STORED_IMAGE_BYTES,
  RECIPE_IMAGE_ENCODINGS,
} from "@purrfect-plate/recipe-core";
export async function chooseRecipePhoto(): Promise<string | null> {
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!file) return null;
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error("Choose a photo smaller than 10 MB.");
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error("This browser cannot read that photo. Try a JPEG or PNG.");
  }
  try {
    for (const [size, quality] of RECIPE_IMAGE_ENCODINGS) {
      const scale = Math.min(1, size / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot prepare photos.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality / 100),
      );
      if (blob?.type === "image/webp" && blob.size <= MAX_STORED_IMAGE_BYTES)
        return URL.createObjectURL(blob);
    }
    throw new Error("This image could not fit the photo limit. Choose a simpler photo.");
  } finally {
    image.close();
  }
}
export async function sendRecipePhoto(uri: string, uploadUrl: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  if (blob.type !== "image/webp" || blob.size > MAX_STORED_IMAGE_BYTES)
    throw new Error("Choose the photo again to optimize it.");
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/webp" },
    body: blob,
  });
  if (!response.ok) throw new Error("Photo upload failed. Please try again.");
  const result = await response.json();
  if (typeof result.storageId !== "string") throw new Error("Photo upload did not finish.");
  return result.storageId;
}
