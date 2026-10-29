---
mode: ask
description: Run a security review checklist on a feature before milestone release.
---

# Security review

**Before you begin**: Read `docs/security.md` and `.github/instructions/security.instructions.md`.

## Input

Feature or scope to review: **[FEATURE_OR_PATH]** (e.g., `src/app/api/newsletters`, or "full Milestone 3")

## Checklist

Work through each item for every file in the scope. Mark [x] for pass, [-] for not applicable, and leave unchecked with a note for findings.

### Authentication & authorisation

- [ ] Every API route and server action calls `getServerSession` before any logic.
- [ ] Every API route and server action calls `requirePracticeMembership` before accessing data.
- [ ] `practice_id` is **never** taken from request body — always from session or verified path param.
- [ ] Role checks are present where elevated permissions are required.
- [ ] Unauthenticated requests return `401`; unauthorized practice access returns `403`.

### Input validation

- [ ] All request bodies and query params are parsed through Zod schemas.
- [ ] Schemas use `.strict()` or explicitly reject unexpected keys.
- [ ] No user input is concatenated into SQL strings.

### Data isolation

- [ ] Every database query on practice-owned tables includes `WHERE practice_id = ?`.
- [ ] Cross-practice isolation is tested (a user from practice B cannot access practice A data).

### Secrets & credentials

- [ ] No secrets in source code, comments or commit messages.
- [ ] Open Dental credentials are encrypted at rest; raw keys never appear in logs or responses.
- [ ] No `process.env` secrets referenced in client-side code.

### Output & logging

- [ ] API error responses never include stack traces.
- [ ] Logs redact patient PII (name, DOB, phone, email).
- [ ] No `console.log(user)` or similar broad object logging.

### Headers & CSP

- [ ] `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` headers are set.

### Webhook verification

- [ ] Inbound webhooks verify HMAC or provider signature before processing.

## Report format

Summarise findings as:
- **PASS** — checklist item confirmed.
- **FINDING** — item failed; include file, line, description and recommended fix.
- **N/A** — not applicable for this scope.

Treat any CRITICAL or HIGH finding as a release blocker.
