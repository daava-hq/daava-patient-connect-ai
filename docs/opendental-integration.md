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
| `sync-patients` | Full + incremental patient pull | Implemented |
| `sync-appointments` | Full + incremental appointment pull | Implemented |

## Sync design principles

1. **Read-only by default** — synchronization uses GET endpoints; the appointment confirmation flow is the only implemented write path.
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
New patient rows created through Open Dental sync default `sms_consent` to
`true` when a mobile number is present and `email_consent` to `true` when an
email address is present. A missing contact channel defaults to `false`.
Subsequent syncs preserve both consent flags so later opt-outs are not
overwritten. These flags are Patient Connect values, not consent data supplied
by Open Dental.
The appointment calendar reads these saved consent flags from the local
practice-scoped patient records; it does not treat Open Dental as the source
of consent. Calendar icons are shown only when the matching email/mobile
contact detail and a saved consent value are available.

## Appointment sync

Endpoint: `GET /api/v1/appointments`

Key fields to store locally:

| Open Dental field | Local column |
|-------------------|-------------|
| `AptNum` | `opendental_appt_id` |
| `PatNum` | `opendental_patient_id` |
| `AptDateTime` | `scheduled_at` |
| `AptStatus` | `status` |
| `confirmed` | `confirmation_status` |
| `ProcDescript` | `description` |
| `DateTStamp` | `opendental_updated_at` |

`AptStatus` and the confirmation value are distinct Open Dental fields. A patient
confirmation must never replace the appointment's `AptStatus` (for example,
`Scheduled`), because reminder eligibility depends on that appointment status.

The Patients Directory always reads from the authenticated user's
practice-scoped local patient records. Open Dental patient data appears there
after it has been synchronized into the database; configuring credentials alone
does not make the directory fetch live API results. Patient synchronization is
available through the practice sync workflow.

The Appointment Calendar uses the Open Dental API when practice credentials
are configured. When credentials are absent, it reads practice-scoped local
appointments instead. The dedicated `appointment-reminder-sample` practice
always uses local records, even if credentials exist, so its synthetic
appointments are displayed instead of unrelated Open Dental data. The calendar
resolves the user's first assigned practice if the selected practice has not
loaded yet. This does not provision or imply an Open Dental integration for the
sample practice.

## Appointment reminders

Appointment reminders read only from the locally synchronized `appointments`
and `patients` tables. The email confirmation button is an explicit write path:
the signed link opens a confirmation page, and only the patient's explicit
button action calls `PUT /api/v1/appointments/{AptNum}/Confirm` with
`{"confirmVal":"Confirmed"}`. Open Dental credentials are decrypted server-side
from the practice-specific credential record. Successful writes set the local
`confirmation_status` to `Confirmed`; the appointment `status` remains unchanged.
Before writing, the server re-reads the Open Dental appointment and checks its
status, patient, and practice-local appointment time against the synchronized
record. The appointment sync maps Open Dental's `confirmed` value back into
`confirmation_status`.
Schedules use the practice IANA timezone. Seven-day and three-day reminders are
scheduled on the corresponding local calendar date at the schedule's configured
send time. Twenty-four-hour reminders use elapsed time before the appointment;
same-day reminders use the configured local send time.

The worker targets appointments whose local status is `Scheduled` and whose
patient status is `Patient`, then rechecks both immediately before dispatch.
`Scheduled` is not treated as patient-confirmed attendance. Appointment
provider/operatory data is not currently stored in the synchronized schema;
templates that require unavailable variables are rejected before dispatch.
SMS/email delivery remains disabled until real providers are configured.

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

The confirmation endpoint requires Open Dental permissions that allow
appointment confirmation. A missing credential, insufficient permission, or
failed Open Dental request is surfaced to the patient as a retry/contact-practice
message; local confirmation is not recorded on a failed remote write.
