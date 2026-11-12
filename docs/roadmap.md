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

- [x] Groups foundation: create groups and static memberships (`src/db/schema/groups.ts`, `src/lib/groups/group-repository.ts`); expanded in Task 17.
- [x] Shared campaign & engagement engine: audience selection, template interpolation, state machine, durable background dispatch job, recipient tracking, and consent enforcement (`src/lib/campaigns/`, `src/jobs/dispatch-campaign.ts`, `src/db/schema/campaigns.ts`, `src/db/schema/campaign_recipients.ts`, `src/db/schema/campaign_job_runs.ts`).
- [x] Newsletters module & API endpoints (`src/app/api/campaigns/`, `src/app/api/templates/`, `src/app/api/audience/`).
- [x] Birthdays, Appointment Reminders, Recall, Payment Reminders, Referrals, and Surveys shared infrastructure and API routes (`src/app/api/referrals/`, `src/app/api/surveys/`, `src/app/api/payments/balances/`, `src/db/schema/surveys.ts`, `src/db/schema/referrals.ts`, `src/db/schema/payments.ts`).
- [x] Unit tests for audience selection, campaign state transitions, template interpolation, and consent filtering (`src/lib/campaigns/engagement.test.ts`).

### Task 17 — Patient Groups

- [x] Static and dynamic group CRUD, duplication, archive/restore, search, pagination, member management, and practice-scoped patient selection.
- [x] Strictly validated, server-evaluated dynamic rules for synchronized status, age, birth month, appointment status/date, and contact availability; clinical attributes are excluded.
- [x] Static membership history and group engagement history; dynamic membership is evaluated live and has no persisted membership-change history.
- [x] Independent group-announcement workflow with published Groups template selection, campaign snapshots, draft editing/deletion, audience preview, desktop/mobile preview, scheduling/send-now, cancellation, paginated history, and delivery reports (`src/app/api/groups/[groupId]/announcements/`, `src/components/feature/Groups/GroupsWorkspace.tsx`).
- [x] Validation, repository, API, and tenant-scoping tests.
- [ ] Integrate group selectors into the dedicated birthday campaign and appointment-reminder schedule flows.
- [ ] Define and authorize a business rule for recall eligibility before adding it as a dynamic filter.

### Acceptance criteria

- [x] Group membership is scoped to the practice.
- [x] Newsletter and generic campaign audiences respect group membership, filters, and consent flags.
- [ ] Dedicated birthday and appointment-reminder workflows accept reusable group audiences.
- [x] Durable background jobs persist recipient records prior to dispatch and guarantee idempotency.
- [x] All 8 engagement modules implemented with backend storage, validation, authorization, and API routes.
- [x] Unit tests pass successfully.

### Task 18 — Newsletters

**Status: Newsletter workflow implemented; deployment configuration and binary media uploads remain prerequisites.**

- [x] Newsletter dashboard, paginated history, provider-event summary, and per-campaign recipient report.
- [x] Create/edit modal with a searchable selector for published system/practice templates from the centralized Templates library and desktop/mobile previews; content, subject, and preheader are managed only in the Templates library.
- [x] Newsletter creation does not create or publish reusable templates; template management remains in the centralized Templates library.
- [x] Escaped HTML/text rendering, safe URL validation, and server-side content validation; arbitrary HTML and scripts are not accepted.
- [x] All-patient, static/dynamic group, and custom synchronized audience filters with active-patient, email-consent, and address validation.
- [x] Audience preview and confirmation with eligible-recipient count before scheduling or immediate queueing.
- [x] Draft editing, scheduled/immediate queueing, cancellation, durable campaign dispatch, and dispatch-time consent/address checks.
- [x] Draft history edit flow loads the campaign snapshot and saves changes without mutating its reusable source template.
- [x] Signed SES SNS event verification, event deduplication, delivery/bounce/complaint/open/click tracking, and unsubscribe/complaint consent suppression.
- [x] Unit/API tests for rendering safety, audience email validation, scheduling permissions, SNS verification boundary, and event-handler request behavior.
- [ ] Configure production SES contact-list/event-destination settings and campaign cron; verify provider callbacks with a controlled mailbox.
- [ ] Select managed media storage and implement upload validation before enabling binary image uploads.

See [Newsletter architecture and deployment](./newsletters.md). The migration
adding template snapshots and provider event deduplication must be reviewed and
applied in each environment before those paths can run.

See [Patient Groups and announcements](./groups.md) for the group announcement
campaign flow and its practice-scoped APIs.

---

## Task 14 — Centralized Templates Module

**Goal**: Centralized, categorized, reusable template library for all 9 Patient Connect modules with system templates, practice cloning, rich content structures, variable registry validation, and sample seeding.

### Deliverables
- [x] Database schema & migration for `template_categories`, `templates`, `template_versions`, `template_favorites`, and `template_usage_history` (`src/db/schema/templates.ts`, `src/db/migrations/0003_centralized_templates.sql`).
- [x] Typed variable registry and validation (`src/lib/templates/variable-registry.ts`).
- [x] Template service & repository with cloning and versioning (`src/lib/templates/template-service.ts`).
- [x] System templates seeder covering all 9 categories (`src/lib/templates/sample-templates.ts`).
- [x] API routes for templates, cloning, and variable rendering (`src/app/api/templates/`).
- [x] Centralized Templates Library UI page (`src/app/workspace/templates/page.tsx`).
- [x] Template editors support SMS and email channels, with a required subject for email only.
- [x] Reuse one searchable template picker across Appointment Reminders, Birthdays, Groups, and Newsletters.
- [x] Unit tests for variable validation (`src/lib/templates/templates.test.ts`).

### Acceptance criteria
- [x] System templates are shared across practices and locked against direct modification.
- [x] Practice users can clone system templates into editable practice copies.
- [x] Variable validation detects unresolved placeholders.
- [x] All tests and production build pass successfully.

---

## Task 15 — Appointment Reminders

**Status: Partially implemented.** The practice-scoped schedule, upcoming
reminder dashboard, centralized template selection/preview, manual execution
path, occurrence persistence, cron endpoint, and send-time eligibility checks
are implemented. This task is not production-complete until a real SMS/email
provider, delivery confirmation, and deployment cron are configured.

### Deliverables

- [x] Practice-scoped reminder schedules and deduplicated appointment occurrences.
- [x] Practice-timezone interval calculations and dashboard/history reporting.
- [x] Published centralized Appointment Reminders templates, preview, cloning, and variable checks.
- [x] Published 24-hour email confirmation template with an explicit, signed patient action.
- [x] Open Dental appointment confirmation write path and separate local confirmation status.
- [x] Protected cron endpoints and a two-minute local sample-only runner for reminders, birthdays, and scheduled campaigns, plus manual reminder execution.
- [x] Local/dev-only shared sample-data catalog and seed/reset workflow for appointments, birthdays, groups, newsletters, and group announcements.
- [x] Dashboard-only refresh action rebuilds all sample modules for the exact dedicated sample practice; Upcoming reminders is derived from its appointments and enabled schedules.
- [x] Delete configured reminder schedules with confirmation that their occurrence history is also deleted.
- [x] Sample reset preserves configured reminder schedules other than the legacy sample schedule, clears module histories, turns off enabled birthday campaigns, and refuses while campaigns, reminders, or birthday messages are processing.
- [x] Consent, contact, patient, appointment status, and ownership rechecks before dispatch.
- [x] Filter upcoming reminders by practice-local reminder date and show appointment status in the table.
- [x] Unit tests for DST boundaries, suppression rules, provider errors, template validity, occurrence uniqueness, and practice membership.
- [x] Add AWS SES email adapter; AWS credentials and verified sender configuration remain deployment-specific.
- [ ] Configure production SMS provider and delivery callbacks/polling.
- [ ] Configure the deployment scheduler to call the protected cron endpoint.
- [ ] Add database-backed tests for concurrent duplicate claims and cross-practice access.

### Known limitations

- SMS remains a stub. AWS SES email is enabled only when AWS credentials, region, and verified sender are configured.
- `delivered` reporting requires provider delivery data; there are no provider webhooks yet.
- AWS SES does not support provider-side idempotency keys. Application occurrence deduplication does not prevent duplicates after an ambiguous provider timeout.
- Provider/operatory values are not in the local appointment schema, so templates requiring those variables are blocked.
- The migration has been applied to the database configured for this workspace. Other environments must run `pnpm db:migrate`.
- Verification: `pnpm test` passed (38 tests), `pnpm typecheck` passed, `pnpm lint` passed with pre-existing warnings, and `pnpm build` succeeded. The migration was not applied.

---

## Task 16 — Birthday Engagement

**Status: Feature implementation complete.** The feature uses synchronized
patient records and the shared categorized Templates module. Production cron
registration, SMS delivery, and provider delivery receipts remain deployment /
provider work.

### Deliverables

- [x] Practice-scoped dashboard counts, today's/upcoming lists, fixed date filters, monthly calendar, delivery history, and engagement report.
- [x] Central birthday template selection and preview; the template library opens filtered to Birthdays and supports cloning/editing/saving.
- [x] Admin-only campaign configuration for channel, birthday-relative send date, practice-local time, optional age rules and offer text.
- [x] New campaigns default disabled; the protected five-minute worker materializes durable occurrences only for explicitly enabled campaigns.
- [x] View upcoming delivery schedules calculated from enabled campaigns, including practice-local delivery times and persisted occurrence statuses.
- [x] Birthday-year occurrence uniqueness, atomic worker claims, bounded retries, and send-time checks for patient status, birthdate, template, destination, and opt-out.
- [x] Leap-day policy uses February 28 in non-leap years; date filters and scheduled delivery use the practice timezone.
- [x] Omit full birthdates from browser responses and exclude missing/invalid birthdates.
- [x] Unit/API tests for leap years, timezone boundaries, calendar date ranges, missing birthdates, opt-outs, idempotency constraint, authentication, and practice isolation.
- [ ] Configure the deployment scheduler to call `/api/cron/birthdays` using `APPOINTMENT_REMINDERS_CRON_SECRET`.
- [ ] Configure a production SMS provider and provider delivery callbacks/polling.
- [ ] Add database-backed concurrent worker and provider-timeout recovery tests.

### Known limitations

- The existing SMS adapter remains a stub; scheduled SMS occurrences are tracked as failed until a provider is configured.
- The AWS SES adapter has no provider-side idempotency. A crash after provider acceptance but before persistence can make a retry ambiguous.
- `sent` means accepted by the messaging provider; it is not proof of final delivery.
- Dedicated birthday and appointment-reminder workflows do not yet accept group IDs. Groups can currently be used by the shared campaign audience resolver and Groups announcement draft flow.
- The birthday schema migration (`0002_colossal_iron_fist.sql`) has been applied to the local development database. Tables are named `birthday_engagement_campaigns` and `birthday_engagement_occurrences` to avoid collision with a legacy birthday schema present in the database.

---

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
- [x] Add practice-wide email and SMS send gates (default off) and enforce them across shared campaigns, appointment reminders, and birthday dispatch.
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
