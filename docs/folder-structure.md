# Patient Connect — Folder Structure

## Root

```
patient-connect/
├── .github/
│   ├── copilot-instructions.md      # Global Copilot rules
│   ├── instructions/                # Scoped instruction files
│   └── prompts/                     # Numbered prompt files
├── docs/                            # Architecture & process docs
├── e2e/                             # Playwright end-to-end tests
├── public/                          # Static assets (logo, fonts)
├── src/
│   ├── app/                         # Next.js App Router
│   ├── components/                  # Shared UI components
│   ├── db/                          # Drizzle schema, migrations, client
│   ├── jobs/                        # Background job definitions
│   ├── lib/                         # Shared utilities and integrations
│   └── types/                       # Global TypeScript types
├── styles/
│   ├── tokens.css                   # Design tokens (CSS custom properties)
│   └── globals.css                  # Global resets and base styles
├── AGENTS.md
├── package.json
├── pnpm-lock.yaml
├── drizzle.config.ts
├── next.config.ts
├── tsconfig.json
└── vitest.config.ts
```

## src/app/ — Next.js App Router

```
src/app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── layout.tsx
├── (workspace)/                     # Authenticated area
│   ├── layout.tsx                   # Workspace shell (header, sidebar)
│   ├── dashboard/
│   │   └── page.tsx
│   ├── patients/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── appointments/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── reminders/
│   ├── birthdays/
│   ├── groups/
│   ├── newsletters/
│   ├── payments/
│   ├── recall/
│   ├── referrals/
│   ├── surveys/
│   ├── connect/
│   ├── reports/
│   └── settings/
├── api/
│   ├── auth/[...nextauth]/route.ts
│   ├── patients/route.ts
│   ├── patients/[id]/route.ts
│   ├── appointments/route.ts
│   └── ...                          # One route.ts per resource
├── layout.tsx                       # Root layout
├── not-found.tsx
└── error.tsx
```

## src/components/ — Shared UI

```
src/components/
├── layout/
│   ├── Header/
│   │   ├── Header.tsx
│   │   └── Header.module.css
│   ├── Sidebar/
│   └── PageShell/
├── ui/
│   ├── Button/
│   ├── Input/
│   ├── Select/
│   ├── Modal/
│   ├── Table/
│   ├── Badge/
│   ├── Card/
│   ├── Avatar/
│   └── ...
└── feature/                         # Feature-specific shared components
    ├── PatientCard/
    ├── AppointmentBadge/
    └── ...
```

Each component folder:
```
ComponentName/
├── ComponentName.tsx
├── ComponentName.module.css
└── ComponentName.test.tsx           # If unit-testable in isolation
```

## src/db/ — Database

```
src/db/
├── index.ts                         # Drizzle client (server only)
├── schema/
│   ├── users.ts
│   ├── organisations.ts
│   ├── practices.ts
│   ├── patients.ts
│   ├── appointments.ts
│   └── ...                          # One file per domain entity
└── migrations/                      # Drizzle Kit generated SQL
```

## src/lib/ — Shared utilities

```
src/lib/
├── auth/
│   ├── session.ts                   # Session helpers
│   └── guards.ts                    # Practice membership checks
├── opendental/
│   ├── client.ts                    # HTTP client with ODFHIR auth
│   ├── patients.ts                  # Patient endpoints
│   └── appointments.ts              # Appointment endpoints
├── validation/
│   └── schemas.ts                   # Zod schemas
├── errors.ts                        # Typed error classes
└── utils.ts                         # General helpers
```

## src/jobs/ — Background jobs

```
src/jobs/
├── sync-patients.ts
├── sync-appointments.ts
└── send-reminders.ts
```

## e2e/ — Playwright

```
e2e/
├── auth.spec.ts
├── patients.spec.ts
├── appointments.spec.ts
└── helpers/
    └── login.ts
```

## Naming conventions

| Kind | Pattern | Example |
|------|---------|---------|
| Component file | PascalCase | `PatientCard.tsx` |
| CSS Module | `Name.module.css` | `PatientCard.module.css` |
| CSS class | camelCase | `.cardHeader` |
| Hook | `useXxx` | `usePatients.ts` |
| Service/repo | descriptive | `patient-repository.ts` |
| Type / Interface | PascalCase | `PatientRecord` |
| DB column | `snake_case` | `practice_id` |
| Test | `*.test.ts(x)` | `PatientCard.test.tsx` |
| API route | `route.ts` | `src/app/api/patients/route.ts` |
