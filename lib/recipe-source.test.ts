import { expect, test } from "vitest";
import { describeSource } from "./recipe-source";

test("source URLs retain attribution and use only validated provider IDs", () => {
  expect(describeSource("https://youtube.com/shorts/z1XshOQJmrw?si=tracking")).toMatchObject({
    url: "https://youtube.com/shorts/z1XshOQJmrw?si=tracking",
    portrait: true,
    embedUrl: "https://www.youtube-nocookie.com/embed/z1XshOQJmrw?autoplay=0&playsinline=1&rel=0",
  });
  expect(
    describeSource("https://www.instagram.com/reel/DdJyDKhKk1i/?utm_source=copy"),
  ).toMatchObject({ instagramUrl: "https://www.instagram.com/p/DdJyDKhKk1i/" });
  expect(
    describeSource("https://www.tiktok.com/@biteswithesther/video/7351594254663159083"),
  ).toMatchObject({
    embedUrl: "https://www.tiktok.com/player/v1/7351594254663159083?autoplay=0&controls=1&rel=0",
  });
  for (const url of [
    "https://youtube.com.evil.example/watch?v=z1XshOQJmrw",
    "https://youtube.com/watch?v=invalid",
    "https://recipes.example/dinner",
    "https://www.tiktok.com/@creator",
    "https://youtube.com:444/watch?v=z1XshOQJmrw",
  ])
    expect(describeSource(url)?.embedUrl).toBeUndefined();
  expect(describeSource("javascript:alert(1)")).toBeNull();
  expect(describeSource("https://user:password@youtube.com/watch?v=z1XshOQJmrw")).toBeNull();
});
