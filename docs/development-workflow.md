# Patient Connect — Development Workflow

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 LTS |
| pnpm | ≥ 9 |
| PostgreSQL | ≥ 15 |

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment template
cp .env.example .env.local
# Edit .env.local — fill DATABASE_URL, NEXTAUTH_SECRET, etc.

# 3. Push schema to dev database
pnpm db:push

# 4. Start dev server
pnpm dev
```

## Environment variables (`.env.local`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth session secret |
| `NEXTAUTH_URL` | App base URL (e.g. `http://localhost:3000`) |

Practice-specific Open Dental keys are stored **in the database**, not in `.env`.

## Available scripts

All scripts are defined in `package.json`. Use only these — do not invent new ones.

| Script | Command | Purpose |
|--------|---------|---------|
| `pnpm dev` | `next dev` | Start development server |
| `pnpm build` | `next build` | Production build |
| `pnpm start` | `next start` | Serve production build |
| `pnpm lint` | `next lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` | TypeScript type check |
| `pnpm test` | `vitest run` | Unit + integration tests |
| `pnpm test:watch` | `vitest` | Tests in watch mode |
| `pnpm test:e2e` | `playwright test` | Playwright e2e tests |
| `pnpm db:generate` | `drizzle-kit generate` | Generate SQL migration from schema |
| `pnpm db:migrate` | `drizzle-kit migrate` | Apply pending migrations |
| `pnpm db:push` | `drizzle-kit push` | Push schema to dev DB (no migration file) |
| `pnpm db:studio` | `drizzle-kit studio` | Open Drizzle Studio |

## After every change

1. `pnpm lint` — fix all errors.
2. `pnpm typecheck` — zero errors required.
3. `pnpm test` (targeted file or suite) — all tests green.
4. `pnpm build` — production build must succeed before marking a milestone done.

## Database migrations

1. Edit the Drizzle schema in `src/db/schema/`.
2. Run `pnpm db:generate` — review generated SQL in `src/db/migrations/`.
3. Run `pnpm db:migrate` — applies to the target database.
4. Commit both the schema change and the migration file together.
5. Never hand-edit generated migration files.

## Testing conventions

- **Unit tests**: `src/**/*.test.ts(x)` — Vitest + React Testing Library.
- **Integration tests**: `src/**/*.test.ts` that use a test database or mock adapters.
- **E2e tests**: `e2e/**/*.spec.ts` — Playwright against local dev server.
- Mock external services (Open Dental, email providers) explicitly; never make real calls in tests.
- Use `vi.mock()` / `vi.fn()` for service boundaries.

## Debugging

- Use `console.error` sparingly; redact PII before logging.
- Use `DEBUG=*` env var for verbose Next.js/Node output during investigation.
- Never leave debug `console.log` calls in committed code.
