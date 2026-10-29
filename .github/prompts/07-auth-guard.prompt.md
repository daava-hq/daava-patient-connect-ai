---
mode: ask
description: Add an authentication guard and practice isolation check to a route or action.
---

# Add auth guard and practice isolation

**Before you begin**: Read `docs/security.md` and `.github/instructions/security.instructions.md`.

## Input

File to protect: **[FILE_PATH]** (e.g., `src/app/api/patients/route.ts`)
Required role (if any): **[ROLE]** (`owner` | `admin` | `member` | none)

## Steps

1. Import `getServerSession` from `next-auth` and `authOptions` from `@/lib/auth/options`.
2. Import `requirePracticeMembership` from `@/lib/auth/guards`.
3. At the top of each handler function:
   ```ts
   const session = await getServerSession(authOptions);
   if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

   const membership = await requirePracticeMembership(session.user.id, practiceId);
   // throws PracticeAccessError → caught and returned as 403
   ```
4. If a role check is needed: verify `membership.role` and return `403` if insufficient.
5. Derive `practiceId` from the user's session or verified path/query param — **never** from `req.body`.
6. Wrap the handler body in a try/catch; catch `PracticeAccessError` → `403`; other errors → `500` (no stack trace in response).

7. Write two tests:
   - Authenticated member can access.
   - User from a different practice receives `403`.

## Verification

Run the targeted test file and confirm both tests pass.
