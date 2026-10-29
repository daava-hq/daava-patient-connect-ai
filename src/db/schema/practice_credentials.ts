import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { practices } from './practices';

export const practiceOpendentalCredentials = pgTable('practice_opendental_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id')
    .notNull()
    .references(() => practices.id, { onDelete: 'cascade' })
    .unique(),
  developerKeyEnc: text('developer_key_enc').notNull(),
  customerKeyEnc: text('customer_key_enc').notNull(),
  lastPatientSyncedAt: timestamp('last_patient_synced_at', { withTimezone: true }),
  lastApptSyncedAt: timestamp('last_appt_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type PracticeOpendentalCredentials = typeof practiceOpendentalCredentials.$inferSelect;
export type NewPracticeOpendentalCredentials = typeof practiceOpendentalCredentials.$inferInsert;
