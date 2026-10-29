---
applyTo: "src/lib/opendental/**,src/jobs/**"
---

# Integration & background jobs — Copilot instructions

## Open Dental client (`src/lib/opendental/client.ts`)

- Base URL is a constant: `https://api.opendental.com/api/v1` — never accept from config or caller.
- Build the `Authorization: ODFHIR {developerKey}/{customerKey}` header server-side only.
- Decrypt credentials from the database immediately before use; never cache decrypted keys in memory across requests.
- Set a request timeout (default 30 s).
- Log errors with `practice_id` and endpoint — **redact credentials and patient PII**.

## Retry and throttling

- Max 3 retries per request with exponential back-off (`1s → 2s → 4s`).
- Respect `Retry-After` header when present.
- Default rate: 1 request/second per practice when no header is returned.
- Return a typed error after exhausting retries; do not swallow.

## Sync job design

### Sync structure

```ts
async function syncPatients(practiceId: string): Promise<SyncResult> {
  const checkpoint = await loadCheckpoint(practiceId, 'patients');
  let offset = checkpoint.offset ?? 0;

  while (true) {
    const page = await openDentalClient.getPatients({ since: checkpoint.since, offset });
    if (page.length === 0) break;

    await db.transaction(async (tx) => {
      await upsertPatients(tx, practiceId, page);
      await saveCheckpoint(tx, practiceId, 'patients', { offset: offset + page.length, since: checkpoint.since });
    });

    offset += page.length;
  }

  await markSyncComplete(practiceId, 'patients');
}
```

- **Idempotent upserts**: use `ON CONFLICT (practice_id, opendental_patient_id) DO UPDATE`.
- **Durable checkpoints**: persist `offset` + `since` inside the same transaction as the upsert.
- **Error isolation**: a single malformed record logs a warning and is skipped; it must not abort the batch.
- **Incremental sync**: store `last_synced_at`; request `DateTStamp > last_synced_at` on subsequent runs.

## Background job registration

- Define jobs in `src/jobs/`.
- Each job file exports: `jobName`, `schedule` (cron expression or trigger), and `run(practiceId)`.
- Jobs must be idempotent — safe to run multiple times for the same period.
- Log job start, completion and total records processed.

## Prohibited

- No Open Dental credentials in logs, responses or environment variables (except `OPENDENTAL_DEVELOPER_KEY` — the platform key is the exception).
- No sync logic in route handlers — route handlers only trigger or query job status.
- No blocking sync in the request lifecycle for large datasets.
