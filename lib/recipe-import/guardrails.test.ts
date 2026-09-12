import { expect, test } from "vitest"
import { checkImportTarget, readPreflightDecision, ImportSourceError } from "./guardrails"

test("rejects feeds, profiles, search pages and playlists before processing", () => {
  for (const url of ["https://youtube.com/", "https://youtube.com/@cook", "https://youtube.com/playlist?list=abc", "https://instagram.com/chef/", "https://tiktok.com/@chef", "https://example.com/menu.pdf"]) expect(() => checkImportTarget(url)).toThrow(ImportSourceError)
  for (const url of ["https://youtube.com/shorts/_qFZJjnN73o", "https://youtube.com/watch?v=_qFZJjnN73o&list=abc", "https://instagram.com/p/DdFnOXsDGnV/", "https://example.com/recipe", "https://vm.tiktok.com/abc/"]) expect(() => checkImportTarget(url)).not.toThrow()
})
test("only accepts an unrelated classification backed by actual supplied text", () => {
  const text = "This is a review of the latest laptop display and battery life."
  expect(readPreflightDecision({ classification: "unrelated", quote: text, dish: null }, text).classification).toBe("unrelated")
  expect(readPreflightDecision({ classification: "unrelated", quote: "Invented evidence", dish: null }, text).classification).toBe("unknown")
  expect(readPreflightDecision({ classification: "unknown", quote: "", dish: "Biryani" }, "Biryani").classification).toBe("unknown")
  expect(readPreflightDecision({ classification: "unrelated", quote: text, dish: null }, text + "x".repeat(8000)).classification).toBe("unknown")
})
