# Patient Groups

## Group announcements

Announcements created from a group are independent `group_announcement`
campaigns. They use the shared campaign dispatcher and delivery-event tables,
but are not newsletters and do not appear in newsletter history or newsletter
dashboard totals.

The Groups workspace only offers published email templates in the centralized
Groups category. Creating an announcement snapshots the selected template into
a campaign-owned message template, so editing its content never changes the
reusable template. Drafts can be edited, previewed on desktop or mobile, and
saved without scheduling. Select a reusable template from the picker dialog;
system templates can be cloned for customization in the Templates library.

Before scheduling or sending, preview the group audience. The preview and
dispatch enforce active-patient status, email consent, a valid email address,
and current group membership. Scheduling and send-now actions require practice
admin or owner authorization and queue durable campaign work; delivery status
is updated from provider events rather than inferred from provider acceptance.
Scheduled announcements can be cancelled. Drafts can be deleted.

The group engagement history lists announcement status, scheduled time, and
recipient counts. Each campaign report includes sent/accepted, delivered,
bounced, failed, skipped, open, and click counts where the provider supports
them in shared `StatCard` components, plus recipient activity. Group
announcement details and actions are scoped to the practice and group that own
the campaign. The report dialog and metric-card sizing match the newsletter
report layout.

## Reusable campaign audiences

Birthday campaigns do not use patient groups; they target all eligible patients,
with optional age rules. Appointment reminder schedules are practice-wide and
always include all otherwise-eligible appointments; they do not load or accept
patient groups. Group selection in other campaign workflows does not bypass
active-patient, appointment, consent, destination, or practice-channel
safeguards.

`GET /api/groups/options?practiceId=...` returns minimal active group options
after verifying practice membership, for workflows that support group
audiences. Birthday campaign payloads reject legacy `groupIds`; any values
already persisted are ignored for audience selection and removed when the
campaign is next saved.
`GET /api/groups/recall-options?practiceId=...` returns only active dynamic
groups that include the approved due-recall criterion, after practice
membership is verified.

Dynamic group criteria can include due Open Dental recalls. A match requires
an active recall of any recall type with `DateDue` on or before the practice's
current date. Patients with a current/future recall appointment date or a
future scheduled appointment in the synchronized appointment data are
excluded. Recall campaigns require one or more active dynamic groups with this
criterion; static groups and groups without it are rejected. This rule
depends on the owner-triggered recall sync and the appointment sync; it does
not calculate a new interval or modify Open Dental.
Recall campaign drafts select a published SMS or email template from the
Recall category and snapshot its content. Audience previews show names only;
schedule/send-now and cancellation require a practice owner or admin. Dispatch
rechecks the current dynamic-group eligibility and channel consent. When more
than one due recall exists, the earliest due date is used for `{{recall.dueDate}}`.

Routes:

- `POST /api/groups/{groupId}/announcements` creates a draft from a published
  Groups template.
- `GET`, `PATCH`, and `DELETE
  /api/groups/{groupId}/announcements/{campaignId}` load reports, edit drafts,
  and delete drafts.
- `POST /api/groups/{groupId}/announcements/{campaignId}/schedule` queues a
  future send or immediate dispatch.
- `POST /api/groups/{groupId}/announcements/{campaignId}/cancel` cancels a
  scheduled announcement.
- `GET /api/groups/{groupId}/campaigns` returns paginated engagement history.

See [Newsletter architecture](./newsletters.md) for shared campaign delivery,
provider-event configuration, consent enforcement, and deployment settings.
