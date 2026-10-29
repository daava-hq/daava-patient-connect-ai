# Patient Connect — Open Dental Integration

## Official documentation

- API setup: https://www.opendental.com/site/apisetup.html
- Patients: https://www.opendental.com/site/apipatients.html
- Appointments: https://www.opendental.com/site/apiappointments.html
- Full specification: https://www.opendental.com/site/apispecification.html
- Implementation guide: https://www.opendental.com/site/apiimplementation.html

## Base URL

```
https://api.opendental.com/api/v1
```

## Authentication

```
Authorization: ODFHIR {DeveloperKey}/{CustomerKey}
```

- `DeveloperKey` — platform-level key issued to Patient Connect by Open Dental.
- `CustomerKey` — per-practice customer key issued to each dental practice.
- **Never** hardcode either key. Store encrypted in the database per practice.
- **Never** expose keys to client-side code.

## Credential storage

Each practice record has an encrypted `opendental_credentials` column (or a separate `practice_opendental_credentials` table). Decrypt only in server-side code at sync time.

## Implemented sync jobs

| Job | Description | Status |
|-----|-------------|--------|
| `sync-patients` | Full + incremental patient pull | Planned — Milestone 2 |
| `sync-appointments` | Full + incremental appointment pull | Planned — Milestone 2 |

## Sync design principles

1. **Read-only first** — only GET endpoints in MVP; no writes to Open Dental.
2. **Idempotent upserts** — use `opendental_patient_id` and `opendental_appt_id` as natural keys.
3. **Incremental sync** — store `last_synced_at` per practice; request only records updated since last sync.
4. **Pagination** — honour `Limit`/`Offset` or cursor-based pagination per endpoint spec.
5. **Bounded retries** — max 3 retries with exponential back-off on 5xx / rate-limit errors.
6. **Throttling** — respect `Retry-After` headers; default 1 req/sec per practice if no header.
7. **Durable checkpoints** — persist sync progress so a restart resumes rather than restarts.
8. **Error isolation** — a single record failure must not abort the entire batch.

## Patient sync

Endpoint: `GET /api/v1/patients`

Key fields to store locally:

| Open Dental field | Local column |
|-------------------|-------------|
| `PatNum` | `opendental_patient_id` |
| `LName`, `FName` | `last_name`, `first_name` |
| `Birthdate` | `date_of_birth` |
| `HmPhone`, `WirelessPhone` | `phone_home`, `phone_mobile` |
| `Email` | `email` |
| `PatStatus` | `status` |
| `DateTStamp` | `opendental_updated_at` |

Store only the fields needed for engagement features. Do not mirror entire records.

## Appointment sync

Endpoint: `GET /api/v1/appointments`

Key fields to store locally:

| Open Dental field | Local column |
|-------------------|-------------|
| `AptNum` | `opendental_appt_id` |
| `PatNum` | `opendental_patient_id` |
| `AptDateTime` | `scheduled_at` |
| `AptStatus` | `status` |
| `ProcDescript` | `description` |
| `DateTStamp` | `opendental_updated_at` |

## Operatories & Providers (Calendar Columns)

Endpoints:
- `GET /api/v1/providers` (https://www.opendental.com/site/apiproviders.html)
- `GET /api/v1/operatories` (https://www.opendental.com/site/apioperatories.html)

### Calendar Column Construction

Active providers (`!IsHidden && ProvStatus === "Active"`) and visible operatories (`!IsHidden`) are combined to create the horizontal columns of the daily schedule:
1. Operatories are sorted by `ItemOrder`.
2. Role is determined via `operatory.IsHygiene ? "Hygienist" : "Doctor"`.
3. Provider FK resolution: `role === "Hygienist" ? operatory.ProvHygienist : operatory.ProvDentist`.
4. Header formatting:
   - For Doctor chairs with an assigned provider: Short name on top (e.g. `B. Albert`, `S. Lexington`), display name below (e.g. `Dr. Brian Albert`, `Dr. Sarah Lexington`).
   - For Hygiene chairs or unassigned chairs (e.g. `Doctor Overflow`, `Tina`, `Bruce`): Operatory name displayed cleanly without redundant subtitle.
5. Grid structure:
   - 6 AM to 8 PM with 10-minute intervals (`:10`, `:20`, `:30`, `:40`, `:50`).
   - Appointments mapped by `Op === OperatoryNum` with duration calculated from `Pattern` (`Pattern.length * 5` min).
   - Card layout displays "Booked" status, patient name (`NP-` prefixed for new patients), duration, intake link badge, and procedure description.

## Error handling

- Log errors with practice_id, job name, error code and message.
- Redact patient PII from logs.
- Alert on consecutive sync failures (threshold TBD in Milestone 2).
- Surface sync status and last_synced_at in the practice settings UI.

## Future write operations (post-MVP)

- Confirm appointment: `PUT /api/v1/appointments/{AptNum}`
- Record communication opt-out (if supported by API).

Always verify against official docs before implementing write endpoints.
