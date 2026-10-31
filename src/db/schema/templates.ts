import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, unique } from 'drizzle-orm/pg-core';
import { practices } from './practices';
import { users } from './users';

export const TEMPLATE_CATEGORIES = [
  { slug: 'appointment-reminders', name: 'Appointment Reminders' },
  { slug: 'birthdays', name: 'Birthdays' },
  { slug: 'groups', name: 'Groups' },
  { slug: 'newsletters', name: 'Newsletters' },
  { slug: 'payment-reminders', name: 'Payment Reminders & Requests' },
  { slug: 'recall', name: 'Recall' },
  { slug: 'referrals', name: 'Referrals' },
  { slug: 'surveys', name: 'Surveys' },
  { slug: 'connect', name: 'Connect / Two-Way Texting' },
] as const;

export const TEMPLATE_TYPES = [
  'sms',
  'email',
  'newsletter',
  'survey',
  'internal_response',
] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];
export type ChannelType = 'sms' | 'email' | 'in_app';

export const templateCategories = pgTable('template_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id').references(() => practices.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => templateCategories.id),
  name: text('name').notNull(),
  description: text('description'),
  templateType: text('template_type').notNull().$type<TemplateType>(),
  channel: text('channel').notNull().$type<ChannelType>(),
  content: jsonb('content').notNull().default({}),
  variables: jsonb('variables').notNull().default([]),
  status: text('status').notNull().default('draft'),
  isSystem: boolean('is_system').notNull().default(false),
  version: integer('version').notNull().default(1),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const templateVersions = pgTable('template_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  content: jsonb('content').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const templateFavorites = pgTable(
  'template_favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: unique().on(t.templateId, t.userId),
  })
);

export const templateUsageHistory = pgTable('template_usage_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  practiceId: uuid('practice_id').notNull().references(() => practices.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  moduleType: text('module_type').notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type TemplateCategory = typeof templateCategories.$inferSelect;
export type TemplateVersion = typeof templateVersions.$inferSelect;
export type TemplateFavorite = typeof templateFavorites.$inferSelect;
