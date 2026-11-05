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
| `APP_ENVIRONMENT` | `local`, `dev`, `stage`, or `production` (defaults to `local` when omitted) |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth session secret |
| `NEXTAUTH_URL` | App base URL (e.g. `http://localhost:3000`) |
| `APPOINTMENT_CONFIRMATION_TOKEN_SECRET` | Random secret of at least 32 characters used to sign email confirmation links; required outside local |
| `APPOINTMENT_REMINDERS_CRON_SECRET` | Bearer secret for the appointment-reminder cron endpoint |
| `RESEND_API_KEY` | Server-side Resend API key |
| `RESEND_FROM_EMAIL` | Sender address on a domain verified with Resend |
| `RESEND_REPLY_TO` | Optional reply-to address |

Practice-specific Open Dental keys are stored **in the database**, not in `.env`.

Keep `APP_ENVIRONMENT` aligned with the database and deployment you are using.
The appointment-reminder sample-data seeder requires `APP_ENVIRONMENT` to be
explicitly set to `local` or `dev` (it does not use the application default),
requires an explicit `DATABASE_URL`, and only writes to its dedicated sample
practice. It does not create synthetic delivery history or reminder schedules.
Use it after migrations:

```bash
pnpm seed:reminders-test-data
```

The script loads `.env.local` when present. It creates ten synthetic patients
and appointments for the sample practice, all with `prem@daava.ai`, and clears
previous reminder history. It does not create, enable, or disable configured
reminder schedules. Prefer **Refresh / reset sample data** on the sample
practice's dashboard for this workflow. The reminders page derives upcoming
reminders from these patient and appointment records and the practice's enabled
schedules; without an enabled schedule, Upcoming reminders remains empty.
Appointments are scheduled across five consecutive local calendar days,
starting eight days ahead, with two appointments per day at 9:00 AM and 10:00 AM.
This keeps all reminder intervals in the future. Every sample appointment has
`Scheduled` status. Only appointments created by the refresh
action are shown or processed in the dedicated sample practice. Reset also removes
non-sample patient and appointment rows in that office; do not use it for
non-test data. It removes the legacy sample-only reminder schedule and
preserves all other configured schedules.
Both reset paths are restricted to the dedicated sample practice in local/dev.

To run a local sample-only cron poll immediately and then every two minutes:

```bash
pnpm reminders:cron:local
```

Keep the process running during the test and stop it with Ctrl+C. It requires
`APPOINTMENT_REMINDERS_CRON_SECRET`, calls only the local server and only
processes the dedicated sample practice. With Resend configured, due reminders
send real email to `prem@daava.ai`; resetting the sample data clears history
and lets enabled schedules create new reminder occurrences. The seeder itself
never sends email.

Email dispatch uses Resend when both `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
are configured. Verify the sender domain in Resend, set these values in
`.env.local` or the deployment secret manager, then restart/redeploy the app.
The key is server-only and must never use a `NEXT_PUBLIC_` prefix.
The adapter sends plain-text messages via
https://resend.com/docs/api-reference/emails/send-email.

### Appointment reminder scheduler

Configure an external scheduler to `POST /api/cron/appointment-reminders` every
two minutes with `Authorization: Bearer $APPOINTMENT_REMINDERS_CRON_SECRET`.
The endpoint processes each practice with an enabled reminder schedule. Do not
expose the secret to the client. A scheduler is not provisioned by this
repository; the job's `schedule` value is descriptive and does not provision
the external scheduler. Each schedule creates one occurrence per eligible
appointment; the cron sends only occurrences whose calculated reminder time
has arrived, and repeated runs do not resend completed occurrences. Thus,
24-hour, 3-day, and 7-day reminders are sent relative to each appointment,
not as a daily digest of every future appointment. Seven-day and three-day
reminders use the configured local send time on the target calendar date;
24-hour reminders use the exact elapsed-time offset. For local sample testing,
use the sample-only runner above. The cron response reports reminder counts (`sent`, `failed`, and
`skipped`) separately from practice-level job failures. For same-day schedules,
appointments dated today become due immediately on the next poll; future-date
appointments remain scheduled for the configured local send time. SMS remains
unconfigured, so dispatch records a provider-unavailable failure.
Delivery confirmation requires a future provider webhook or polling integration.

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
| `pnpm db:generate` | `drizzle-kit generate:pg` | Generate PostgreSQL migration from schema |
| `pnpm db:migrate` | `node --env-file-if-exists=.env.local scripts/migrate.mjs` | Apply pending Drizzle migrations |
| `pnpm db:push` | `drizzle-kit push` | Push schema to dev DB (no migration file) |
| `pnpm db:studio` | `drizzle-kit studio` | Open Drizzle Studio |
| `pnpm seed:templates` | `node --env-file-if-exists=.env.local scripts/seed-templates.mjs` | Add missing system templates in local/dev without deleting existing templates |
| `pnpm seed:appointment-confirmation-template` | `node --env-file-if-exists=.env.local scripts/seed-templates.mjs --appointment-confirmation-only` | Safely add the email confirmation template in local/dev |
| `pnpm seed:reminders-test-data` | `node --env-file-if-exists=.env.local scripts/seed-appointment-reminders-test-data.mjs` | Reset and seed ten local reminder test patients and appointments across five days |
| `pnpm reminders:cron:local` | `node --env-file-if-exists=.env.local scripts/run-appointment-reminders-cron.mjs` | Poll the local sample-only reminder cron every two minutes |

## After every change

1. `pnpm lint` — fix all errors.
2. `pnpm typecheck` — zero errors required.
3. `pnpm test` (targeted file or suite) — all tests green.
4. `pnpm build` — production build must succeed before marking a milestone done.

## Database migrations

1. Edit the Drizzle schema in `src/db/schema/`.
2. Run `pnpm db:generate` — review generated SQL in `src/db/migrations/`.
3. Run `pnpm db:migrate` — loads `.env.local` when present and applies migrations to `DATABASE_URL`.
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
