# Patient Connect — Security

## Threat model summary

Patient Connect handles protected health information (PHI) and dental practice credentials. The primary threats are:

- Unauthorized cross-practice data access (tenant isolation failure).
- Credential exposure (Open Dental API keys, database credentials).
- Injection attacks (SQL, XSS, SSRF).
- Privilege escalation within a practice or organisation.

## Authentication

- Use `next-auth` (Credentials provider with bcrypt password hashing at cost ≥ 12).
- Session tokens are HTTP-only, Secure, SameSite=Strict cookies.
- MFA (TOTP) planned for Milestone 3.
- Unauthenticated requests to protected workspace/API routes must redirect to `/login`. The email appointment-confirmation route is intentionally public and is authorized only by its signed, expiring reminder capability.
- The root entry and `/login` routes check the server session. Authenticated users are routed according to their saved practice selection; workspace routes verify that selection against the signed-in user's `/api/practices` list and return users with no valid selection to `/workspace/choose-practice`. The browser-stored practice ID is only a navigation hint and must still be verified by each protected API operation.
- **Password change & recovery**: Password reset tokens are cryptographically generated, hashed in the database, and expire after 15 minutes. Password recovery requires external email delivery integration (e.g., SendGrid or SMTP provider configured via environment variables `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`).

## Authorisation model

Every protected server action must verify in order:

1. **Authentication** — valid session exists.
2. **Organisation membership** — user belongs to the resource's organisation.
3. **Practice membership** — user is a member of `practice_members` for the requested practice.
4. **Role check** — user's role permits the operation (owner > admin > member).
5. **Resource ownership** — the requested record's `practice_id` matches the verified practice.

Never trust a `practice_id` supplied by the client without re-verifying membership server-side.

## Tenant isolation

- Every practice-owned table has a `practice_id` column.
- All queries include `WHERE practice_id = :verified_practice_id`.
- Use a shared `requirePracticeMembership(userId, practiceId)` guard in `src/lib/auth/guards.ts`.
- Verify in route handlers AND server actions — not only in middleware.

## Credential storage

- Open Dental API keys are encrypted at rest (AES-256-GCM) in `practice_opendental_credentials`.
- Encryption key stored in `CREDENTIALS_ENCRYPTION_KEY` environment variable — never in source.
- Never log, expose in responses, or serialize raw credentials.
- Database `DATABASE_URL` and `NEXTAUTH_SECRET` in environment variables only.

## Input validation

- Validate all untrusted input with Zod schemas in `src/lib/validation/`.
- Use parameterized queries only (Drizzle ORM enforces this).
- Sanitize any user-supplied content rendered as HTML.
- Reject unexpected fields with strict schema parsing (`.strict()`).

## API route security checklist

Every `route.ts` must:

- [ ] Call `getServerSession` (or equivalent) and return 401 if no session.
- [ ] Verify practice membership and return 403 if unauthorized.
- [ ] Validate request body/params with Zod.
- [ ] Use `practice_id` from the verified session or practice membership — not from the request body.
- [ ] Return typed errors without leaking internal stack traces to the client.

## Privacy

- Store only the patient fields required for engagement features (see `docs/database-schema.md`).
- Redact all patient PII (name, DOB, phone, email) from logs and error messages.
- Enforce communication consent flags (`sms_consent`, `email_consent`) before any outbound message.
- Enforce practice-wide `sms_enabled` and `email_enabled` gates immediately before dispatch in every outbound worker. Both flags default to false; only practice owners/admins may change them. These gates supplement, and never replace, patient consent checks.
- Implement opt-out handling: update consent flags and suppress future messages.
- Appointment reminders re-check consent, practice ownership, appointment status, patient status, and destination immediately before provider dispatch. Only `Scheduled` appointments for active `Patient` records are eligible; this status is not interpreted as attendance confirmation.
- Appointment confirmation links contain a signed, expiring capability bound to one sent email reminder. They do not include patient identifiers or practice/appointment IDs supplied by the browser. The public confirmation page performs no write on GET; only an explicit POST action can confirm, and the server resolves the reminder, appointment, practice, and encrypted Open Dental credentials from the signed reminder ID.
- The confirmation capability uses `APPOINTMENT_CONFIRMATION_TOKEN_SECRET` (at least 32 characters; configured in every non-local environment) and expires after 30 days. It can only confirm a future, scheduled appointment for an active patient. The local `confirmation_status` is updated only after Open Dental accepts the dedicated confirmation request; the appointment's `status` is preserved.
- Reminder occurrences are deduplicated by appointment, schedule, channel, and patient. Provider adapters receive the occurrence ID as an idempotency key.
- The reminder cron endpoint requires `APPOINTMENT_REMINDERS_CRON_SECRET` as a bearer token and compares it in constant time. Never expose this secret to browser code.
- The reminder, birthday, and campaign cron endpoints accept `sampleData=true` only when `APP_ENVIRONMENT` is explicitly `local` or `dev`, and then process only the reserved sample practice. The local sample cron runner also refuses non-loopback app URLs. Ordinary cron calls remain unscoped and must only be used with the intended scheduler/database.
- Birthday dashboard, campaign, preview, and history queries are practice-scoped and require membership; campaign creation and changes require practice owner/admin access. Birthday campaigns are disabled by default and only an explicit admin enablement schedules messages.
- Group APIs verify practice membership before group/patient queries. Static
  member writes check both group and patient practice ownership in a
  transaction. Group-targeted campaign filters accept only group IDs belonging
  to the authorized practice; archived groups are excluded from audience
  resolution. Birthday campaigns do not use group filters and target all
  otherwise-eligible patients, subject to optional age rules. The API rejects
  new legacy `groupIds` values, and dispatch ignores any previously stored
  values. Appointment reminder schedules also do not use group filters and
  include all otherwise-eligible appointments. The `/api/groups/options` route
  returns minimal active-group choices only to workflows that select groups,
  after verifying practice membership.
  Dynamic group criteria use a strict allow-list of synchronized demographic,
  appointment, status, contact-availability, and Open Dental due-recall fields.
  Recall sync and audience resolution are practice-scoped; sync requires owner
  authorization. Recall campaigns require active dynamic groups with the
  approved due-recall criterion and are constrained to active patients with
  channel-specific consent and a usable destination. Recall scheduling/send-now
  and cancellation require a practice owner or admin. Dispatch re-evaluates
  current due-recall group eligibility, active status, consent, destination,
  and practice channel settings before sending; email template content is
  rendered through the structured, escaped newsletter renderer. Scheduling
  also requires the campaign's source template to remain published for Recall
  and match its channel. Recipient-history responses expose only the internal
  recipient reference, delivery status, retry count, and update time—not patient
  IDs, provider message IDs, or raw delivery errors. If multiple active due
  recalls exist, the earliest due date is used in the message.
  Audience preview returns sample names only, never contact details or
  birthdates. Clinical attributes   are rejected, age/date-of-birth is used only for server-side filtering, and
  birthdate values are not returned by group APIs. Group membership does not
  confer communication consent; campaigns re-check consent before dispatch.
- Newsletter APIs verify practice membership on reads and drafts and require
  practice owner/admin authorization for scheduling, immediate queueing, and
  cancellation. Draft content is a structured block document; server rendering
  escapes text and attributes, rejects unsupported variables, permits only
  safe links and HTTPS image URLs, and does not accept arbitrary HTML or
  scripts. Newsletter audiences remain practice-scoped and require active
  patient status, email consent, and a syntactically valid email both at
  preview and immediately before dispatch.
- `POST /api/webhooks/ses` accepts only the configured SNS topic and verifies
  SNS RSA signatures against a bounded HTTPS certificate URL in that topic's
  AWS region. Provider message IDs are correlated to newsletter recipients
  before state or consent updates. SNS event IDs are persisted uniquely to
  suppress webhook replays. Permanent bounces, complaints, and confirmed
  unsubscribe events disable email consent for the matching patient in the
  campaign practice. Raw webhook payloads are not retained.
- Birthday queries exclude missing birthdates and do not return full birthdates to the browser. Dispatch rechecks current patient status, birthdate, campaign settings, destination, template ownership/status, and SMS/email consent immediately before sending.
- Birthday occurrences are unique per campaign, patient, and birthday year and are atomically claimed by the worker. The protected `/api/cron/birthdays` endpoint uses the same constant-time bearer secret as appointment reminders. Provider acceptance followed by a lost response can still be ambiguous; AWS SES does not provide provider-side idempotency, so an infrastructure failure at that point can result in a retry duplicate.
- SMS remains an unconfigured stub. Email uses AWS SES only when `AWS_REGION`, `AWS_SES_FROM_EMAIL`, and AWS SDK credentials are available; the SDK client and credentials remain server-side.
- Appointment and campaign email content is sent to AWS SES. Before sending patient data, verify applicable privacy, consent, contractual, and regulatory requirements with AWS and your organization.
- `APP_ENVIRONMENT` identifies `local`, `dev`, `stage`, or `production`. Sample-data seeding and reset fail closed outside `local`/`dev`; the seeder requires an explicit database URL. The reset API requires an authenticated practice admin and verifies the exact reserved sample practice (slug, name, and organisation) before modifying it. Every deletion is practice-scoped, and reset is blocked while campaigns are scheduled/processing, an appointment reminder is processing, or birthday campaigns are enabled. Campaign templates referenced by another practice are preserved.

## Webhook verification

- Verify HMAC signatures on all inbound webhooks before processing.
- Store raw payload for replay if signature fails.
- Document per-provider verification in `docs/opendental-integration.md` when implemented.
- SES notifications use SNS RSA signature verification and are documented in
  `docs/newsletters.md`; do not apply the generic HMAC rule to those SNS envelopes.

## Security review process

- Run `.github/prompts/13-security-review.prompt.md` before each milestone release.
- Treat all CRITICAL/HIGH findings as release blockers.
- Document resolved findings in a `SECURITY-REVIEW.md` when created.

## Known risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Cross-tenant data leak | `practice_id` on every query; server-side membership check |
| Credential exposure | Encrypted at rest; env vars only; never client-side |
| Mass assignment | Strict Zod schemas; never spread raw body into DB calls |
| SSRF via Open Dental URL | Fixed base URL constant; never accept URLs from client |
| XSS | React escaping; CSP header (to be added in Milestone 1) |
