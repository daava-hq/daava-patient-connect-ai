import { pgTable, uuid, bigint, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { practices } from './practices';
import { patients } from './patients';

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practiceId: uuid('practice_id')
      .notNull()
      .references(() => practices.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    opendentalApptId: bigint('opendental_appt_id', { mode: 'number' }).notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    status: text('status').default('Scheduled').notNull(),
    description: text('description'),
    opendentalUpdatedAt: timestamp('opendental_updated_at', { withTimezone: true }),
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: unique().on(t.practiceId, t.opendentalApptId),
  })
);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
