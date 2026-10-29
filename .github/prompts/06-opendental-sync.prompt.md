---
mode: ask
description: Implement or extend an Open Dental sync background job.
---

# Implement an Open Dental sync job

**Before you begin**: Read `docs/opendental-integration.md` and `.github/instructions/integration.instructions.md`.

## Input

Sync target: **[TARGET]** (e.g., `patients`, `appointments`)
Job file: **[PATH]** (e.g., `src/jobs/sync-patients.ts`)

## Steps

1. Create or update `[PATH]`.

2. Implement the `run(practiceId: string): Promise<SyncResult>` export.

3. Load credentials from `practice_opendental_credentials` via the repository — decrypt in place, never cache.

4. Load the sync checkpoint (last `since` timestamp + `offset`) from the database.

5. Paginate through the Open Dental endpoint:
   - Request with `since = lastSyncedAt` and `offset`.
   - Upsert each page inside a transaction that also saves the checkpoint.
   - Break when the page is empty.

6. On individual record failure: log warning with `practice_id` + record ID (no PII), skip, continue.

7. After a full pass: update `last_patient_synced_at` / `last_appt_synced_at`.

8. Implement retry (max 3, exponential back-off) in the Open Dental client, not in the job.

9. Write unit tests with a mocked Open Dental client covering:
   - Happy path (two pages, then empty).
   - Retry on 429 / 5xx.
   - Single record failure does not abort the batch.
   - Checkpoint is persisted after each page.

## Verification

Run `pnpm test src/jobs/[job-file]` and confirm all cases pass.
