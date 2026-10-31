import { pgTable, uuid, text, timestamp, numeric, boolean, unique } from 'drizzle-orm/pg-core';
import { practices } from './practices';
import { patients } from './patients';

export const patientBalances = pgTable(
  'patient_balances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practiceId: uuid('practice_id')
      .notNull()
      .references(() => practices.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0.00'),
    lastReminderSentAt: timestamp('last_reminder_sent_at', { withTimezone: true }),
    paymentLinkSent: boolean('payment_link_sent').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: unique().on(t.practiceId, t.patientId),
  })
);

export type PatientBalance = typeof patientBalances.$inferSelect;
export type NewPatientBalance = typeof patientBalances.$inferInsert;
