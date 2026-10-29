---
applyTo: "**/*.test.ts,**/*.test.tsx,e2e/**"
---

# Testing — Copilot instructions

## Framework choices

| Scope | Tool |
|-------|------|
| Unit & integration | Vitest + React Testing Library |
| E2E | Playwright |

## Unit / integration tests (`*.test.ts`, `*.test.tsx`)

- Place test files next to the file under test, or in a `__tests__/` sibling folder.
- Describe the unit's public contract, not its implementation.
- Use `describe` blocks to group related cases; use `it` for individual assertions.
- Mock at the service/repository boundary — not inside the function under test.
- Use `vi.mock()` / `vi.fn()` for external services (Open Dental, email, SMS).
- Use `vi.spyOn()` for observing calls without replacing the implementation.
- Always call `vi.clearAllMocks()` in `afterEach`.
- Test both the happy path and error paths (auth failure, validation failure, DB error).

### Example structure

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('syncPatients', () => {
  afterEach(() => vi.clearAllMocks());

  it('upserts patients returned by Open Dental', async () => { /* ... */ });
  it('skips records that fail validation', async () => { /* ... */ });
  it('throws on network error after max retries', async () => { /* ... */ });
});
```

## Component tests

- Use `@testing-library/react` — query by role, label or text; avoid querying by class or test-id unless unavoidable.
- Test user interactions (click, type) not implementation details.
- Wrap async updates in `waitFor` or `findBy*` queries.

## E2E tests (`e2e/**/*.spec.ts`)

- Each spec covers one user flow (login, patient search, send reminder, etc.).
- Use `page.getByRole` and `page.getByLabel` selectors.
- Use `test.use({ storageState })` for pre-authenticated tests.
- Isolate test data — seed and clean up per test or test file.
- Never make real external API calls; configure a test/mock server.

## Tenant isolation tests

Every API route and server action that handles practice data must have a test verifying that a user from a **different** practice cannot access the resource (expect 403).

## Prohibited

- No `console.log` left in committed test files.
- No real Open Dental, Twilio, or SendGrid calls in tests.
- Do not skip failing tests without a comment explaining why and linking to a tracking issue.
