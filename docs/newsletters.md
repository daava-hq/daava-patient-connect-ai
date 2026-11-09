# Newsletters

## Architecture

Newsletters use the shared `campaigns`, `campaign_recipients`,
`campaign_delivery_events`, and `campaign_job_runs` tables and the shared
campaign dispatcher. The practice-scoped `/workspace/newsletters` workspace
selects published email templates from the centralized `newsletters` category
using a searchable template-picker modal. New campaigns must start from a
selected library template; the newsletter workspace does not create reusable
templates.
Group announcements are separate `group_announcement` campaigns created from
the Groups workspace. They share the dispatcher and delivery-event processing,
but do not appear in newsletter history or newsletter dashboard statistics.
The six seeded starter templates are Monthly Dental Newsletter, Oral Hygiene
Tips, Dental Health Awareness, Practice Announcements, Seasonal Dental Tips,
and New Services Announcement. Templates are created and maintained in the
Templates library. Campaign edits are saved to a practice-scoped content
snapshot and never modify the reusable source template.

The create/edit modal selects a centralized template and previews it on desktop
or mobile; newsletter subjects, preheaders, and content blocks are managed in
the Templates library rather than edited in the newsletter modal. The server
validates supported variables, escapes text and attributes, permits HTTPS
images and safe links, and generates both responsive email HTML and a
plain-text alternative. New drafts snapshot the selected template's subject,
content, and HTML alongside the audience filter and practice ID in a
campaign-compatible `message_templates` record and a `campaigns` record.
Editing a draft without selecting a replacement template preserves its content
snapshot; selecting another template replaces only that campaign's snapshot.
Changes to a reusable template do not rewrite existing drafts.

Audience filters support all active patients, selected static or dynamic
groups, and synchronized birthday-month / appointment-date filters. Selected
groups are combined as a union; other filters further narrow the audience.
Every newsletter preview and schedule requires active `Patient` status,
email consent, and a syntactically valid email address. Consent, patient
status, and destination are checked again immediately before sending.

## Scheduling and delivery

Owners and admins can queue a draft for immediate dispatch or schedule a
future send. The protected `POST /api/cron/campaigns` endpoint processes due
campaigns; configure an external scheduler to call it with the
`APPOINTMENT_REMINDERS_CRON_SECRET` bearer token. Campaign and recipient
records provide the durable work and retry state.

AWS SES provider acceptance is reported as **sent / accepted**, not delivered.
Delivery, bounce, complaint, open, click, and unsubscribe events are only
reported after SES publishes signed notifications to
`POST /api/webhooks/ses`. Configure an SES configuration-set event destination
to an SNS topic and set `NEWSLETTER_SES_SNS_TOPIC_ARN` to that exact topic ARN.
The endpoint verifies SNS signatures and topic ownership, deduplicates SNS
message IDs, and scopes updates through the matching campaign recipient.
Permanent bounces, complaints, and unsubscribe events turn off the patient's
email consent for that practice. Opens and clicks remain zero/unavailable until
SES event tracking is configured.

For SES-managed unsubscribe preferences, configure
`AWS_SES_CONTACT_LIST_NAME` and optionally
`AWS_SES_NEWSLETTER_TOPIC_NAME` for the SES contact list topic. The contact
list, topic, SES event destination, and SNS subscription must be configured in
AWS; this application does not create AWS resources or synchronize contact
lists. SES acceptance followed by a lost response remains an ambiguous outcome
because SES does not provide a send idempotency key.

## Media and deployment prerequisites

Images currently use HTTPS-hosted image URLs; HTML uploads are not accepted.
Binary image upload is not enabled because the project has no configured
media-storage service. Before enabling uploads, select managed storage and
define file-size, MIME sniffing, malware scanning, and retention policies.

Before using a non-test practice:

1. Review and apply the generated database migration with `pnpm db:migrate`.
2. Configure AWS SES credentials, region, and a verified `AWS_SES_FROM_EMAIL`.
3. Configure the campaign cron scheduler and its bearer secret.
4. Configure SES SNS events and unsubscribe contact-list preferences as needed.
5. Test using an authorized test practice and verify provider events before
   describing any message as delivered.

See [development workflow](./development-workflow.md) for local environment
configuration and [security](./security.md) for consent and tenant controls.
