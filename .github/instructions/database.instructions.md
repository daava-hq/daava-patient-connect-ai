---
applyTo: "src/db/**"
---

# Database — Copilot instructions

## Drizzle ORM rules

- Define tables with `pgTable` from `drizzle-orm/pg-core`.
- One schema file per domain entity in `src/db/schema/`.
- Export every table and its inferred TypeScript types.
- Use `uuid('id').primaryKey().defaultRandom()` for primary keys.
- Use `timestamp('created_at', { withTimezone: true }).defaultNow().notNull()`.
- Use `timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()`.

## Tenant isolation — mandatory

Every practice-owned table must include:

```ts
practiceId: uuid('practice_id').notNull().references(() => practices.id),
```

Every query on a practice-owned table must include a `WHERE practice_id = :practiceId` condition.

## Migration rules

1. Edit `src/db/schema/<entity>.ts`.
2. Run `pnpm db:generate` — review produced SQL.
3. Run `pnpm db:migrate` — applies to target database.
4. Commit schema + migration file in the same commit.
5. Never hand-edit generated migration SQL.
6. Never drop columns or tables without explicit team approval.

## Query style

```ts
// Always use the Drizzle query builder — never raw SQL strings
import { db } from '@/db';
import { patients } from '@/db/schema/patients';
import { eq, and } from 'drizzle-orm';

const rows = await db
  .select()
  .from(patients)
  .where(and(eq(patients.practiceId, practiceId), eq(patients.status, 'Patient')));
```

## Transactions

Use `db.transaction()` for any operation that modifies multiple tables.

## Soft deletes

Prefer `deletedAt: timestamp(...).nullable()` over physical deletes for most entities. Filter `WHERE deleted_at IS NULL` in all normal queries.

## Prohibited

- No raw SQL template literals (`sql\`...\``  allowed only for expressions Drizzle cannot express).
- No direct database access from Client Components or browser code.
- No schema changes without a migration.
