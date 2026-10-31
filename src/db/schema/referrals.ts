import { pgTable, uuid, text, timestamp, numeric } from 'drizzle-orm/pg-core';
import { practices } from './practices';
import { patients } from './patients';

export const referrals = pgTable('referrals', {
  id: uuid('id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id')
    .notNull()
    .references(() => practices.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  referrerName: text('referrer_name'),
  referredTo: text('referred_to').notNull(), // specialist / doctor / provider name
  status: text('status').notNull().default('Pending'), // Pending, Consulted, Completed, Declined
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;
