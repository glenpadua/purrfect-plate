import { expect, test } from "vitest";
import sharp from "sharp";
import { optimizeRecipeImage } from "./images";

test("large camera photos become bounded WebP without location metadata", async () => {
  const input = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: "#bd7351" },
  })
    .jpeg()
    .withExif({ IFD0: { Copyright: "camera metadata" } })
    .toBuffer();
  const output = await optimizeRecipeImage(input);
  const info = await sharp(output).metadata();
  expect(output.length).toBeLessThanOrEqual(350000);
  expect(info.format).toBe("webp");
  expect(info.width).toBeLessThanOrEqual(1440);
  expect(info.height).toBeLessThanOrEqual(1440);
  expect(info.exif).toBeUndefined();
});
test("rejects oversized and non-image inputs before storing", async () => {
  await expect(optimizeRecipeImage(Buffer.alloc(10000001))).rejects.toThrow("10 MB");
  await expect(optimizeRecipeImage(Buffer.from("not a photo"))).rejects.toThrow();
});
