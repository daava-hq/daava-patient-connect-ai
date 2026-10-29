---
mode: ask
description: Scaffold a new feature module (pages, components, API routes, DB schema, tests).
---

# Scaffold a new feature module

**Before you begin**: Read `docs/overview.md`, `docs/folder-structure.md`, `docs/database-schema.md`, and `.github/copilot-instructions.md`.

## Input

The feature to scaffold: **[FEATURE_NAME]** (e.g., "Newsletters", "Recall", "Surveys")

## Steps

1. Create the App Router route segment at `src/app/(workspace)/[feature-slug]/page.tsx` with a loading and error boundary.
2. Create a feature folder in `src/components/feature/[FeatureName]/`.
3. Add a Drizzle schema file `src/db/schema/[feature].ts` with `practice_id` FK.
4. Generate and review a migration with `pnpm db:generate`.
5. Create API routes at `src/app/api/[feature]/route.ts` with auth + practice guard.
6. Create a repository file `src/lib/[feature]/[feature]-repository.ts`.
7. Add a Zod validation schema in `src/lib/validation/[feature].ts`.
8. Create a CSS Module `src/components/feature/[FeatureName]/[FeatureName].module.css` using design tokens.
9. Write at least one unit test and verify it passes.
10. Update `docs/roadmap.md` to mark the feature as in-progress.

## Constraints

- Follow all naming conventions in `docs/folder-structure.md`.
- Every API route must pass the auth + practice guard checklist in `docs/security.md`.
- Do not implement UI logic in Server Components that should be in Client Components, and vice versa.

## Verification

Run `pnpm lint && pnpm typecheck && pnpm test` and report the results.
