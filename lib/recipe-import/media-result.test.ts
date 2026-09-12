import { expect, test } from "vitest"
import { readMediaResult } from "./media-result"
import { selectablePassages } from "./extraction/providers"

test("admits model-read speech and printed text with provenance while excluding visual guesses", () => {
  const result = readMediaResult({ transcript: "Add 2 eggs.", transcriptVia: "Gemini model transcription; verify against video", frames: [], warnings: [], videoText: [{ seconds: 12, text: "Cook for 5 minutes." }], visualObservations: [{ seconds: 8, text: "Looks like salt." }], analysisUsage: { model: "test-model", inputTokens: 100, outputTokens: 30 } })
  expect(result.evidence.find(e => e.kind === "transcript")?.via).toContain("Gemini")
  expect(selectablePassages(result.evidence).map(p => p.text).join(" ")).toContain("Cook for 5 minutes.")
  expect(selectablePassages(result.evidence).map(p => p.text).join(" ")).not.toContain("Looks like salt")
  expect(result.evidence.find(e => e.kind === "image_text")?.via).toContain("12")
  expect(result.analysisUsage?.inputTokens).toBe(100)
})
