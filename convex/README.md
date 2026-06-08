# Convex Backend

This app keeps Convex focused on one domain: recipes.

- `schema.ts` defines the single `recipes` table.
- `recipes.ts` provides list, get, create, update, mark-cooked, random, tag-listing, and delete functions.
- `auth.config.ts` keeps providers empty because v1 is intentionally unauthenticated.

## Local workflow

1. Run `pnpm convex:configure` on first setup in this repo.
2. Connect or create a Convex project when prompted.
3. Keep `pnpm convex:dev` running while developing.
4. Deploy backend with `pnpm exec convex deploy`.
