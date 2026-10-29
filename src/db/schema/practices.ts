import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { organisations } from './organisations';

export const practices = pgTable('practices', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id')
    .notNull()
    .references(() => organisations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  phone: text('phone'),
  address: text('address'),
  logoUrl: text('logo_url'),
  timezone: text('timezone').default('UTC').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Practice = typeof practices.$inferSelect;
export type NewPractice = typeof practices.$inferInsert;
