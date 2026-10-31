import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { practices } from './practices';
import { messageTemplates } from './message_templates';

/**
 * Campaign states:
 *   draft        → Created but not yet scheduled or sent.
 *   scheduled    → Will be dispatched at scheduled_at.
 *   processing   → Job is actively dispatching recipients.
 *   completed    → All recipients successfully dispatched.
 *   partially_failed → Some recipients failed after retries.
 *   failed       → Job failed before any dispatch; retriable.
 *   cancelled    → Manually stopped before processing.
 */
export const CAMPAIGN_STATUSES = [
  'draft',
  'scheduled',
  'processing',
  'completed',
  'partially_failed',
  'failed',
  'cancelled',
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/**
 * AudienceFilter persisted as JSONB.
 * Example shape:
 * {
 *   groupIds?: string[];
 *   consentSms?: true;
 *   consentEmail?: true;
 *   patientStatuses?: string[];
 *   birthdayMonth?: number;       // 1–12
 *   appointmentAfter?: string;    // ISO date
 *   appointmentBefore?: string;   // ISO date
 *   patientIds?: string[];        // explicit selection
 * }
 */
export type AudienceFilter = {
  groupIds?: string[];
  consentSms?: boolean;
  consentEmail?: boolean;
  patientStatuses?: string[];
  birthdayMonth?: number;
  appointmentAfter?: string;
  appointmentBefore?: string;
  patientIds?: string[];
};

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id')
    .notNull()
    .references(() => practices.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'reminder' | 'newsletter' | 'birthday' | 'recall' | 'payment' | 'survey' | 'referral'
  channel: text('channel').notNull(), // 'sms' | 'email'
  status: text('status').notNull().default('draft'),
  templateId: uuid('template_id').references(() => messageTemplates.id, { onDelete: 'set null' }),
  audienceFilter: jsonb('audience_filter').$type<AudienceFilter>().notNull().default({}),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
