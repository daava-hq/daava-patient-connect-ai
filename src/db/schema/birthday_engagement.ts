import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { practices } from './practices';
import { patients } from './patients';
import { templates } from './templates';
import { users } from './users';

export type BirthdayEligibilityRules = {
  minimumAge?: number;
  maximumAge?: number;
};

export const BIRTHDAY_OCCURRENCE_STATUSES = [
  'pending',
  'processing',
  'sent',
  'delivered',
  'failed',
  'skipped',
] as const;
export type BirthdayOccurrenceStatus = (typeof BIRTHDAY_OCCURRENCE_STATUSES)[number];

export const birthdayCampaigns = pgTable(
  'birthday_engagement_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practiceId: uuid('practice_id')
      .notNull()
      .references(() => practices.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    channel: text('channel').$type<'sms' | 'email'>().notNull(),
    templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
    daysBefore: integer('days_before').notNull().default(0),
    localDeliveryTime: text('local_delivery_time').notNull().default('09:00'),
    offerText: text('offer_text'),
    eligibilityRules: jsonb('eligibility_rules')
      .$type<BirthdayEligibilityRules>()
      .notNull()
      .default({}),
    enabled: boolean('enabled').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    practiceIndex: index('idx_birthday_engagement_campaigns_practice').on(table.practiceId),
  })
);

export const birthdayMessageOccurrences = pgTable(
  'birthday_engagement_occurrences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practiceId: uuid('practice_id')
      .notNull()
      .references(() => practices.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => birthdayCampaigns.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    birthdayYear: integer('birthday_year').notNull(),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    status: text('status').$type<BirthdayOccurrenceStatus>().notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    providerMessageId: text('provider_message_id'),
    lastErrorMessage: text('last_error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueOccurrence: unique('uq_birthday_engagement_occurrence').on(
      table.campaignId,
      table.patientId,
      table.birthdayYear
    ),
    dueIndex: index('idx_birthday_engagement_occurrences_due').on(
      table.practiceId,
      table.status,
      table.scheduledFor
    ),
  })
);

export type BirthdayCampaign = typeof birthdayCampaigns.$inferSelect;
export type NewBirthdayCampaign = typeof birthdayCampaigns.$inferInsert;
export type BirthdayMessageOccurrence = typeof birthdayMessageOccurrences.$inferSelect;
