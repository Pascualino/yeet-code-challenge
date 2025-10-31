import { pgTable, varchar, bigint, uuid, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const actionTypeEnum = pgEnum('action_type', ['bet', 'win', 'rollback']);

export const actionsLedger = pgTable('actions_ledger', {
  id: uuid('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  type: actionTypeEnum('type').notNull(),
  game: varchar('game', { length: 255 }),
  gameId: varchar('game_id', { length: 255 }),
  actionId: varchar('action_id', { length: 255 }).notNull().unique(),
  originalActionId: varchar('original_action_id', { length: 255 }), // For rollbacks
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const balances = pgTable('balances', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  balance: bigint('balance', { mode: 'number' }).notNull().default(0),
});

export type ActionLedgerEntry = typeof actionsLedger.$inferSelect;
export type NewActionLedgerEntry = typeof actionsLedger.$inferInsert;
export type Balance = typeof balances.$inferSelect;
export type NewBalance = typeof balances.$inferInsert;

