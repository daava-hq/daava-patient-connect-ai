import { pgTable, uuid, text, boolean, timestamp, integer, unique, index } from 'drizzle-orm/pg-core';
import { practices } from './practices';
import { appointments } from './appointments';
import { patients } from './patients';
import { templates } from './templates';
import { users } from './users';

export const REMINDER_INTERVALS = ['7_days', '3_days', '24_hours', 'same_day'] as const;
export type ReminderInterval = (typeof REMINDER_INTERVALS)[number];

export const APPOINTMENT_REMINDER_STATUSES = [
  'pending',
  'processing',
  'sent',
  'delivered',
  'failed',
  'skipped',
] as const;
export type AppointmentReminderStatus = (typeof APPOINTMENT_REMINDER_STATUSES)[number];

export const appointmentReminderSchedules = pgTable(
  'appointment_reminder_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practiceId: uuid('practice_id')
      .notNull()
      .references(() => practices.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    interval: text('interval').$type<ReminderInterval>().notNull(),
    channel: text('channel').$type<'sms' | 'email'>().notNull(),
    localSendTime: text('local_send_time').notNull().default('09:00'),
    templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
    enabled: boolean('enabled').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    practiceIndex: index('idx_appointment_reminder_schedules_practice').on(table.practiceId),
  })
);

export const appointmentReminders = pgTable(
  'appointment_reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practiceId: uuid('practice_id')
      .notNull()
      .references(() => practices.id, { onDelete: 'cascade' }),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => appointmentReminderSchedules.id, { onDelete: 'cascade' }),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    channel: text('channel').$type<'sms' | 'email'>().notNull(),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    status: text('status').$type<AppointmentReminderStatus>().notNull().default('pending'),
    manual: boolean('manual').notNull().default(false),
    attemptCount: integer('attempt_count').notNull().default(0),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    providerMessageId: text('provider_message_id'),
    lastErrorMessage: text('last_error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueOccurrence: unique('uq_appointment_reminder_occurrence').on(
      table.appointmentId,
      table.scheduleId,
      table.channel,
      table.patientId
    ),
    dueIndex: index('idx_appointment_reminders_due').on(table.practiceId, table.status, table.scheduledFor),
    appointmentIndex: index('idx_appointment_reminders_appointment').on(table.appointmentId),
  })
);

export type AppointmentReminderSchedule = typeof appointmentReminderSchedules.$inferSelect;
export type NewAppointmentReminderSchedule = typeof appointmentReminderSchedules.$inferInsert;
export type AppointmentReminder = typeof appointmentReminders.$inferSelect;
export type NewAppointmentReminder = typeof appointmentReminders.$inferInsert;
