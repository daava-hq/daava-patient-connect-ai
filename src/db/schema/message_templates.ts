import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { practices } from './practices';

/**
 * Reusable message templates scoped to a practice.
 * Variables use {{variable_name}} syntax and are interpolated at send time.
 */
export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id')
    .notNull()
    .references(() => practices.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  channel: text('channel').notNull(), // 'sms' | 'email'
  subject: text('subject'), // email only
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;
