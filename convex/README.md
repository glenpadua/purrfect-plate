# Convex Backend

Convex owns authenticated shared-library data, uploads, durable imports, pantry/shopping and per-user cooking preferences. The Expo web/native app calls these functions directly through Clerk authentication.

## Start here

- For a feature change, use the root [feature map](../AGENTS.md#find-the-change), then read the adjacent `*.test.ts`. `schema.ts` owns tables/indexes and `model.ts` owns shared validators.
- For authorization, read `access.ts`, `libraries.ts` and `auth.config.ts`, then [the access contract](../docs/architecture.md#api-and-data). User-facing operations must check library membership; client-supplied IDs do not establish access.
- For setup, use the existing development project and private configuration in [README](../README.md#configure-once). A fresh Convex project also needs Clerk, invitations/library setup and worker configuration before it can serve the product.
- For tests, codegen and backend sync, use [Development workflow](../docs/development.md). `convex-test` runs authenticated operations in memory, without deploying or touching shared data. Regenerate `_generated` through Convex tooling after API/schema changes.
- For imports, read [the worker architecture](../docs/architecture.md#environment-and-deployment): development claims jobs through `localImportWorker.ts`; production uses `importWorker.ts` to dispatch to the hosted worker.
- For deployment, follow [release verification](../docs/production-plan.md#required-release-verification). Development sync and production deployment are separate; Vercel does not deploy Convex.

Maintenance functions in `migrations.ts`, `tagMaintenance.ts` and `quantityMaintenance.ts` mutate existing records. Read the specific function's arguments and guards and verify the selected deployment before running one; they are not setup or test commands. Quantity backfill usage lives in [README](../README.md#verify-changes).
