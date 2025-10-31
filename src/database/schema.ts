import { pgTable, varchar, bigint } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  balance: bigint('balance', { mode: 'number' }).notNull().default(0),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

