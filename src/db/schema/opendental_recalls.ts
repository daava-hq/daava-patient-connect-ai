import { pgTable, uuid, bigint, integer, date, boolean, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { practices } from './practices';
import { patients } from './patients';

export const opendentalRecalls = pgTable(
  'opendental_recalls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practiceId: uuid('practice_id')
      .notNull()
      .references(() => practices.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    opendentalRecallId: bigint('opendental_recall_id', { mode: 'number' }).notNull(),
    recallTypeNum: integer('recall_type_num').notNull(),
    dueDate: date('due_date'),
    dateScheduled: date('date_scheduled'),
    isDisabled: boolean('is_disabled').notNull().default(false),
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    practiceRecallUnique: unique().on(table.practiceId, table.opendentalRecallId),
    patientDueDateIdx: index('idx_opendental_recalls_practice_patient_due').on(
      table.practiceId,
      table.patientId,
      table.dueDate,
    ),
  }),
);

export type OpenDentalRecall = typeof opendentalRecalls.$inferSelect;
