import { pgTable, uuid, text, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { campaigns } from './campaigns';
import { patients } from './patients';

/**
 * Recipient statuses:
 *   pending      → Queued but not yet dispatched.
 *   dispatched   → Sent to provider; awaiting confirmation.
 *   delivered    → Provider confirmed delivery.
 *   failed       → All retries exhausted; not delivered.
 *   skipped      → Consent revoked or opt-out detected before send.
 *   duplicate    → Deduplicated; another record covers this send.
 */
export const RECIPIENT_STATUSES = [
  'pending',
  'dispatched',
  'delivered',
  'failed',
  'skipped',
  'duplicate',
] as const;

export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number];

export const campaignRecipients = pgTable(
  'campaign_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    retryCount: integer('retry_count').notNull().default(0),
    lastErrorMessage: text('last_error_message'),
    providerMessageId: text('provider_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: unique().on(t.campaignId, t.patientId),
  })
);

/**
 * Immutable append-only log of every delivery event from the provider.
 */
export const campaignDeliveryEvents = pgTable('campaign_delivery_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientId: uuid('recipient_id')
    .notNull()
    .references(() => campaignRecipients.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(), // 'sent' | 'delivered' | 'failed' | 'bounced' | 'opted_out'
  providerMessageId: text('provider_message_id'),
  rawPayload: text('raw_payload'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type NewCampaignRecipient = typeof campaignRecipients.$inferInsert;
export type CampaignDeliveryEvent = typeof campaignDeliveryEvents.$inferSelect;
export type NewCampaignDeliveryEvent = typeof campaignDeliveryEvents.$inferInsert;
