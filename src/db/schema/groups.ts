import { pgTable, uuid, text, timestamp, unique, jsonb, index } from 'drizzle-orm/pg-core';
import { practices } from './practices';
import { patients } from './patients';
import { users } from './users';

export type GroupType = 'static' | 'dynamic';
export type GroupCriteria = {
  patientStatuses?: Array<'Patient' | 'Inactive' | 'Archived'>;
  minAge?: number;
  maxAge?: number;
  birthMonths?: number[];
  appointmentStatuses?: Array<'Scheduled' | 'Complete' | 'Broken' | 'UnschedList'>;
  lastAppointmentAfter?: string;
  lastAppointmentBefore?: string;
  contactAvailability?: 'email' | 'sms' | 'either' | 'both';
};

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practiceId: uuid('practice_id')
      .notNull()
      .references(() => practices.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    groupType: text('group_type').$type<GroupType>().notNull().default('static'),
    criteria: jsonb('criteria').$type<GroupCriteria>().notNull().default({}),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    practiceIdx: index('idx_groups_practice_archived').on(t.practiceId, t.archivedAt),
  })
);

export const groupMembers = pgTable(
  'group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: unique().on(t.groupId, t.patientId),
  })
);

export const groupMembershipHistory = pgTable(
  'group_membership_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practiceId: uuid('practice_id')
      .notNull()
      .references(() => practices.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
    action: text('action').$type<'added' | 'removed'>().notNull(),
    changedBy: uuid('changed_by').references(() => users.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    practiceGroupIdx: index('idx_group_membership_history_practice_group').on(t.practiceId, t.groupId),
  })
);

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
export type GroupMembershipHistory = typeof groupMembershipHistory.$inferSelect;
