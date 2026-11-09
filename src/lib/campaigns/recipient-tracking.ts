import 'server-only';
import { db } from '@/db';
import {
  campaignRecipients,
  campaignDeliveryEvents,
  CampaignRecipient,
  NewCampaignDeliveryEvent,
  RecipientStatus,
} from '@/db/schema/campaign_recipients';
import { patients } from '@/db/schema/patients';
import { eq, and, inArray, sql } from 'drizzle-orm';

export const MAX_RETRY_ATTEMPTS = 3;

export async function getPendingRecipients(
  campaignId: string,
  practiceId: string,
  limit = 100
): Promise<Array<CampaignRecipient & {
  email: string | null;
  phoneMobile: string | null;
  phoneHome: string | null;
  firstName: string;
  lastName: string;
  patientStatus: string;
  smsConsent: boolean;
  emailConsent: boolean;
}>> {
  return db
    .select({
      id: campaignRecipients.id,
      campaignId: campaignRecipients.campaignId,
      patientId: campaignRecipients.patientId,
      status: campaignRecipients.status,
      retryCount: campaignRecipients.retryCount,
      lastErrorMessage: campaignRecipients.lastErrorMessage,
      providerMessageId: campaignRecipients.providerMessageId,
      createdAt: campaignRecipients.createdAt,
      updatedAt: campaignRecipients.updatedAt,
      email: patients.email,
      phoneMobile: patients.phoneMobile,
      phoneHome: patients.phoneHome,
      smsConsent: patients.smsConsent,
      emailConsent: patients.emailConsent,
      firstName: patients.firstName,
      lastName: patients.lastName,
      patientStatus: patients.status,
    })
    .from(campaignRecipients)
    .innerJoin(patients, eq(campaignRecipients.patientId, patients.id))
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(patients.practiceId, practiceId),
        inArray(campaignRecipients.status, ['pending']),
      )
    )
    .limit(limit);
}

export async function markRecipientDispatched(
  recipientId: string,
  providerMessageId: string
): Promise<void> {
  await db
    .update(campaignRecipients)
    .set({ status: 'dispatched', providerMessageId, updatedAt: new Date() })
    .where(eq(campaignRecipients.id, recipientId));

  await appendDeliveryEvent({
    recipientId,
    eventType: 'sent',
    providerMessageId,
  });
}

export async function markRecipientDelivered(
  recipientId: string,
  providerMessageId?: string
): Promise<void> {
  await db
    .update(campaignRecipients)
    .set({ status: 'delivered', updatedAt: new Date() })
    .where(eq(campaignRecipients.id, recipientId));

  await appendDeliveryEvent({ recipientId, eventType: 'delivered', providerMessageId });
}

export async function markRecipientBounced(
  recipientId: string,
  providerMessageId?: string,
): Promise<void> {
  await db
    .update(campaignRecipients)
    .set({ status: 'bounced', updatedAt: new Date() })
    .where(eq(campaignRecipients.id, recipientId));
  await appendDeliveryEvent({ recipientId, eventType: 'bounced', providerMessageId });
}

export async function markRecipientFailed(
  recipientId: string,
  errorMessage: string
): Promise<void> {
  const [current] = await db
    .select({ retryCount: campaignRecipients.retryCount })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.id, recipientId))
    .limit(1);

  const newRetryCount = (current?.retryCount ?? 0) + 1;
  const finalStatus: RecipientStatus =
    newRetryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending';

  await db
    .update(campaignRecipients)
    .set({
      status: finalStatus,
      retryCount: newRetryCount,
      lastErrorMessage: errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(campaignRecipients.id, recipientId));

  await appendDeliveryEvent({ recipientId, eventType: 'failed' });
}

export async function markRecipientSkipped(recipientId: string, reason: string): Promise<void> {
  await db
    .update(campaignRecipients)
    .set({ status: 'skipped', lastErrorMessage: reason, updatedAt: new Date() })
    .where(eq(campaignRecipients.id, recipientId));

  await appendDeliveryEvent({ recipientId, eventType: reason === 'opted_out' ? 'opted_out' : 'skipped' });
}

export async function markRecipientDuplicate(recipientId: string): Promise<void> {
  await db
    .update(campaignRecipients)
    .set({ status: 'duplicate', updatedAt: new Date() })
    .where(eq(campaignRecipients.id, recipientId));
}

export async function appendDeliveryEvent(
  data: Omit<NewCampaignDeliveryEvent, 'id' | 'occurredAt'>
): Promise<void> {
  await db.insert(campaignDeliveryEvents).values(data);
}

export async function getCampaignStats(campaignId: string) {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) FILTER (WHERE ${campaignRecipients.status} = 'pending')::int`,
      dispatched: sql<number>`count(*) FILTER (WHERE ${campaignRecipients.status} = 'dispatched')::int`,
      delivered: sql<number>`count(*) FILTER (WHERE ${campaignRecipients.status} = 'delivered')::int`,
      bounced: sql<number>`count(*) FILTER (WHERE ${campaignRecipients.status} = 'bounced')::int`,
      failed: sql<number>`count(*) FILTER (WHERE ${campaignRecipients.status} = 'failed')::int`,
      skipped: sql<number>`count(*) FILTER (WHERE ${campaignRecipients.status} = 'skipped')::int`,
      duplicate: sql<number>`count(*) FILTER (WHERE ${campaignRecipients.status} = 'duplicate')::int`,
      sent: sql<number>`(
        SELECT count(*)::int FROM campaign_delivery_events e
        JOIN campaign_recipients r ON r.id = e.recipient_id
        WHERE r.campaign_id = ${campaignId} AND e.event_type = 'sent'
      )`,
      opened: sql<number>`(
        SELECT count(*)::int FROM campaign_delivery_events e
        JOIN campaign_recipients r ON r.id = e.recipient_id
        WHERE r.campaign_id = ${campaignId} AND e.event_type = 'opened'
      )`,
      clicked: sql<number>`(
        SELECT count(*)::int FROM campaign_delivery_events e
        JOIN campaign_recipients r ON r.id = e.recipient_id
        WHERE r.campaign_id = ${campaignId} AND e.event_type = 'clicked'
      )`,
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId));

  return stats ?? { total: 0, pending: 0, dispatched: 0, delivered: 0, bounced: 0, failed: 0, skipped: 0, duplicate: 0, sent: 0, opened: 0, clicked: 0 };
}

/** Returns recipient records for a campaign with their latest delivery events. */
export async function getCampaignRecipientHistory(campaignId: string, limit = 100, offset = 0) {
  return db
    .select({
      recipientId: campaignRecipients.id,
      patientId: campaignRecipients.patientId,
      status: campaignRecipients.status,
      retryCount: campaignRecipients.retryCount,
      providerMessageId: campaignRecipients.providerMessageId,
      lastErrorMessage: campaignRecipients.lastErrorMessage,
      updatedAt: campaignRecipients.updatedAt,
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId))
    .orderBy(campaignRecipients.updatedAt)
    .limit(limit)
    .offset(offset);
}
