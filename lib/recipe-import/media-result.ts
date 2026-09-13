import { z } from "zod";
import type { Evidence } from "./extraction/types";

const videoPassage = z.object({
  seconds: z.number().nonnegative().max(600),
  text: z.string().max(3000),
});
const schema = z.object({
  title: z.string().nullish(),
  author: z.string().nullish(),
  caption: z.string().max(100000).nullish(),
  transcript: z.string().max(100000),
  transcriptVia: z.string().optional(),
  images: z
    .array(z.object({ url: z.string().url(), index: z.number() }))
    .max(10)
    .nullish(),
  frames: z.array(z.object({ label: z.string(), imageUrl: z.string().max(600000) })).max(30),
  warnings: z.array(z.string()),
  analysisUnavailable: z.boolean().optional(),
  videoText: z.array(videoPassage).max(200).optional(),
  visualObservations: z.array(videoPassage).max(200).optional(),
  analysisUsage: z
    .object({
      model: z.string(),
      inputTokens: z.number().nonnegative(),
      outputTokens: z.number().nonnegative(),
      cachedTokens: z.number().nonnegative().optional(),
      seconds: z.number().nonnegative().optional(),
    })
    .optional(),
});

/** Validate the private media boundary and retain how every passage was obtained. */
export function readMediaResult(payload: unknown) {
  const media = schema.parse(payload);
  const evidence: Evidence[] = [];
  if (media.caption)
    evidence.push({
      id: "social-caption",
      kind: "caption",
      text: media.caption,
      via: "Public post caption",
    });
  if (media.transcript)
    evidence.push({
      id: "social-transcript",
      kind: "transcript",
      text: media.transcript,
      via: media.transcriptVia || "Existing video subtitles",
    });
  for (const [index, passage] of (media.videoText ?? []).entries()) {
    if (passage.text.trim())
      evidence.push({
        id: `video-text-${index}`,
        kind: "image_text",
        text: passage.text,
        via: `Model-read video text near ${passage.seconds}s (${media.analysisUsage?.model ?? "video analysis"}); verify against original`,
      });
  }
  for (const [index, passage] of (media.visualObservations ?? []).entries()) {
    if (passage.text.trim())
      evidence.push({
        id: `video-observation-${index}`,
        kind: "visual_observation",
        text: passage.text,
        via: `Unverified visual interpretation near ${passage.seconds}s; not recipe facts`,
      });
  }
  return { ...media, evidence };
}
