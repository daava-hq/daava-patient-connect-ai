---
mode: ask
description: Create a new Drizzle ORM table definition and generate a migration.
---

# Add a new database table

**Before you begin**: Read `docs/database-schema.md` and `.github/instructions/database.instructions.md`.

## Input

Table name: **[TABLE_NAME]** (snake_case, plural, e.g., `campaign_recipients`)
Domain: **[DOMAIN]** (e.g., campaigns)
Columns: **[LIST_COLUMNS_AND_TYPES]**

## Steps

1. Create or update `src/db/schema/[domain].ts`:
   - Use `pgTable` from `drizzle-orm/pg-core`.
   - Add `id uuid PK`, `practice_id uuid FK`, `created_at`, `updated_at`.
   - Add the requested columns with correct Drizzle types.
   - Export the table and inferred `Select` / `Insert` types.

2. Add the table to `src/db/index.ts` (or the central schema export).

3. Add relevant indexes if the table will be queried by `practice_id` + another column.

4. Run `pnpm db:generate` and review the generated SQL migration in `src/db/migrations/`.

5. Run `pnpm db:migrate` (on local dev DB) and confirm it applies without errors.

6. Update `docs/database-schema.md` with the new table's column list.

## Constraints

- Every practice-owned table must have `practice_id uuid NOT NULL REFERENCES practices(id)`.
- Use soft-delete (`deleted_at timestamptz`) unless there is a strong reason for hard-delete.
- Do not hand-edit the generated SQL migration.

## Verification

Confirm the migration applied: query `SELECT table_name FROM information_schema.tables WHERE table_name = '[TABLE_NAME]'`.
