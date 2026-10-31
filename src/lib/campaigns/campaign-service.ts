import 'server-only';
import { db } from '@/db';
import { campaigns, campaigns as campaignsTable, Campaign, NewCampaign, CampaignStatus, AudienceFilter } from '@/db/schema/campaigns';
import { campaignRecipients } from '@/db/schema/campaign_recipients';
import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import { NotFoundError, AppError } from '@/lib/errors';
import { resolveAudience } from './audience-service';

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
        SELECT count(*)::int FROM campaign_recipients cr WHERE cr.campaign_id = ${campaigns.id}
      )`,
      deliveredCount: sql<number>`(
        SELECT count(*)::int FROM campaign_recipients cr
        WHERE cr.campaign_id = ${campaigns.id} AND cr.status = 'delivered'
      )`,
      failedCount: sql<number>`(
        SELECT count(*)::int FROM campaign_recipients cr
        WHERE cr.campaign_id = ${campaigns.id} AND cr.status = 'failed'
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
    .where(and(eq(campaigns.practiceId, practiceId), eq(campaigns.id, campaignId)))
    .returning();
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
export async function getDueCampaigns(): Promise<Campaign[]> {
  return db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.status, 'scheduled'),
        isNull(campaignsTable.deletedAt),
        sql`${campaignsTable.scheduledAt} <= NOW()`
      )
    );
}
