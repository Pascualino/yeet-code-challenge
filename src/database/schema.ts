import { pgTable, varchar, bigint, timestamp, pgEnum, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { Action } from 'src/aggregator/types/actions';

export const actionTypeEnum = pgEnum('action_type', ['bet', 'win', 'rollback']);

export const actionsLedger = pgTable('actions_ledger', {
  actionId: varchar('action_id', { length: 255 }).notNull().primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull(),
  amount: bigint('amount', { mode: 'number' }),
  type: actionTypeEnum('type').notNull(),
  game: varchar('game', { length: 255 }),
  gameId: varchar('game_id', { length: 255 }),
  originalActionId: varchar('original_action_id', { length: 255 }), // For rollbacks
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const balances = pgTable('balances', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  balance: bigint('balance', { mode: 'number' }).notNull().default(0),
}, (table) => ({
  balanceNonNegative: check('balance_non_negative', sql`balance >= 0`),
}));

export type ActionLedgerEntry = typeof actionsLedger.$inferSelect;
export type Balance = typeof balances.$inferSelect;
export type NewBalance = typeof balances.$inferInsert;

export type ActionLedgerBaseFields = {
  userId: string;
  currency: string;
  game?: string | null;
  gameId?: string | null;
};

export type NewBetActionLedgerEntry = ActionLedgerBaseFields & {
  type: 'bet';
  actionId: string;
  amount: number;
  originalActionId?: never;
};

export type NewWinActionLedgerEntry = ActionLedgerBaseFields & {
  type: 'win';
  actionId: string;
  amount: number;
  originalActionId?: never;
};

export type NewRollbackActionLedgerEntry = ActionLedgerBaseFields & {
  type: 'rollback';
  actionId: string;
  originalActionId: string;
  amount?: number | null;
};

export type NewActionLedgerEntry = NewBetActionLedgerEntry | NewWinActionLedgerEntry | NewRollbackActionLedgerEntry;
