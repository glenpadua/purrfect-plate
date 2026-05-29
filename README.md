# Purrfect Plate

A cozy, cat-themed recipe catalogue for `what should I cook today?` moments. Purrfect Plate is a small personal app for saving favorite dishes, browsing them visually, and eventually letting a playful randomizer pick dinner.

## Stack

- Next.js App Router
- Convex for recipe data and file storage
- Tailwind CSS v4 + shadcn/ui
- Framer Motion

## Local Setup

Use Node.js `24.13.1` and pnpm.

```bash
pnpm install
pnpm convex:configure
pnpm dev
```

`pnpm convex:configure` creates or connects the Convex deployment and writes the required local environment values.

## Scripts

```bash
pnpm dev
pnpm build
pnpm test:run
pnpm convex:configure
pnpm convex:dev
pnpm convex:codegen
```

## Current State

- Mobile-first placeholder routes are in place for the library, add, detail, edit, and 404 pages.
- Convex has a single `recipes` table with baseline recipe functions.
- Auth and starter todo/demo code have been removed.
- The first data pass will align the recipe model with Convex file storage.
