import 'server-only';
import { db } from '@/db';
import { campaignDeliveryEvents, campaignRecipients } from '@/db/schema/campaign_recipients';
import { campaigns } from '@/db/schema/campaigns';
import { patients } from '@/db/schema/patients';
import { and, eq, inArray, isNull } from 'drizzle-orm';

export type SesCampaignEventType =
  | 'delivery'
  | 'bounce'
  | 'complaint'
  | 'open'
  | 'click'
  | 'subscription'
  | 'reject';

export interface SesCampaignEvent {
  providerEventId: string;
  providerMessageId: string;
  eventType: SesCampaignEventType;
  occurredAt: Date;
  permanentBounce?: boolean;
  unsubscribe?: boolean;
}

const eventName: Record<SesCampaignEventType, string> = {
  delivery: 'delivered',
  bounce: 'bounced',
  complaint: 'complaint',
  open: 'opened',
  click: 'clicked',
  subscription: 'opted_out',
  reject: 'failed',
};

export async function recordSesCampaignEvent(event: SesCampaignEvent): Promise<'recorded' | 'duplicate' | 'unmatched'> {
  return db.transaction(async (tx) => {
    const matches = await tx
      .select({
        recipientId: campaignRecipients.id,
        patientId: campaignRecipients.patientId,
        practiceId: campaigns.practiceId,
      })
      .from(campaignRecipients)
      .innerJoin(campaigns, eq(campaignRecipients.campaignId, campaigns.id))
      .where(and(
        eq(campaignRecipients.providerMessageId, event.providerMessageId),
        inArray(campaigns.type, ['newsletter', 'group_announcement']),
        isNull(campaigns.deletedAt),
      ))
      .limit(1);
    if (!matches.length) return 'unmatched';

    const recipients = await tx
      .insert(campaignDeliveryEvents)
      .values(matches.map((match) => ({
        recipientId: match.recipientId,
        eventType: eventName[event.eventType],
        providerMessageId: event.providerMessageId,
        providerEventId: event.providerEventId,
        occurredAt: event.occurredAt,
      })))
      .onConflictDoNothing()
      .returning({ id: campaignDeliveryEvents.id, recipientId: campaignDeliveryEvents.recipientId });
    if (!recipients.length) return 'duplicate';

    if (event.eventType === 'delivery') {
      await tx
        .update(campaignRecipients)
        .set({ status: 'delivered', updatedAt: event.occurredAt })
        .where(and(
          inArray(campaignRecipients.id, matches.map((match) => match.recipientId)),
          eq(campaignRecipients.status, 'dispatched'),
        ));
    }

    if (event.eventType === 'bounce') {
      await tx
        .update(campaignRecipients)
        .set({ status: 'bounced', updatedAt: event.occurredAt })
        .where(inArray(campaignRecipients.id, matches.map((match) => match.recipientId)));
    }

    if (event.eventType === 'reject') {
      await tx
        .update(campaignRecipients)
        .set({ status: 'failed', updatedAt: event.occurredAt })
        .where(inArray(campaignRecipients.id, matches.map((match) => match.recipientId)));
    }

    const mustOptOut =
      event.eventType === 'complaint' ||
      (event.eventType === 'bounce' && event.permanentBounce === true) ||
      (event.eventType === 'subscription' && event.unsubscribe === true);
    if (mustOptOut) {
      for (const match of matches) {
        await tx
          .update(patients)
          .set({ emailConsent: false, updatedAt: event.occurredAt })
          .where(and(
            eq(patients.id, match.patientId),
            eq(patients.practiceId, match.practiceId),
          ));
      }
    }

    return 'recorded';
  });
}
