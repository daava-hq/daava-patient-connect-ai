import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { campaigns } from './campaigns';

/**
 * Tracks individual background job run attempts for a campaign.
 * Enables retry visibility and idempotency across process restarts.
 */
export const campaignJobRuns = pgTable('campaign_job_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  attempt: integer('attempt').notNull().default(1),
  status: text('status').notNull().default('running'), // 'running' | 'completed' | 'failed'
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export type CampaignJobRun = typeof campaignJobRuns.$inferSelect;
export type NewCampaignJobRun = typeof campaignJobRuns.$inferInsert;
