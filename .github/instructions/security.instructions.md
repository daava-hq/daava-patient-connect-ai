---
applyTo: "src/lib/auth/**,src/middleware.ts"
---

# Security & auth — Copilot instructions

## Authentication

- Session validation: call `getServerSession(authOptions)` at the top of every protected route handler and server action.
- Return `401` (not a redirect) from API routes when the session is missing.
- Redirect to `/login` from server page components when the session is missing.
- Passwords: hash with `bcrypt` at cost ≥ 12; never store plaintext.
- Rotate `NEXTAUTH_SECRET` through environment — never hardcode.

## Authorisation — required order

```ts
// 1. Auth
const session = await getServerSession(authOptions);
if (!session) return unauthorized();

// 2. Practice membership
const membership = await requirePracticeMembership(session.user.id, practiceId);
// throws PracticeAccessError (→ 403) if not a member

// 3. Role check (when needed)
if (membership.role !== 'admin' && membership.role !== 'owner') return forbidden();

// 4. Resource ownership verified inside the query (WHERE practice_id = ?)
```

## `requirePracticeMembership`

- Defined in `src/lib/auth/guards.ts`.
- Queries `practice_members` for `(user_id, practice_id)`.
- Throws a typed `PracticeAccessError` on failure.
- Never accepts `practiceId` from the request body — always from query params or path params, then re-verify.

## Middleware (`src/middleware.ts`)

- Protect the `/workspace` and `/api` route prefixes.
- Do NOT put authorization or practice-membership logic in middleware — middleware only checks session existence.
- Practice-level auth stays in route handlers and server actions.

## Headers

- Set `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` on all responses.
- Use Next.js `headers()` in `next.config.ts` for global security headers.

## Secrets

- All secrets in environment variables only.
- Never import `process.env.SECRET` in client-side code.
- Encryption key for OD credentials: `CREDENTIALS_ENCRYPTION_KEY` — AES-256-GCM.

## Credential encryption helpers (`src/lib/auth/crypto.ts`)

```ts
export function encrypt(plaintext: string): string { /* AES-256-GCM, returns base64 */ }
export function decrypt(ciphertext: string): string { /* reverse */ }
```

## Prohibited

- No `practice_id` from `req.body` used without membership verification.
- No stack traces in API error responses.
- No secrets in source code, comments or commit messages.
- No `console.log(credential)` or similar logging of sensitive values.
