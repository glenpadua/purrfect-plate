# Purrfect Plate

A shared cat-themed recipe library for Glen and Millusha. Import public links, review recipes, play supported sources inline, adjust portions and units, use cook mode, and keep a simple shared pantry and shopping list.

## Stack

- Next.js 16 / React 19 on Vercel; Tailwind, shadcn and Framer Motion.
- Convex for authenticated shared-library data, storage and durable import jobs.
- Clerk for Google and email-code sign-in. Verified invitations grant membership; both users share one library.
- A private Python/FastAPI media service using yt-dlp, Instaloader, youtube-transcript-api and FFmpeg.
- OpenAI: `gpt-5.4-2026-03-05` with low reasoning for readable recipe normalization; `gpt-4o-mini-transcribe` for audio; `gpt-4.1-mini` for OCR and frame inspection. Complete publisher JSON-LD recipes bypass AI normalization.
- Gemini 3.6 Flash for bounded YouTube video-input fallback when native access is blocked.
- Sharp for server-side image optimization.

## Development

Use Node 24 and pnpm 10. Configure credentials privately using .env.local.example as a reference.

```bash
pnpm install --frozen-lockfile
pnpm exec convex dev
pnpm dev --port 3101
pnpm test:run
pnpm build
```

Stop the dev server before changing dependencies. pnpm uses a hoisted layout; installing packages can move modules while Webpack still references old paths. Restart after installation. If an interrupted upgrade leaves stale paths, stop the server, move .next aside, rebuild, then restart.

## Hosted pilot

Web: https://purrfect-plate-theta.vercel.app

Production Convex: spotted-gazelle-950. Development: basic-poodle-462. Private media project: purrfect-plate-media.

Both Vercel projects are connected to the GitHub repository for automatic production deployment from `main`. The media project uses `services/media` as its root. Convex functions still deploy separately with `pnpm exec convex deploy`.

Clerk currently uses the supplied development instance until a domain and production instance are configured. This is a private pilot, not yet a completed public-launch acceptance. See docs/production-plan.md and docs/architecture.md for outstanding checks and boundaries.

## Image storage

New images are metadata-free WebP, at most 1440 pixels on either side and 350,000 bytes. Compression increases if needed. Video/audio/frames remain temporary; only a final cover is saved to Convex. The 53 migrated photos total 6,372,958 bytes, with the largest at 221,066 bytes. Missing covers use a placeholder.

## Import behaviour

Paste a public HTTPS recipe link, wait for a durable draft, review its ingredients/steps/warnings and save. Repeated canonical links reuse a job; repeated saves return one recipe. Wrong target shapes reject early; a small relevance check screens unrelated content. Missing source facts are flagged rather than invented. Tags stay at three or fewer, with dish tags grouping variants. Original evidence is kept separately from editable recipe content. Visual guesses never become recipe facts.

The local extraction bench remains at /extraction-prototype; its API is disabled on Vercel. Detailed earlier experiments are in docs/extraction-prototype.md.

## Start here for contributors and agents

- [Architecture and operations](docs/architecture.md): module ownership, authentication, jobs, image lifecycle and known limits.
- [Import guardrails](docs/import-guardrails.md): cheap relevance checks, limits and honest alternatives.
- [Cooking behavior](docs/cooking.md): supported amounts, unit conventions and test seams.
- [Pantry and shopping](docs/pantry.md): binary presence, conservative ingredient matching and future reviewed photo/voice updates.
- [Inline sources](docs/source-embeds.md): supported players, mobile layout and platform limitations.
- [Production acceptance](docs/production-plan.md): verified behavior versus remaining checks.
- [YouTube investigation](docs/youtube-retrieval.md): evidence and the current fallback experiment.
- [Mobile plan](docs/mobile-plan.md): Expo, Clerk/Convex reuse, Mac setup and installation on both iPhones.

Run `pnpm test:run` and `pnpm exec tsc --noEmit` before deployment. Use the production build for route and bundling checks; tests do not substitute for hosted sign-in, source extraction or real-device acceptance. Deploy additive Convex changes before the web build. Keep credentials and generated evidence out of Git.

## Mobile reuse

Mobile clients will use the same Clerk identity and Convex functions. Extraction and AI stay server-side. The native client needs its own UI, share entry point and image upload integration; see [the mobile plan](docs/mobile-plan.md).
