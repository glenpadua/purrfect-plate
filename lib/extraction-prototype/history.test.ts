import { describe, expect, it } from "vitest";
import { groupRuns, sourceKey } from "./history";

describe("source history", () => {
  it("groups tracking and platform URL variants while retaining every attempt", () => {
    const runs = [
      { id: "latest", url: "https://youtube.com/shorts/_qFZJjnN73o?si=x" },
      { id: "different", url: "https://youtube.com/shorts/z1XshOQJmrw" },
      { id: "older", url: "https://www.youtube.com/watch?v=_qFZJjnN73o" },
      { id: "oldest", url: "https://youtu.be/_qFZJjnN73o" },
    ];
    const groups = groupRuns(runs);
    expect(groups).toHaveLength(2);
    expect(groups[0].latest.id).toBe("latest");
    expect(groups[0].runs.map((r) => r.id)).toEqual(["latest", "older", "oldest"]);
  });
  it("groups the same Instagram post while preserving meaningful website queries", () => {
    expect(sourceKey("https://www.instagram.com/reel/abc/?utm_source=x")).toBe(
      sourceKey("https://instagram.com/p/abc/?img_index=4"),
    );
    expect(sourceKey("https://example.com/recipe?id=1")).not.toBe(
      sourceKey("https://example.com/recipe?id=2"),
    );
  });
});
