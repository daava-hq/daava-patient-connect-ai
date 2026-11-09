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
saved without scheduling.

Before scheduling or sending, preview the group audience. The preview and
dispatch enforce active-patient status, email consent, a valid email address,
and current group membership. Scheduling and send-now actions require practice
admin or owner authorization and queue durable campaign work; delivery status
is updated from provider events rather than inferred from provider acceptance.
Scheduled announcements can be cancelled. Drafts can be deleted.

The group engagement history lists announcement status, scheduled time, and
recipient counts. Each campaign report includes sent/accepted, delivered,
bounced, failed, skipped, open, and click counts where the provider supports
them, plus recipient activity. Group announcement details and actions are
scoped to the practice and group that own the campaign.

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
