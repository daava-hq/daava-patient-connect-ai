# Patient Connect — Database Schema

## Principles

- Every practice-owned table has a `practice_id` foreign key.
- Use `snake_case` for all table and column names.
- Use Drizzle ORM `pgTable` definitions — one file per domain in `src/db/schema/`.
- Never alter the database directly; always use Drizzle Kit migrations.
- Soft-delete (`deleted_at`) preferred over hard-delete for most records.

## Entity overview

```
organisations
  └── practices (belongs to organisation)
        ├── users ↔ practice_members (junction)
        ├── patients (synced from Open Dental)
        │     └── appointments
        │     └── opendental_recalls
        ├── groups
        │     └── group_members (junction: group ↔ patient)
        ├── campaigns (reminders / newsletters / group announcements / recalls)
        ├── surveys
        ├── conversations (Connect two-way texting)
        └── practice_opendental_credentials
```

## Core tables

### `organisations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `practices`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `organisation_id` | `uuid` FK → organisations | |
| `name` | `text` | |
| `phone` | `text` | |
| `address` | `text` | |
| `logo_url` | `text` | |
| `timezone` | `text` | IANA tz |
| `email_enabled` | `boolean` | default false; practice-wide outbound email gate |
| `sms_enabled` | `boolean` | default false; practice-wide outbound SMS gate |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `email` | `text` UNIQUE | |
| `hashed_password` | `text` | bcrypt |
| `name` | `text` | |
| `role` | `text` | `owner`, `admin`, `member` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `practice_members`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `practice_id` | `uuid` FK → practices | |
| `user_id` | `uuid` FK → users | |
| `role` | `text` | `owner`, `admin`, `member` |
| `created_at` | `timestamptz` | |
| UNIQUE | (`practice_id`, `user_id`) | |

### `patients`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `practice_id` | `uuid` FK → practices | |
| `opendental_patient_id` | `bigint` | Natural key from OD |
| `first_name` | `text` | |
| `last_name` | `text` | |
| `date_of_birth` | `date` | |
| `phone_home` | `text` | |
| `phone_mobile` | `text` | |
| `email` | `text` | |
| `status` | `text` | `Patient`, `Inactive`, `Archived` |
| `sms_consent` | `boolean` | default false |
| `email_consent` | `boolean` | default false |
| `opendental_updated_at` | `timestamptz` | |
| `synced_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| UNIQUE | (`practice_id`, `opendental_patient_id`) | |

### `appointments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `practice_id` | `uuid` FK → practices | |
| `patient_id` | `uuid` FK → patients | |
| `opendental_appt_id` | `bigint` | Natural key from OD |
| `scheduled_at` | `timestamptz` | |
| `status` | `text` | `Scheduled`, `Complete`, `Broken`, `UnschedList` |
| `confirmation_status` | `text` | Open Dental confirmation value; does not replace appointment status |
| `description` | `text` | |
| `opendental_updated_at` | `timestamptz` | |
| `synced_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |
| UNIQUE | (`practice_id`, `opendental_appt_id`) | |

### `opendental_recalls`

Read-only snapshot of Open Dental recall records used for due-recall group
criteria. It is refreshed by practice owners from Practice Settings.

| Column | Type | Notes |
|--------|------|-------|
| `practice_id` | `uuid` FK → practices | |
| `patient_id` | `uuid` FK → patients | |
| `opendental_recall_id` | `bigint` | Open Dental recall natural key |
| `recall_type_num` | `integer` | Open Dental recall type |
| `due_date` | `date` | Null when Open Dental returns its unset-date sentinel |
| `date_scheduled` | `date` | Null when no recall appointment date is set |
| `is_disabled` | `boolean` | |
| `synced_at` | `timestamptz` | |
| UNIQUE | (`practice_id`, `opendental_recall_id`) | |

### Patient groups

`groups` is practice-scoped and stores a `group_type` (`static` or `dynamic`),
`criteria` JSONB for dynamic rules, and `archived_at`. Static groups use
`group_members` relationships to existing patient rows; they never duplicate
patient data. Membership writes validate both the group and patients against
the same practice and are idempotent on `(group_id, patient_id)`.

Dynamic groups do not persist a member snapshot. Their membership is evaluated
on demand in SQL against synchronized fields only:

- Patient status (defaults to active `Patient` when omitted).
- Age range derived from date of birth.
- Birth month.
- Appointment status and last appointment date.
- Non-disabled Open Dental recalls due by the practice-local date; patients
  with a current/future recall appointment date or a future scheduled
  appointment are excluded.
- Email/mobile contact availability.

Criteria are allow-listed and strictly validated; clinical data is not exposed
or used. Last-appointment date rules consider the most recent appointment not
in the future. Contact availability does not imply communication consent;
campaign dispatch must continue to apply the relevant consent checks.
User-entered date-only rule boundaries are interpreted in UTC. Recall due dates
are compared to the practice-local current date.

`group_membership_history` records static membership additions/removals with
practice, group, patient (nullable after patient deletion), actor, and time.
Dynamic membership is computed rather than changed, so it has no membership
change log. Archiving preserves the group, relationships, and history while
excluding it from new audience resolution. Duplicate static groups copy their
current member relationships; duplicate dynamic groups copy their criteria.

Group announcements use independent `campaigns.type = group_announcement` rows
with practice-scoped campaign content snapshots. Migration
`0008_group_announcement_history` reclassifies legacy announcement drafts
created by the newsletter-backed flow when their snapshot name and one-group
audience match the original creation pattern.

### `practice_opendental_credentials`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `practice_id` | `uuid` FK → practices UNIQUE | |
| `developer_key_enc` | `text` | AES-256-GCM encrypted |
| `customer_key_enc` | `text` | AES-256-GCM encrypted |
| `last_patient_synced_at` | `timestamptz` | |
| `last_appt_synced_at` | `timestamptz` | |
| `last_recall_synced_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

## Migration rules

1. Generate with `pnpm db:generate` — never hand-write SQL.
2. Review generated SQL before applying.
3. Apply with `pnpm db:migrate` in CI and on each environment.
4. Commit schema + migration file together in the same commit.
5. Destructive changes (DROP COLUMN, DROP TABLE) require explicit approval.

## Indexes (to be added as queries are profiled)

- `patients(practice_id, last_name)` — patient search.
- `appointments(practice_id, scheduled_at)` — appointment list/calendar.
- `practice_members(user_id)` — practice lookup by user.

## Centralized Templates tables

### `template_categories`
- `id` (uuid PK)
- `slug` (text UNIQUE)
- `name` (text)
- `description` (text)
- `sort_order` (integer)

### `templates`
- `id` (uuid PK)
- `practice_id` (uuid FK → practices, nullable for system templates)
- `category_id` (uuid FK → template_categories)
- `name` (text)
- `description` (text)
- `template_type` (text: sms, email, newsletter, survey, internal_response)
- `channel` (text: sms, email, in_app)
- `content` (jsonb)
- `variables` (jsonb)
- `status` (text)
- `is_system` (boolean)
- `version` (integer)
- `created_by` (uuid FK → users)

### `template_versions`, `template_favorites`, `template_usage_history`
Support version history, user favorites, and audit usage tracking per practice.

## Campaign and newsletter engagement

### `campaigns`

Practice-owned campaign records store the type, channel, state, optional
schedule, reusable audience filter JSONB, and a campaign-compatible
`message_templates` reference. Newsletters additionally require
`message_templates.content` (structured JSONB), `subject`, plain-text `body`,
and generated/sanitized `html_body`. Each newsletter draft stores its own
snapshot; editing a reusable centralized template does not mutate prior
campaign content.

Recall campaigns also store a nullable `source_template_id` reference to the
selected published Recall-library template. The selected content is copied to
the campaign-owned `message_templates` row so later library edits do not change
an existing draft. Recall audience filters persist the enforced active-patient
status, channel-specific consent, and destination-channel requirement.

### `campaign_recipients` and `campaign_delivery_events`

Recipients are unique per `(campaign_id, patient_id)` and store dispatch,
delivery, bounce, failure, skip, and retry state. Delivery events are append
only; provider event IDs are unique when available to make signed SES/SNS
retries idempotent. `sent` means accepted by the provider, while `delivered`
is recorded only from a provider event. Provider events are not stored with
raw patient email or message content.

Newsletter audience records remain references to existing patients. Audience
filters are evaluated within the campaign practice and email consent, active
patient status, and a valid email address are checked during preview and again
at dispatch time.

## Appointment reminders

### `appointment_reminder_schedules`

Practice-owned reminder rules reference an SMS or email template in the
`appointment-reminders` category. Schedules store the interval, practice-local
send time, enabled state, creator, and selected `group_ids` as JSONB. An empty
group list targets all otherwise-eligible patients; multiple groups are
combined as a union and membership is evaluated from current static or dynamic
group membership.

### `appointment_reminders`

Practice-owned reminder occurrences reference a locally synchronized
appointment, patient, and schedule. Each occurrence records its scheduled time,
manual/automated origin, status (`pending`, `processing`, `sent`, `delivered`,
`failed`, or `skipped`), attempt timestamps, provider message ID, and a
PII-minimized failure reason.

The unique key on `(appointment_id, schedule_id, channel, patient_id)` prevents
duplicate occurrences. The due index supports the cron worker. Provider
delivery confirmation is not implemented yet, so `delivered_at` remains unset
until a provider webhook or polling integration is added. Deleting a schedule
cascades to its reminder occurrences and history; the reminders UI confirms
this before deletion.

## Birthday engagement

### `birthday_campaigns`

Practice-owned campaign settings reference a published shared birthday
template. They store the channel, days before the birthday, practice-local
delivery time, optional age eligibility rules and offer text. `eligibility_rules`
may also contain `groupIds`; multiple groups are combined as a union, and an
empty list leaves the campaign unrestricted by groups. Membership is evaluated
from current static or dynamic group data during materialization and again
before dispatch. New campaigns default to `enabled = false`; an owner or admin
must explicitly enable sending. The practice timezone is read from
`practices.timezone`.

### `birthday_message_occurrences`

The durable worker creates one occurrence per campaign, patient, and birthday
year. The unique constraint on `(campaign_id, patient_id, birthday_year)`
provides idempotent materialization; atomic `pending` to `processing` claims
prevent concurrent cron runs from dispatching the same occurrence. Occurrences
store the scheduled instant, attempt/status fields, provider message ID, and a
generic failure or suppression reason. A missing or invalid patient birthdate
does not create an occurrence. February 29 birthdays are observed on February
28 in non-leap years.

Dashboard queries use practice-local birthday dates and return month/day and
the current celebration date only; the synchronized birth year is not returned
to the browser. History is retained when a campaign is soft-deleted.
