---
mode: ask
description: Write a Drizzle ORM schema change and generate a safe migration.
---

# Write a Drizzle migration

**Before you begin**: Read `docs/database-schema.md` and `.github/instructions/database.instructions.md`.

## Input

Change description: **[CHANGE]** (e.g., "Add `sms_opt_out_at` column to `patients`")
Schema file: **[SCHEMA_FILE]** (e.g., `src/db/schema/patients.ts`)

## Steps

1. Open `[SCHEMA_FILE]` and add/modify/remove the column or relation using Drizzle ORM types.

2. If adding a NOT NULL column to an existing table, supply a `.$defaultFn()` or `default()` so the migration does not break existing rows.

3. Run `pnpm db:generate` and open the generated SQL file in `src/db/migrations/`.

4. Review the generated SQL:
   - Confirm it matches the intended change.
   - Confirm no accidental `DROP` statements.
   - Confirm indexes are present for new FK columns.

5. Run `pnpm db:migrate` on the local dev database.

6. Confirm the migration applied:
   ```sql
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = '[TABLE_NAME]' AND column_name = '[COLUMN_NAME]';
   ```

7. Update `docs/database-schema.md` to reflect the change.

8. Commit the schema file and migration file together:
   ```
   chore(db): add sms_opt_out_at to patients
   ```

## Constraints

- Never hand-edit the generated SQL.
- Never drop columns without explicit approval.
- Always test the migration on a copy of production data if the table has existing rows (document this test).

## Verification

Report the exact SQL that was applied and the result of the confirmation query.
