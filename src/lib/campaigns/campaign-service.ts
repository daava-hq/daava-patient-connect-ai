import 'server-only';
import { db } from '@/db';
import { campaigns, campaigns as campaignsTable, Campaign, NewCampaign, CampaignStatus, AudienceFilter } from '@/db/schema/campaigns';
import { campaignDeliveryEvents, campaignRecipients } from '@/db/schema/campaign_recipients';
import { messageTemplates } from '@/db/schema/message_templates';
import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import { NotFoundError, AppError } from '@/lib/errors';
import { resolveAudience } from './audience-service';
import { parseNewsletterDocument, renderNewsletterDocument } from '@/lib/newsletters/newsletter-content';

/** Valid state transitions for a campaign */
const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['scheduled', 'processing', 'cancelled'],
  scheduled: ['processing', 'cancelled'],
  processing: ['completed', 'partially_failed', 'failed'],
  completed: [],
  partially_failed: [],
  failed: ['scheduled', 'processing'],
  cancelled: [],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function getPracticeCampaigns(
  practiceId: string,
  options: { type?: string; status?: string; limit?: number; offset?: number } = {}
) {
  const conditions = [eq(campaigns.practiceId, practiceId), isNull(campaigns.deletedAt)];
  if (options.type) conditions.push(eq(campaigns.type, options.type));
  if (options.status) conditions.push(eq(campaigns.status, options.status));

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const campaignId = sql.raw('"campaigns"."id"');

  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      type: campaigns.type,
      channel: campaigns.channel,
      status: campaigns.status,
      scheduledAt: campaigns.scheduledAt,
      startedAt: campaigns.startedAt,
      completedAt: campaigns.completedAt,
      totalRecipients: sql<number>`(
        SELECT count(*)::int FROM campaign_recipients cr WHERE cr.campaign_id = ${campaignId}
      )`,
      sentCount: sql<number>`(
        SELECT count(*)::int FROM campaign_delivery_events e
        JOIN campaign_recipients cr ON cr.id = e.recipient_id
        WHERE cr.campaign_id = ${campaignId} AND e.event_type = 'sent'
      )`,
      deliveredCount: sql<number>`(
        SELECT count(*)::int FROM campaign_recipients cr
        WHERE cr.campaign_id = ${campaignId} AND cr.status = 'delivered'
      )`,
      bouncedCount: sql<number>`(
        SELECT count(*)::int FROM campaign_recipients cr
        WHERE cr.campaign_id = ${campaignId} AND cr.status = 'bounced'
      )`,
      failedCount: sql<number>`(
        SELECT count(*)::int FROM campaign_recipients cr
        WHERE cr.campaign_id = ${campaignId} AND cr.status = 'failed'
      )`,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .where(and(...conditions))
    .orderBy(campaigns.createdAt)
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(campaigns)
    .where(and(...conditions));

  return { campaigns: rows, total };
}

export async function getNewsletterDashboardStats(practiceId: string) {
  const campaignStatuses = await db
    .select({ status: campaigns.status, count: sql<number>`count(*)::int` })
    .from(campaigns)
    .where(and(
      eq(campaigns.practiceId, practiceId),
      eq(campaigns.type, 'newsletter'),
      isNull(campaigns.deletedAt),
    ))
    .groupBy(campaigns.status);
  const recipientStatuses = await db
    .select({ status: campaignRecipients.status, count: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaignRecipients.campaignId, campaigns.id))
    .where(and(
      eq(campaigns.practiceId, practiceId),
      eq(campaigns.type, 'newsletter'),
      isNull(campaigns.deletedAt),
    ))
    .groupBy(campaignRecipients.status);
  const eventStatuses = await db
    .select({ eventType: campaignDeliveryEvents.eventType, count: sql<number>`count(*)::int` })
    .from(campaignDeliveryEvents)
    .innerJoin(campaignRecipients, eq(campaignDeliveryEvents.recipientId, campaignRecipients.id))
    .innerJoin(campaigns, eq(campaignRecipients.campaignId, campaigns.id))
    .where(and(
      eq(campaigns.practiceId, practiceId),
      eq(campaigns.type, 'newsletter'),
      isNull(campaigns.deletedAt),
    ))
    .groupBy(campaignDeliveryEvents.eventType);

  return {
    campaigns: Object.fromEntries(campaignStatuses.map(({ status, count }) => [status, count])),
    recipients: Object.fromEntries(recipientStatuses.map(({ status, count }) => [status, count])),
    events: Object.fromEntries(eventStatuses.map(({ eventType, count }) => [eventType, count])),
  };
}

export async function getCampaignById(practiceId: string, campaignId: string): Promise<Campaign | null> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.practiceId, practiceId),
        eq(campaigns.id, campaignId),
        isNull(campaigns.deletedAt)
      )
    )
    .limit(1);
  return campaign ?? null;
}

export async function createCampaign(
  data: Pick<NewCampaign, 'practiceId' | 'name' | 'type' | 'channel' | 'templateId' | 'audienceFilter' | 'scheduledAt'>
): Promise<Campaign> {
  const [campaign] = await db
    .insert(campaigns)
    .values({ ...data, status: 'draft' })
    .returning();
  return campaign;
}

export async function createAnnouncementDraft(data: {
  practiceId: string;
  name: string;
  groupId: string;
  template: { name: string; subject: string; body: string; content?: unknown };
}): Promise<Campaign> {
  const content = data.template.content ? parseNewsletterDocument(data.template.content) : null;
  const rendered = content ? renderNewsletterDocument(content) : null;
  return db.transaction(async (tx) => {
    const [campaignTemplate] = await tx
      .insert(messageTemplates)
      .values({
        practiceId: data.practiceId,
        name: `${data.template.name} - ${data.name}`,
        channel: 'email',
        subject: rendered?.subject ?? data.template.subject,
        body: rendered?.text ?? data.template.body,
        htmlBody: rendered?.html ?? null,
        content,
      })
      .returning({ id: messageTemplates.id });

    const [campaign] = await tx
      .insert(campaigns)
      .values({
        practiceId: data.practiceId,
        name: data.name,
        type: 'group_announcement',
        channel: 'email',
        status: 'draft',
        templateId: campaignTemplate.id,
        audienceFilter: {
          groupIds: [data.groupId],
          patientStatuses: ['Patient'],
          consentEmail: true,
        },
      })
      .returning();

    return campaign;
  });
}

export async function getGroupAnnouncementDetails(
  practiceId: string,
  groupId: string,
  campaignId: string,
) {
  const campaign = await getCampaignById(practiceId, campaignId);
  const filter = campaign?.audienceFilter as AudienceFilter | undefined;
  if (
    !campaign ||
    campaign.type !== 'group_announcement' ||
    !filter?.groupIds?.includes(groupId)
  ) return null;

  const [template] = campaign.templateId
    ? await db.select({
        subject: messageTemplates.subject,
        content: messageTemplates.content,
        body: messageTemplates.body,
      }).from(messageTemplates).where(and(
        eq(messageTemplates.practiceId, practiceId),
        eq(messageTemplates.id, campaign.templateId),
        isNull(messageTemplates.deletedAt),
      )).limit(1)
    : [];
  const content = template?.content ?? {
    subject: template?.subject ?? campaign.name,
    sections: [{
      blocks: [{ type: 'paragraph', properties: { text: template?.body ?? '' } }],
    }],
  };
  return { campaign, content };
}

export async function updateGroupAnnouncementDraft(data: {
  practiceId: string;
  groupId: string;
  campaignId: string;
  name: string;
  content?: unknown;
}): Promise<Campaign> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(campaigns).where(and(
      eq(campaigns.practiceId, data.practiceId),
      eq(campaigns.id, data.campaignId),
      isNull(campaigns.deletedAt),
    )).for('update').limit(1);
    const filter = existing?.audienceFilter as AudienceFilter | undefined;
    if (
      !existing ||
      existing.type !== 'group_announcement' ||
      !filter?.groupIds?.includes(data.groupId)
    ) throw new NotFoundError('Group announcement not found');
    if (existing.status !== 'draft') {
      throw new AppError(409, 'Only draft group announcements can be edited', 'INVALID_STATE');
    }

    if (data.content !== undefined) {
      if (!existing.templateId) throw new NotFoundError('Announcement content not found');
      const content = parseNewsletterDocument(data.content);
      const rendered = renderNewsletterDocument(content);
      const [updatedTemplate] = await tx.update(messageTemplates).set({
        name: `${data.name} content`,
        subject: rendered.subject,
        body: rendered.text,
        htmlBody: rendered.html,
        content,
        updatedAt: new Date(),
      }).where(and(
        eq(messageTemplates.practiceId, data.practiceId),
        eq(messageTemplates.id, existing.templateId),
        isNull(messageTemplates.deletedAt),
      )).returning({ id: messageTemplates.id });
      if (!updatedTemplate) throw new NotFoundError('Announcement content not found');
    }

    const [updatedCampaign] = await tx.update(campaigns).set({
      name: data.name,
      updatedAt: new Date(),
    }).where(and(
      eq(campaigns.practiceId, data.practiceId),
      eq(campaigns.id, data.campaignId),
      eq(campaigns.status, 'draft'),
    )).returning();
    if (!updatedCampaign) throw new AppError(409, 'Announcement changed while it was being edited', 'INVALID_STATE');
    return updatedCampaign;
  });
}

export async function createNewsletterCampaign(data: {
  practiceId: string;
  name: string;
  content: unknown;
  audienceFilter: AudienceFilter;
}): Promise<Campaign> {
  const content = parseNewsletterDocument(data.content);
  const rendered = renderNewsletterDocument(content);
  return db.transaction(async (tx) => {
    const [campaignTemplate] = await tx
      .insert(messageTemplates)
      .values({
        practiceId: data.practiceId,
        name: `${data.name} content`,
        channel: 'email',
        subject: rendered.subject,
        body: rendered.text,
        htmlBody: rendered.html,
        content,
      })
      .returning({ id: messageTemplates.id });

    const [campaign] = await tx
      .insert(campaigns)
      .values({
        practiceId: data.practiceId,
        name: data.name,
        type: 'newsletter',
        channel: 'email',
        status: 'draft',
        templateId: campaignTemplate.id,
        audienceFilter: { ...data.audienceFilter, consentEmail: true },
      })
      .returning();

    return campaign;
  });
}

export async function updateNewsletterDraft(data: {
  practiceId: string;
  campaignId: string;
  name: string;
  content?: unknown;
  audienceFilter: AudienceFilter;
}): Promise<Campaign> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(campaigns)
      .where(and(
        eq(campaigns.practiceId, data.practiceId),
        eq(campaigns.id, data.campaignId),
        isNull(campaigns.deletedAt),
      ))
      .for('update')
      .limit(1);
    if (!existing) throw new NotFoundError('Newsletter not found');
    if (existing.type !== 'newsletter' || existing.status !== 'draft') {
      throw new AppError(409, 'Only draft newsletters can be edited', 'INVALID_STATE');
    }

    let templateId = existing.templateId;
    if (data.content !== undefined) {
      const content = parseNewsletterDocument(data.content);
      const rendered = renderNewsletterDocument(content);
      if (templateId) {
        const [updatedTemplate] = await tx
          .update(messageTemplates)
          .set({
            name: `${data.name} content`,
            subject: rendered.subject,
            body: rendered.text,
            htmlBody: rendered.html,
            content,
            updatedAt: new Date(),
          })
          .where(and(
            eq(messageTemplates.practiceId, data.practiceId),
            eq(messageTemplates.id, templateId),
            isNull(messageTemplates.deletedAt),
          ))
          .returning({ id: messageTemplates.id });
        if (!updatedTemplate) throw new NotFoundError('Newsletter content not found');
      } else {
        const [createdTemplate] = await tx
          .insert(messageTemplates)
          .values({
            practiceId: data.practiceId,
            name: `${data.name} content`,
            channel: 'email',
            subject: rendered.subject,
            body: rendered.text,
            htmlBody: rendered.html,
            content,
          })
          .returning({ id: messageTemplates.id });
        templateId = createdTemplate.id;
      }
    }

    const [updatedCampaign] = await tx
      .update(campaigns)
      .set({
        name: data.name,
        ...(data.content !== undefined ? { templateId } : {}),
        audienceFilter: { ...data.audienceFilter, consentEmail: true },
        updatedAt: new Date(),
      })
      .where(and(
        eq(campaigns.practiceId, data.practiceId),
        eq(campaigns.id, data.campaignId),
        eq(campaigns.status, 'draft'),
      ))
      .returning();
    if (!updatedCampaign) throw new AppError(409, 'Newsletter changed while it was being edited', 'INVALID_STATE');
    return updatedCampaign;
  });
}

export async function getNewsletterDetails(practiceId: string, campaignId: string) {
  const campaign = await getCampaignById(practiceId, campaignId);
  if (!campaign || campaign.type !== 'newsletter') return null;

  const [template] = campaign.templateId
    ? await db.select({
        subject: messageTemplates.subject,
        content: messageTemplates.content,
      body: messageTemplates.body,
    }).from(messageTemplates).where(and(
        eq(messageTemplates.practiceId, practiceId),
        eq(messageTemplates.id, campaign.templateId),
        isNull(messageTemplates.deletedAt),
      )).limit(1)
    : [];
  const content = template?.content ?? {
    subject: template?.subject ?? campaign.name,
    sections: [{
      blocks: [{
        type: 'paragraph',
        properties: { text: template?.body ?? 'Add your newsletter content here.' },
      }],
    }],
  };
  return { campaign, content, subject: template?.subject ?? campaign.name };
}

export async function scheduleNewsletter(
  practiceId: string,
  campaignId: string,
  scheduledAt: Date,
): Promise<Campaign> {
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
    throw new AppError(400, 'Scheduled time must be now or in the future', 'INVALID_SCHEDULE');
  }
  const existing = await getCampaignById(practiceId, campaignId);
  if (!existing) throw new NotFoundError('Newsletter not found');
  if (existing.type !== 'newsletter' || existing.status !== 'draft') {
    throw new AppError(409, 'Only draft newsletters can be scheduled', 'INVALID_STATE');
  }
  if (!existing.templateId) throw new AppError(409, 'Newsletter content is required before scheduling', 'INVALID_CONTENT');

  const [template] = await db.select({
    subject: messageTemplates.subject,
    body: messageTemplates.body,
  }).from(messageTemplates).where(and(
    eq(messageTemplates.practiceId, practiceId),
    eq(messageTemplates.id, existing.templateId),
    isNull(messageTemplates.deletedAt),
  )).limit(1);
  if (!template?.subject?.trim() || !template.body.trim()) {
    throw new AppError(409, 'Newsletter subject and content are required before scheduling', 'INVALID_CONTENT');
  }

  const audienceSize = await resolveAudience(practiceId, {
    ...(existing.audienceFilter as AudienceFilter),
    consentEmail: true,
  }, 1);
  if (!audienceSize.length) {
    throw new AppError(400, 'No eligible email recipients match this audience', 'EMPTY_AUDIENCE');
  }

  const [scheduled] = await db
    .update(campaigns)
    .set({ status: 'scheduled', scheduledAt, updatedAt: new Date() })
    .where(and(
      eq(campaigns.practiceId, practiceId),
      eq(campaigns.id, campaignId),
      eq(campaigns.status, 'draft'),
      isNull(campaigns.deletedAt),
    ))
    .returning();
  if (!scheduled) throw new AppError(409, 'Newsletter changed while it was being scheduled', 'INVALID_STATE');
  return scheduled;
}

export async function scheduleGroupAnnouncement(
  practiceId: string,
  groupId: string,
  campaignId: string,
  scheduledAt: Date,
): Promise<Campaign> {
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
    throw new AppError(400, 'Scheduled time must be now or in the future', 'INVALID_SCHEDULE');
  }
  const existing = await getCampaignById(practiceId, campaignId);
  const filter = existing?.audienceFilter as AudienceFilter | undefined;
  if (
    !existing ||
    existing.type !== 'group_announcement' ||
    !filter?.groupIds?.includes(groupId)
  ) throw new NotFoundError('Group announcement not found');
  if (existing.status !== 'draft') {
    throw new AppError(409, 'Only draft group announcements can be scheduled', 'INVALID_STATE');
  }
  if (!existing.templateId) throw new AppError(409, 'Announcement content is required before scheduling', 'INVALID_CONTENT');

  const [template] = await db.select({
    subject: messageTemplates.subject,
    body: messageTemplates.body,
  }).from(messageTemplates).where(and(
    eq(messageTemplates.practiceId, practiceId),
    eq(messageTemplates.id, existing.templateId),
    isNull(messageTemplates.deletedAt),
  )).limit(1);
  if (!template?.subject?.trim() || !template.body.trim()) {
    throw new AppError(409, 'Announcement subject and content are required before scheduling', 'INVALID_CONTENT');
  }

  const recipients = await resolveAudience(practiceId, {
    ...filter,
    groupIds: [groupId],
    patientStatuses: ['Patient'],
    consentEmail: true,
  }, 1);
  if (!recipients.length) {
    throw new AppError(400, 'No eligible email recipients match this group', 'EMPTY_AUDIENCE');
  }

  const [scheduled] = await db.update(campaigns).set({
    status: 'scheduled',
    scheduledAt,
    updatedAt: new Date(),
  }).where(and(
    eq(campaigns.practiceId, practiceId),
    eq(campaigns.id, campaignId),
    eq(campaigns.status, 'draft'),
    isNull(campaigns.deletedAt),
  )).returning();
  if (!scheduled) throw new AppError(409, 'Announcement changed while it was being scheduled', 'INVALID_STATE');
  return scheduled;
}

export async function updateCampaign(
  practiceId: string,
  campaignId: string,
  data: Partial<Pick<NewCampaign, 'name' | 'templateId' | 'audienceFilter' | 'scheduledAt'>>
): Promise<Campaign> {
  const existing = await getCampaignById(practiceId, campaignId);
  if (!existing) throw new NotFoundError('Campaign not found');

  if (existing.status !== 'draft') {
    throw new AppError(409, 'Only draft campaigns can be edited', 'INVALID_STATE');
  }

  const [updated] = await db
    .update(campaigns)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(campaigns.practiceId, practiceId), eq(campaigns.id, campaignId)))
    .returning();
  return updated;
}

export async function transitionCampaign(
  practiceId: string,
  campaignId: string,
  toStatus: CampaignStatus,
  extra: Partial<Pick<Campaign, 'startedAt' | 'completedAt'>> = {}
): Promise<Campaign> {
  const existing = await getCampaignById(practiceId, campaignId);
  if (!existing) throw new NotFoundError('Campaign not found');

  if (!canTransition(existing.status as CampaignStatus, toStatus)) {
    throw new AppError(
      409,
      `Cannot transition campaign from '${existing.status}' to '${toStatus}'`,
      'INVALID_STATE_TRANSITION'
    );
  }

  const now = new Date();
  const updates: Partial<Campaign> = {
    status: toStatus,
    updatedAt: now,
    ...extra,
  };
  if (toStatus === 'processing') updates.startedAt = now;
  if (['completed', 'partially_failed', 'failed'].includes(toStatus)) updates.completedAt = now;

  const [updated] = await db
    .update(campaigns)
    .set(updates)
    .where(and(
      eq(campaigns.practiceId, practiceId),
      eq(campaigns.id, campaignId),
      eq(campaigns.status, existing.status),
    ))
    .returning();
  if (!updated) throw new AppError(409, 'Campaign changed before the status transition completed', 'INVALID_STATE_TRANSITION');
  return updated;
}

export async function softDeleteCampaign(practiceId: string, campaignId: string): Promise<void> {
  const existing = await getCampaignById(practiceId, campaignId);
  if (!existing) throw new NotFoundError('Campaign not found');
  if (!['draft', 'cancelled'].includes(existing.status)) {
    throw new AppError(409, 'Only draft or cancelled campaigns can be deleted', 'INVALID_STATE');
  }

  await db
    .update(campaigns)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(campaigns.practiceId, practiceId), eq(campaigns.id, campaignId)));
}

/**
 * Materializes audience into campaign_recipients before the job starts dispatching.
 * Idempotent: uses ON CONFLICT DO NOTHING.
 */
export async function materializeRecipients(practiceId: string, campaignId: string): Promise<number> {
  const campaign = await getCampaignById(practiceId, campaignId);
  if (!campaign) throw new NotFoundError('Campaign not found');

  const audience = await resolveAudience(practiceId, campaign.audienceFilter as AudienceFilter);

  if (audience.length === 0) return 0;

  const values = audience.map((p) => ({
    campaignId,
    patientId: p.id,
    status: 'pending' as const,
  }));

  // Batch insert in chunks of 500 for large audiences
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < values.length; i += CHUNK) {
    const chunk = values.slice(i, i + CHUNK);
    const rows = await db
      .insert(campaignRecipients)
      .values(chunk)
      .onConflictDoNothing()
      .returning({ id: campaignRecipients.id });
    inserted += rows.length;
  }

  return inserted;
}

/** Returns the scheduled campaigns due for processing now. */
export async function getDueCampaigns(practiceId?: string): Promise<Campaign[]> {
  return db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.status, 'scheduled'),
        isNull(campaignsTable.deletedAt),
        sql`${campaignsTable.scheduledAt} <= NOW()`,
        ...(practiceId ? [eq(campaignsTable.practiceId, practiceId)] : [])
      )
    );
}
