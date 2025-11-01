import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray, and, between, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from './database.module';
import * as schema from './schema';
import {
  actionsLedger,
  balances,
  ActionLedgerEntry,
  NewActionLedgerEntry,
  Balance,
} from './schema';
import { InsufficientFundsException } from 'src/aggregator/exceptions/insufficient-funds.exception';

@Injectable()
export class LedgerService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  async getCurrentBalance(userId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(balances)
      .where(eq(balances.userId, userId));

    return result[0]?.balance ?? 0;
  }

  async performActions(
    actions: NewActionLedgerEntry[],
  ): Promise<{ actions: ActionLedgerEntry[]; balance: Balance }> {
    const userId = actions[0].userId;
    if (actions.some((action) => action.userId !== userId)) {
      throw new Error('All actions must belong to the same user');
    }

    return await this.db.transaction(async (tx) => {
      const actionIds = actions.map((a) => a.actionId);
      const existingActions = await tx
              .select()
              .from(actionsLedger)
              .where(inArray(actionsLedger.actionId, actionIds));
      const existingActionIds = new Set(
        existingActions.map((a) => a.actionId),
      );

      // Separate new actions from existing ones (for idempotency)
      const newActions = actions.filter(
        (a) => !existingActionIds.has(a.actionId),
      );

      // Check for pre-rollbacks: find rollbacks that reference bet/win actions we're processing
      const betWinActions = newActions.filter(
        (a) => a.type === 'bet' || a.type === 'win',
      );
      const betWinActionIds = betWinActions.map((a) => a.actionId);
      
      // Check if any existing rollbacks reference these bet/win actions (pre-rollback scenario)
      const existingRollbacks = betWinActionIds.length > 0
        ? await tx
            .select()
            .from(actionsLedger)
            .where(
              and(
                eq(actionsLedger.type, 'rollback'),
                inArray(actionsLedger.originalActionId, betWinActionIds),
              ),
            )
        : [];

      // Create a set of action IDs that are already rolled back (pre-rollback)
      const rolledBackActionIds = new Set(
        existingRollbacks.map((r) => r.originalActionId).filter((id): id is string => id !== null),
      );

      // Check for in-batch pre-rollbacks: rollbacks in current batch that reference bet/win in same batch
      const rollbackActions = newActions.filter((a) => a.type === 'rollback');
      for (const rollbackAction of rollbackActions) {
        if (rollbackAction.originalActionId) {
          const originalInBatch = newActions.find(
            (a) => a.actionId === rollbackAction.originalActionId,
          );
          if (originalInBatch && (originalInBatch.type === 'bet' || originalInBatch.type === 'win')) {
            rolledBackActionIds.add(originalInBatch.actionId);
          }
        }
      }

      // Get all original actions referenced by rollbacks in this batch
      const rollbackOriginalIds = rollbackActions
        .map((a) => a.originalActionId)
        .filter((id): id is string => id !== null && id !== undefined);
      
      // Query database for original actions (from previous requests)
      const originalActionsFromDb =
        rollbackOriginalIds.length > 0
          ? await tx
              .select()
              .from(actionsLedger)
              .where(inArray(actionsLedger.actionId, rollbackOriginalIds))
          : [];

      // Create a map of original actions for quick lookup
      const originalActionsMap = new Map(
        originalActionsFromDb.map((a) => [a.actionId, a]),
      );

      // Also check in newActions for in-batch original actions (actions rolled back in same request)
      // Note: existingActions are already in the database, so they're handled above
      for (const action of newActions) {
        if (action.actionId && (action.type === 'bet' || action.type === 'win')) {
          if (rollbackOriginalIds.includes(action.actionId)) {
            // This is an in-batch rollback (rollback and original action in same request)
            // Add it to the map so the rollback can find it
            originalActionsMap.set(action.actionId, action as ActionLedgerEntry);
          }
        }
      }

      // Calculate balance delta for new actions
      const newActionsDelta = newActions.reduce((total, action) => {
        if (action.type === 'rollback') {
          // For rollback: find the original action
          if (!action.originalActionId) {
            return total; // Invalid rollback, skip
          }

          const originalAction = originalActionsMap.get(action.originalActionId);

          if (originalAction && originalAction.amount !== null && originalAction.amount !== undefined) {
            // Original action exists: reverse the balance change
            if (originalAction.type === 'bet') {
              return total + originalAction.amount; // Reverse bet: add back
            } else if (originalAction.type === 'win') {
              return total - originalAction.amount; // Reverse win: subtract
            }
          }
          // Original action doesn't exist yet (pre-rollback): no balance change
          // This means the rollback is waiting for the original action to arrive
          return total;
        } else if (action.type === 'bet') {
          // Check if this bet is already rolled back (pre-rollback scenario)
          if (rolledBackActionIds.has(action.actionId)) {
            return total; // Pre-rolled-back, don't change balance
          }
          return total - action.amount!;
        } else if (action.type === 'win') {
          // Check if this win is already rolled back (pre-rollback scenario)
          if (rolledBackActionIds.has(action.actionId)) {
            return total; // Pre-rolled-back, don't change balance
          }
          return total + action.amount!;
        }
        return total;
      }, 0);

      const currentBalanceResult = await tx
        .select()
        .from(balances)
        .where(eq(balances.userId, userId))
        .for('update');

      const currentBalance = currentBalanceResult[0]?.balance ?? 0;
      const newBalance = currentBalance + newActionsDelta;

      if (newBalance < 0) {
        throw new InsufficientFundsException();
      }

      const insertedActions = newActions.length > 0 ? await tx.insert(actionsLedger).values(newActions).returning() : [];

      const updatedBalance = currentBalanceResult[0]
      ? await tx
          .update(balances)
          .set({ balance: newBalance })
          .where(eq(balances.userId, userId))
          .returning()
      : await tx
          .insert(balances)
          .values({ userId, balance: newBalance })
          .returning();

      const allActions = actions.map((requestedAction) => {
        const existing = existingActions.find(
          (e) => e.actionId === requestedAction.actionId,
        );
        if (existing) {
          return existing;
        }
        return insertedActions.find(
          (i) => i.actionId === requestedAction.actionId,
        )!;
      });

      return {
        actions: allActions,
        balance: updatedBalance[0],
      };
    });
  }

  async getUserRtp(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<{
    user_id: string;
    currency: string;
    rounds: number;
    total_bet: number;
    total_win: number;
    rtp: number | null;
  }> {
    const result = await this.db
      .select({
        rounds: sql<number>`COUNT(CASE WHEN ${actionsLedger.type} = 'bet' AND ${actionsLedger.amount} IS NOT NULL THEN 1 END)`,
        total_bet: sql<number>`COALESCE(SUM(CASE WHEN ${actionsLedger.type} = 'bet' THEN ${actionsLedger.amount} ELSE 0 END), 0)`,
        total_win: sql<number>`COALESCE(SUM(CASE WHEN ${actionsLedger.type} = 'win' THEN ${actionsLedger.amount} ELSE 0 END), 0)`,
      })
      .from(actionsLedger)
      .where(
        and(
          eq(actionsLedger.userId, userId),
          between(actionsLedger.createdAt, from, to),
        ),
      )
      .limit(1);

    const stats = result[0];
    if (!stats) {
      return {
        user_id: userId,
        currency: 'USD',
        rounds: 0,
        total_bet: 0,
        total_win: 0,
        rtp: null,
      };
    }

    const rtp = stats.total_bet > 0 ? stats.total_win / stats.total_bet : null;

    return {
      user_id: userId,
      currency: 'USD',
      rounds: Number(stats.rounds),
      total_bet: Number(stats.total_bet),
      total_win: Number(stats.total_win),
      rtp,
    };
  }

  async getCasinoWideRtp(
    from: Date,
    to: Date,
  ): Promise<
    Array<{
      user_id: string;
      currency: string;
      rounds: number;
      total_bet: number;
      total_win: number;
      rtp: number | null;
    }>
  > {
      const results = await this.db
        .select({
          user_id: actionsLedger.userId,
          currency: actionsLedger.currency,
          rounds: sql<number>`CAST(COUNT(CASE WHEN ${actionsLedger.type} = 'bet' AND ${actionsLedger.amount} IS NOT NULL THEN 1 END) AS INTEGER)`,
          total_bet: sql<string>`COALESCE(SUM(CASE WHEN ${actionsLedger.type} = 'bet' THEN ${actionsLedger.amount} ELSE 0 END), 0)::text`,
          total_win: sql<string>`COALESCE(SUM(CASE WHEN ${actionsLedger.type} = 'win' THEN ${actionsLedger.amount} ELSE 0 END), 0)::text`,
        })
        .from(actionsLedger)
        .where(between(actionsLedger.createdAt, from, to))
        .groupBy(actionsLedger.userId, actionsLedger.currency);

    return results.map((row) => {
      const totalBet = Number(row.total_bet);
      const totalWin = Number(row.total_win);
      const rtp = totalBet > 0 ? totalWin / totalBet : null;

      return {
        user_id: row.user_id,
        currency: row.currency,
        rounds: row.rounds,
        total_bet: totalBet,
        total_win: totalWin,
        rtp,
      };
    });
  }
}

