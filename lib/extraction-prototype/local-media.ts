import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { fetchPublicBytes } from "./http";

const exec = promisify(execFile);
const script = path.join(process.cwd(), "scripts/extraction-worker/retrieve.py");
// Runtime configuration keeps Next's bundler from tracing a platform-specific
// Python environment (including symlinks into Homebrew) into the app bundle.
const python = () => process.env.EXTRACTION_PYTHON || "";
export const localMediaReady = () =>
  !process.env.VERCEL && existsSync(/* turbopackIgnore: true */ python()) && existsSync(script);
const metadataSchema = z.object({
  title: z.string().nullish(),
  author: z.string().nullish(),
  caption: z.string().max(100000),
  transcript: z.string().max(100000),
  transcriptLanguage: z.string().optional(),
  duration: z.number().nullish(),
  videoUrl: z.string().url().optional(),
  audioUrl: z.string().url().optional(),
  videoHasAudio: z.boolean().optional(),
  mediaSession: z
    .object({
      userAgent: z.string().max(1000).nullish(),
      referer: z.string().url(),
      cookies: z
        .array(
          z.object({
            name: z.string().max(200),
            value: z.string().max(10000),
            domain: z.string().max(300),
            path: z.string().max(2000),
            secure: z.boolean(),
            hostOnly: z.boolean(),
            expires: z.number().nullish(),
          }),
        )
        .max(100),
    })
    .optional(),
  images: z
    .array(z.object({ url: z.string().url(), index: z.number().int().min(1).max(10) }))
    .max(10),
  warnings: z.array(z.string()).max(20),
});
export type LocalMetadata = z.infer<typeof metadataSchema>;

async function worker(args: string[]) {
  if (!localMediaReady())
    throw new Error(
      "Run node scripts/setup-extraction-worker.mjs to enable local social retrieval.",
    );
  try {
    const result = await exec(python(), [script, ...args], {
      timeout: 65000,
      killSignal: "SIGKILL",
      maxBuffer: 1_000_000,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: process.env.NODE_ENV,
        EXTRACTION_NODE: process.execPath,
        PYTHONUNBUFFERED: "1",
      },
    });
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(
      "Local social worker failed or exceeded its 65-second limit. No account cookies were used.",
    );
  }
}
export async function retrieveLocalMedia(url: string, includeTranscript: boolean) {
  return metadataSchema.parse(await worker([url, ...(includeTranscript ? ["--transcript"] : [])]));
}

export async function downloadImage(url: string) {
  const response = await fetchPublicBytes(url, 5_000_000);
  if (response.status !== 200 || !/^image\/(jpeg|png|webp)(;|$)/.test(response.contentType))
    throw new Error("Post image could not be retrieved in a supported format.");
  return `data:${response.contentType.split(";")[0]};base64,${response.bytes.toString("base64")}`;
}

export async function processLocalMedia(
  metadata: LocalMetadata,
  options: { audio: boolean; frames: boolean },
) {
  if (metadata.duration && metadata.duration > 600)
    throw new Error(
      "This prototype processes media up to ten minutes. Longer videos need chunked processing.",
    );
  const durationLimit = Math.ceil(metadata.duration || 600);
  const frameInterval = Math.max(4, Math.ceil(durationLimit / 30));
  const directory = await mkdtemp(path.join(tmpdir(), "recipe-media-"));
  try {
    const { ffmpeg } = z.object({ ffmpeg: z.string() }).parse(await worker(["--ffmpeg"]));
    const download = async (url: string, name: string) => {
      const result = await fetchPublicBytes(url, 75_000_000, 0, metadata.mediaSession);
      if (result.status !== 200) throw new Error(`Media returned HTTP ${result.status}.`);
      const filename = path.join(directory, name);
      await writeFile(filename, result.bytes);
      return filename;
    };
    const warnings: string[] = [];
    let video: string | undefined;
    if (
      metadata.videoUrl &&
      (options.frames || (options.audio && (metadata.videoHasAudio || !metadata.audioUrl)))
    ) {
      try {
        video = await download(metadata.videoUrl, "video.mp4");
      } catch (error) {
        warnings.push(
          `Video stream unavailable: ${error instanceof Error ? error.message : "download failed"} Separate audio retrieval will still be attempted when available.`,
        );
      }
    }
    const convert = async (args: string[]) => {
      try {
        await exec(
          ffmpeg,
          ["-nostdin", "-v", "error", "-y", "-protocol_whitelist", "file,pipe", ...args],
          { timeout: 30000, killSignal: "SIGKILL", maxBuffer: 100000 },
        );
      } catch {
        throw new Error("Downloaded media could not be decoded within the prototype's limits.");
      }
    };
    let audio: Buffer | undefined;
    if (options.audio) {
      // TikTok's separate audio URL may be only the backing music. The combined
      // video contains the creator's voiceover and takes precedence.
      const input =
        video && metadata.videoHasAudio
          ? video
          : metadata.audioUrl
            ? await download(metadata.audioUrl, "audio-source")
            : video;
      if (input) {
        try {
          const output = path.join(directory, "audio.wav");
          await convert([
            "-i",
            input,
            "-t",
            String(durationLimit),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            output,
          ]);
          audio = await readFile(output);
        } catch {
          warnings.push(
            "This media has no decodable audio track; inspect visual evidence instead.",
          );
        }
      }
    }
    const frames: { label: string; imageUrl: string }[] = [];
    if (options.frames && video) {
      await convert([
        "-i",
        video,
        "-t",
        String(durationLimit),
        "-vf",
        `fps=1/${frameInterval},scale=640:-2`,
        "-frames:v",
        "30",
        path.join(directory, "frame-%03d.jpg"),
      ]);
      const files = (await readdir(directory)).filter((f) => /^frame-\d+\.jpg$/.test(f)).sort();
      for (const [i, file] of files.entries())
        frames.push({
          label: `Frame near ${i * frameInterval + frameInterval / 2}s`,
          imageUrl: `data:image/jpeg;base64,${(await readFile(path.join(directory, file))).toString("base64")}`,
        });
      warnings.push(
        `Up to 30 frames sampled every ${frameInterval} seconds across the clip. Brief overlays and actions may be missed; frame times are approximate.`,
      );
    }
    if (!metadata.duration)
      warnings.push(
        "Source duration was unavailable. Audio and frames were limited to the first ten minutes.",
      );
    return { audio, frames, warnings };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
