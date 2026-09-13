import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import {
  MAX_SOURCE_IMAGE_BYTES,
  MAX_STORED_IMAGE_BYTES,
  RECIPE_IMAGE_ENCODINGS,
} from "@purrfect-plate/recipe-core";
export async function chooseRecipePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    exif: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.fileSize ?? new File(asset.uri).size) > MAX_SOURCE_IMAGE_BYTES)
    throw new Error("Choose a photo smaller than 10 MB.");
  for (const [size, quality] of RECIPE_IMAGE_ENCODINGS) {
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > size)
      context.resize(asset.width >= asset.height ? { width: size } : { height: size });
    const image = await context.renderAsync();
    const output = await image.saveAsync({
      format: SaveFormat.WEBP,
      compress: quality / 100,
    });
    const file = new File(output.uri);
    if (file.size <= MAX_STORED_IMAGE_BYTES) return output.uri;
    file.delete();
  }
  throw new Error("This image could not fit the photo limit. Choose a simpler photo.");
}
export async function sendRecipePhoto(uri: string, uploadUrl: string): Promise<string> {
  const file = new File(uri);
  if (file.size > MAX_STORED_IMAGE_BYTES) throw new Error("Choose the photo again to optimize it.");
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/webp" },
    body: await file.bytes(),
  });
  if (!response.ok) throw new Error("Photo upload failed. Please try again.");
  const result = await response.json();
  if (typeof result.storageId !== "string") throw new Error("Photo upload did not finish.");
  return result.storageId;
}
