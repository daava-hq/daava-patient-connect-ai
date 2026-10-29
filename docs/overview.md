# Patient Connect — Product Overview

## Mission

Patient Connect is a multi-organisation dental practice patient engagement platform. It lets dental groups manage their practices' patient communications, appointments, reminders, marketing and reporting from a single authenticated workspace.

## Modules

| Module | Summary |
|--------|---------|
| Login & profile | Email/password + MFA. User profile and notification preferences. |
| Organisation & practice selection | Multi-org hierarchy. Users belong to one or more organisations and practices. |
| Dashboard | KPI cards and activity feed per practice. |
| Patients | Synchronized from Open Dental. Search, filter, view demographics. |
| Appointments | Synchronized from Open Dental. Calendar and list views. |
| Appointment Reminders | Automated SMS/email reminders before appointments. |
| Birthdays | Birthday greeting campaigns. |
| Groups | Patient segmentation into custom groups. |
| Newsletters | Compose and send practice newsletters to group segments. |
| Payment Reminders & Requests | Prompt patients for outstanding balances. |
| Recall | Schedule and track preventive-care recall outreach. |
| Referrals | Track inbound and outbound patient referrals. |
| Surveys | Post-visit satisfaction surveys. |
| Connect | Two-way SMS texting between practice staff and patients. |
| Reports | Per-feature reports with date filters and CSV export. |
| Settings | Practice branding, team management, communication preferences. |

## Architecture

```
Browser
  └── Next.js App Router (React Server Components + Client Components)
        ├── API Routes  (route.ts — server only)
        ├── Server Actions (where appropriate)
        └── Background Jobs (durable, queue-based)
              ├── PostgreSQL  (Drizzle ORM)
              └── Open Dental API  (ODFHIR auth)
```

### Key constraints

- Every database record scoped to a **practice_id**.
- Secrets and database access are **server-side only**.
- Open Dental credentials are stored **per practice** in encrypted storage.
- All API routes enforce **authentication + practice membership**.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict) |
| Database | PostgreSQL |
| ORM | Drizzle ORM + Drizzle Kit |
| Package manager | pnpm |
| Styling | CSS Modules + `styles/tokens.css` |
| Auth | `next-auth` (or equivalent — document final choice here) |
| Background jobs | Documented in `docs/roadmap.md` per milestone |
| Testing | Vitest · React Testing Library · Playwright |

## Branding

- **Logo**: Rounded blue square with white "PC" letters, with "Patient Connect" wordmark alongside.
- **Palette**: White surfaces, light blue-gray backgrounds, navy text, blue primary actions.
- **Interface**: Light-only, responsive, accessible (WCAG AA contrast, keyboard navigation, visible focus).

## Related docs

- Architecture decisions → this file and `docs/database-schema.md`
- Roadmap → `docs/roadmap.md`
- Open Dental → `docs/opendental-integration.md`
- Security → `docs/security.md`
- UI rules → `docs/ui-and-css-rules.md`
- Folder layout → `docs/folder-structure.md`
