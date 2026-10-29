---
mode: ask
description: Write a Playwright end-to-end test for a user flow.
---

# Write an end-to-end test

**Before you begin**: Read `docs/development-workflow.md` and `.github/instructions/testing.instructions.md`.

## Input

Flow to test: **[FLOW_NAME]** (e.g., "Patient search and view detail")
Spec file: **[SPEC_PATH]** (e.g., `e2e/patients.spec.ts`)

## Steps

1. Create or update `[SPEC_PATH]`.

2. Add a `test.use({ storageState: 'e2e/auth.json' })` preamble to skip login for authenticated flows. Create `e2e/auth.json` using `playwright/global-setup.ts` if not already present.

3. Structure the test:
   ```ts
   import { test, expect } from '@playwright/test';

   test.describe('[FLOW_NAME]', () => {
     test('happy path', async ({ page }) => {
       await page.goto('/workspace/patients');
       await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
       // ... user actions and assertions
     });

     test('empty search shows empty state', async ({ page }) => { /* ... */ });
   });
   ```

4. Use semantic selectors (`getByRole`, `getByLabel`, `getByText`) — avoid `locator('.class')`.

5. Seed test data before the test (or use a fixed fixture practice) and clean up after.

6. Test both success and meaningful failure paths (e.g., form validation errors).

7. Run `pnpm test:e2e --grep "[FLOW_NAME]"` and confirm the test passes.

## Constraints

- No real external API calls — configure a local mock server or use Playwright route interception (`page.route()`).
- Do not hard-code user credentials in the spec file; use environment variables or fixtures.

## Verification

Report: test duration, pass/fail status, and any screenshots on failure.
