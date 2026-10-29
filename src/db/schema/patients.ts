import { pgTable, uuid, bigint, text, date, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { practices } from './practices';

export const patients = pgTable(
  'patients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practiceId: uuid('practice_id')
      .notNull()
      .references(() => practices.id, { onDelete: 'cascade' }),
    opendentalPatientId: bigint('opendental_patient_id', { mode: 'number' }).notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    dateOfBirth: date('date_of_birth'),
    phoneHome: text('phone_home'),
    phoneMobile: text('phone_mobile'),
    email: text('email'),
    status: text('status').default('Patient').notNull(),
    smsConsent: boolean('sms_consent').default(false).notNull(),
    emailConsent: boolean('email_consent').default(false).notNull(),
    opendentalUpdatedAt: timestamp('opendental_updated_at', { withTimezone: true }),
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: unique().on(t.practiceId, t.opendentalPatientId),
  })
);

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
