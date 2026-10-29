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
        ├── groups
        │     └── group_members (junction: group ↔ patient)
        ├── campaigns (reminders / newsletters / recalls)
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
| `description` | `text` | |
| `opendental_updated_at` | `timestamptz` | |
| `synced_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |
| UNIQUE | (`practice_id`, `opendental_appt_id`) | |

### `practice_opendental_credentials`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `practice_id` | `uuid` FK → practices UNIQUE | |
| `developer_key_enc` | `text` | AES-256-GCM encrypted |
| `customer_key_enc` | `text` | AES-256-GCM encrypted |
| `last_patient_synced_at` | `timestamptz` | |
| `last_appt_synced_at` | `timestamptz` | |
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

## Future tables (tracked in roadmap)

`groups`, `group_members`, `campaigns`, `campaign_recipients`, `surveys`, `survey_responses`, `conversations`, `messages`
