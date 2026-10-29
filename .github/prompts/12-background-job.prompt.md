---
mode: ask
description: Create a durable background job.
---

# Create a background job

**Before you begin**: Read `docs/opendental-integration.md` and `.github/instructions/integration.instructions.md`.

## Input

Job name: **[JOB_NAME]** (e.g., `send-appointment-reminders`)
Trigger: **[TRIGGER]** (e.g., `cron: '0 * * * *'` or `event: 'appointment.created'`)
Scope: **[SCOPE]** (e.g., `per-practice` | `global`)

## Steps

1. Create `src/jobs/[job-name].ts`.

2. Export the job definition:
   ```ts
   export const jobName = '[JOB_NAME]';
   export const schedule = '[TRIGGER]';

   export async function run(practiceId: string): Promise<JobResult> {
     // ...
   }
   ```

3. Load all required data from the database (authenticated, practice-scoped).

4. Implement a checkpoint mechanism:
   - Before processing: load `lastProcessedAt` from the database.
   - After each batch: persist the updated checkpoint inside the same transaction as the data write.

5. Implement idempotency: processing the same batch twice must produce the same result.

6. Log job start, progress (batch size) and completion — never log PII.

7. Wrap individual item failures with try/catch: log, skip, continue (do not abort the batch).

8. Write unit tests:
   - Happy path.
   - Idempotency (second run produces no duplicates).
   - Single-item failure does not abort the batch.
   - Checkpoint is saved after each batch.

9. Register the job in the job scheduler (document the scheduler choice here once decided).

## Verification

Run `pnpm test src/jobs/[job-name]` and confirm all tests pass.
