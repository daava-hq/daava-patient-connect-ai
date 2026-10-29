---
applyTo: "src/app/api/**"
---

# API Routes — Copilot instructions

## Every route handler must

1. Call `getServerSession` (or equivalent) — return `401` if no session.
2. Verify practice membership with `requirePracticeMembership(userId, practiceId)` — return `403` if unauthorized.
3. Validate input with a Zod schema — return `400` with a descriptive error for invalid input.
4. Use `practice_id` from the verified session or membership lookup — **never** from `req.body` or query params directly.
5. Return typed JSON responses; never leak stack traces to the client.

## Route file structure

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { z } from 'zod';

const bodySchema = z.object({ /* ... */ });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const practiceId = /* from verified session */;
  await requirePracticeMembership(session.user.id, practiceId);

  const body = bodySchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  // ... handler logic
}
```

## HTTP conventions

| Method | Use |
|--------|-----|
| `GET` | Read; no side effects |
| `POST` | Create |
| `PATCH` | Partial update |
| `DELETE` | Delete (soft preferred) |

- Return `201` for created resources with the created entity.
- Return `200` for successful reads and updates.
- Return `204` for successful deletes with no body.
- Return `404` with `{ error: 'Not found' }` for missing resources the user has access to.

## Prohibited

- No business logic that belongs in a service or repository layer.
- No raw SQL strings — use Drizzle ORM.
- No client secrets returned to the browser.
