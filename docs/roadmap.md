# Patient Connect — Roadmap

## Overview

Six-week phased delivery. Each milestone has explicit acceptance criteria. A milestone is **done** only when all acceptance criteria are met, lint/typecheck/tests pass, and docs are updated.

---

## Milestone 1 — Foundation (Week 1)

**Goal**: Working Next.js app with authentication, workspace shell, and database connection.

### Deliverables

- Next.js 14 App Router project with TypeScript strict mode.
- PostgreSQL connection via Drizzle ORM.
- `organisations`, `practices`, `users`, `practice_members` tables and initial migration.
- `next-auth` authentication (email/password).
- Login page with validation and error states.
- Authenticated workspace layout: header (logo, practice selector, user menu), sidebar, content area.
- Practice selector — user can switch between their practices.
- Design tokens (`styles/tokens.css`) and global styles.
- CSP header configuration.
- ESLint, Prettier, `tsconfig.json` (strict), Vitest and Playwright configuration.

### Acceptance criteria

- [x] `pnpm dev` starts without errors.
- [x] `pnpm build` succeeds.
- [x] `pnpm lint` and `pnpm typecheck` pass with zero errors.
- [x] A user can log in (via NextAuth Credentials provider with bcrypt password verification).
- [x] Unauthenticated requests to protected workspace routes protected by server session and guards.
- [x] Practice membership and authorization guards (`requirePracticeMembership`) implemented on server.
- [x] Shell UI matches branding spec (logo, navy text, blue primary, white surfaces).
- [x] Full UI design system components (AppLogo, AppSidebar, AppHeader, Breadcrumbs, GlobalSearch, UserProfileMenu, PageHeader, StatCard, DataTable, Pagination, SearchInput, FilterBar, StatusBadge, SectionCard, EmptyState, LoadingState, ErrorState, ConfirmDialog, FormField, ToastProvider) and Patient Engagements navigation implemented.
- [x] Unit tests for authentication and tenancy guards pass.

---

## Milestone 2 — Patients & Appointments (Week 2)

**Goal**: Read-only patient and appointment sync from Open Dental with list and detail views.

### Deliverables

- [x] `patients` table + migration (`src/db/schema/patients.ts`).
- [x] `appointments` table + migration (`src/db/schema/appointments.ts`).
- [x] `practice_opendental_credentials` table + AES-256-GCM encryption (`src/lib/opendental/crypto.ts`).
- [x] Open Dental HTTP client (`src/lib/opendental/client.ts`) with ODFHIR auth, bounded retries, exponential back-off + jitter, `Retry-After` handling, and server-only security.
- [x] `sync-patients` and `sync-appointments` durable background jobs (`src/jobs/sync-patients.ts`, `src/jobs/sync-appointments.ts`) with pagination, Offset, DateTStamp watermarking, and missing patient reconciliation.
- [x] Patients and Appointments list pages with search, status badges, pagination, and sync triggers.

### Acceptance criteria

- [x] Patient and appointment sync jobs fetch successfully via Open Dental API specs with pagination and incremental watermarking.
- [x] Appointment synchronization includes safe reconciliation for appointments with missing patients (auto-stubbing).
- [x] Cross-practice isolation: user can only see their practice's data (enforced in repository and API guards).
- [x] Credentials stored encrypted; raw keys never exposed.
- [x] Patients and appointments pages load, search, filter, and paginate correctly.
- [x] Unit tests for sync logic, repositories, reconciliation, and upsert idempotency pass.

---

## Milestone 3 — Appointment Reminders & Dashboard (Week 3)

**Goal**: Automated appointment reminders and a live dashboard.

### Deliverables

- Dashboard: KPI cards (upcoming appointments, pending reminders, active patients), activity feed.
- Appointment Reminders module: compose template, schedule rule, preview recipients.
- Background job to send SMS/email reminders at configured intervals.
- Communication provider integration (Twilio SMS / SendGrid email — TBD).
- Consent check before every outbound message.
- Reminders report: delivery status, open rates, opt-outs.
- MFA (TOTP) for user accounts.

### Acceptance criteria

- [ ] Dashboard displays correct KPIs for the selected practice.
- [ ] Reminder job sends messages only to consenting patients.
- [ ] Opt-out updates `sms_consent`/`email_consent` and suppresses future messages.
- [ ] Delivery status is persisted and visible in the reminders report.
- [ ] MFA enrolment and verification flow works end-to-end.

---

## Milestone 4 — Groups, Newsletters & Birthdays (Week 4)

**Goal**: Patient segmentation, broadcast newsletters, and birthday greetings.

### Deliverables

- Groups module: create/edit/delete groups, add/remove patients.
- Newsletters module: compose (rich text), select group, schedule or send immediately.
- Birthdays module: auto-greeting campaigns by birthday month/week.
- Group and newsletter reports.

### Acceptance criteria

- [ ] Group membership is scoped to the practice.
- [ ] Newsletter send respects group membership and email consent.
- [ ] Birthday campaigns trigger on the correct date relative to the practice timezone.
- [ ] Reports show send counts and delivery status.

---

## Milestone 5 — Payments, Recall, Referrals & Surveys (Week 5)

**Goal**: Financial outreach, preventive-care recall, referral tracking, and post-visit surveys.

### Deliverables

- Payment Reminders: send outstanding balance prompts; track status.
- Recall: configure recall intervals per procedure; generate recall list; send outreach.
- Referrals: log inbound/outbound referrals; referral source report.
- Surveys: build survey templates; send post-visit surveys; collect responses.
- Module reports for each feature.

### Acceptance criteria

- [ ] Payment reminders only go to patients with a balance (requires read from OD or manual entry).
- [ ] Recall list is generated correctly based on last appointment date + configured interval.
- [ ] Survey responses are stored per patient and practice.
- [ ] All outbound messages respect consent flags.

---

## Milestone 6 — Connect (Two-way Texting) & Polish (Week 6)

**Goal**: Two-way SMS messaging, full reports, settings and production readiness.

### Deliverables

- Connect module: conversation inbox per practice; send/receive messages; assign to team member.
- Complete Reports section: per-module reports with date filters and CSV export.
- Practice settings: branding upload, team management, communication preferences.
- Performance audit and bundle optimisation.
- Full Playwright e2e test suite covering core flows.
- Production deployment checklist (env vars, migrations, HTTPS, CSP, rate limiting).

### Acceptance criteria

- [ ] Inbound SMS messages appear in the inbox within 10 seconds of receipt (webhook).
- [ ] Inbound webhook signature is verified before processing.
- [ ] All reports export to valid CSV.
- [ ] No CRITICAL or HIGH security findings from `13-security-review` prompt.
- [ ] `pnpm build` and all tests pass in CI.
- [ ] Production deployment checklist complete.

---

## Backlog / Future

- Dark mode.
- Native mobile app (React Native / Expo).
- Open Dental write-back (appointment confirmation, opt-out recording).
- Advanced analytics and custom report builder.
- Multi-language support.
