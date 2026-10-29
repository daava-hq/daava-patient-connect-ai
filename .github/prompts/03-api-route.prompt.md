---
mode: ask
description: Add a validated, authorized API route handler.
---

# Add an API route handler

**Before you begin**: Read `docs/security.md` and `.github/instructions/api.instructions.md`.

## Input

Resource: **[RESOURCE]** (e.g., `newsletters`)
Method: **[HTTP_METHOD]** (`GET` | `POST` | `PATCH` | `DELETE`)
Path: **[PATH]** (e.g., `src/app/api/newsletters/route.ts`)

## Steps

1. Create `[PATH]` (or add the method to an existing route file).

2. Import and call `getServerSession(authOptions)` — return `401` if missing.

3. Extract `practiceId` from the verified session (never from request body).

4. Call `requirePracticeMembership(session.user.id, practiceId)` — `PracticeAccessError` → `403`.

5. Define a Zod schema for the request body / query params and parse with `.safeParse()` — return `400` on failure.

6. Delegate to the repository layer; do not write DB queries inline.

7. Return the correct HTTP status code and a typed JSON body.

8. Write at least two tests: success path and 403 cross-practice attempt.

## Response shape

```ts
// Success
NextResponse.json({ data: result }, { status: 200 | 201 })

// Error
NextResponse.json({ error: string | ZodFlattenedError }, { status: 400 | 401 | 403 | 404 | 500 })
```

## Verification

Run `pnpm test src/app/api/[resource]` and confirm both tests pass.
