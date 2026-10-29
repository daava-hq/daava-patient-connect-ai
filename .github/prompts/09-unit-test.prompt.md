---
mode: ask
description: Write Vitest unit tests for a service, repository, or component.
---

# Write unit tests

**Before you begin**: Read `docs/development-workflow.md` and `.github/instructions/testing.instructions.md`.

## Input

File under test: **[FILE_PATH]** (e.g., `src/lib/opendental/patients.ts`)
Test file path: **[TEST_PATH]** (e.g., `src/lib/opendental/patients.test.ts`)

## Steps

1. Create `[TEST_PATH]`.

2. Import the unit under test and its dependencies.

3. Mock all external dependencies at the module boundary using `vi.mock()`.

4. Structure tests with `describe` (unit name) → `it` (scenario):
   ```ts
   describe('fetchPatients', () => {
     it('returns mapped patients from API response', async () => { /* ... */ });
     it('throws SyncError after 3 failed retries', async () => { /* ... */ });
   });
   ```

5. For each public function or exported member, cover:
   - Happy path with realistic fixture data.
   - Validation / edge cases (empty input, boundary values).
   - Error path (expected thrown errors or returned error states).

6. For repository functions: use an in-memory or transaction-wrapped test database, or mock `db`.

7. For components: use `@testing-library/react` — query by role or label, not by class or ID.

8. Call `vi.clearAllMocks()` in `afterEach`.

9. Run `pnpm test [TEST_PATH]` — all tests must pass.

## Constraints

- No real database writes in unit tests (use mocks or transaction rollbacks).
- No real HTTP calls — mock with `vi.fn()` or `msw`.
- Do not test implementation details; test observable behaviour.

## Verification

Report: number of tests, pass/fail counts, and coverage for the file under test (optional `--coverage` flag).
