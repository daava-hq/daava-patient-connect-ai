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
- Unauthenticated requests to any `/workspace` or `/api` route must redirect to `/login`.
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
- Implement opt-out handling: update consent flags and suppress future messages.

## Webhook verification

- Verify HMAC signatures on all inbound webhooks before processing.
- Store raw payload for replay if signature fails.
- Document per-provider verification in `docs/opendental-integration.md` when implemented.

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
