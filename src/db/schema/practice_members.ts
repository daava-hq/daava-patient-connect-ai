import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { practices } from './practices';
import { users } from './users';

export const practiceMembers = pgTable(
  'practice_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    practiceId: uuid('practice_id')
      .notNull()
      .references(() => practices.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').default('member').notNull(), // owner, admin, member
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: unique().on(t.practiceId, t.userId),
  })
);

export type PracticeMember = typeof practiceMembers.$inferSelect;
export type NewPracticeMember = typeof practiceMembers.$inferInsert;
