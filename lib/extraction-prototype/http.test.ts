import { describe, expect, it } from "vitest";
import { mediaHeaders, type MediaSession } from "./http";

describe("anonymous media session cookie scope", () => {
  const cookie = {
    name: "session",
    value: "anonymous",
    domain: ".tiktok.com",
    path: "/video",
    secure: true,
    hostOnly: false,
  };
  const session: MediaSession = { cookies: [cookie] };
  it("retains cookies for matching CDN domains and paths", () => {
    expect(mediaHeaders(new URL("https://v16.tiktok.com/video/123"), session).Cookie).toBe(
      "session=anonymous",
    );
  });
  it("does not leak cookies to other redirect domains or sibling paths", () => {
    for (const url of [
      "https://tiktok.com.attacker.example/video/123",
      "https://other.example/video",
      "https://v16.tiktok.com/videos",
      "https://nottiktok.com/video",
    ]) {
      expect(mediaHeaders(new URL(url), session).Cookie).toBeUndefined();
    }
  });
  it("honors expiration, host-only scope, and rejects header injection", () => {
    for (const change of [{ expires: 1 }, { hostOnly: true }, { value: "x\r\nInjected: value" }]) {
      expect(
        mediaHeaders(new URL("https://v16.tiktok.com/video"), {
          cookies: [{ ...cookie, ...change }],
        }).Cookie,
      ).toBeUndefined();
    }
  });
});
