import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray, and, or } from 'drizzle-orm';
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
export class AtomicLedgerUpdateService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  async execute(
    userId: string,
    actions: NewActionLedgerEntry[],
  ): Promise<{ actions: ActionLedgerEntry[]; balance: Balance }> {
    return await this.db.transaction(async (tx) => {
      const currentBalanceResult = await tx
        .select()
        .from(balances)
        .where(eq(balances.userId, userId))
        .for('update');

      const actionIds = actions.map((a) => a.actionId);
      
      const newBetWinActions = actions.filter(
        (a) => a.type === 'bet' || a.type === 'win',
      );
      const newRollbackActions = actions.filter((a) => a.type === 'rollback');
      
      const newBetWinActionIds = newBetWinActions.map((a) => a.actionId);
      const rollbackOriginalIds = newRollbackActions
        .map((a) => a.originalActionId)
        .filter((id): id is string => id !== null && id !== undefined);
      
      // Get all relevant previous actions:
      // 1. Actions with same actionIds as new ones (for idempotency)
      // 2. Rollbacks with originalActionId matching new bet/win actionIds (for pre-rollback detection)
      // 3. Bet/win actions with actionId matching rollback originalActionIds (for rollback reversal)
      const relevantIds = [
        ...actionIds, // For idempotency check
        ...rollbackOriginalIds, // For finding original actions to reverse
      ];
      
      const relevantPreviousActions =
        relevantIds.length > 0
          ? await tx
              .select()
              .from(actionsLedger)
              .where(
                or(
                  inArray(actionsLedger.actionId, relevantIds),
                  and(
                    eq(actionsLedger.type, 'rollback'),
                    inArray(actionsLedger.originalActionId, newBetWinActionIds),
                  ),
                ),
              )
          : [];

      // Build lookup maps
      const existingActionIds = new Set(
        relevantPreviousActions
          .filter((a) => actionIds.includes(a.actionId))
          .map((a) => a.actionId),
      );
      const rolledBackActionIds = new Set(
        relevantPreviousActions
          .filter((a) => a.type === 'rollback' && a.originalActionId)
          .map((a) => a.originalActionId)
          .filter((id): id is string => id !== null),
      );
      const originalActionsMap = new Map(
        relevantPreviousActions
          .filter((a) => rollbackOriginalIds.includes(a.actionId))
          .map((a) => [a.actionId, a]),
      );

      // Check for in-batch pre-rollbacks (rollback and original in same request)
      for (const rollbackAction of newRollbackActions) {
        if (rollbackAction.originalActionId) {
          const originalInBatch = actions.find(
            (a) => a.actionId === rollbackAction.originalActionId,
          );
          if (originalInBatch && (originalInBatch.type === 'bet' || originalInBatch.type === 'win')) {
            rolledBackActionIds.add(originalInBatch.actionId);
            originalActionsMap.set(originalInBatch.actionId, originalInBatch as ActionLedgerEntry);
          }
        }
      }

      // Separate new actions from existing ones (for idempotency)
      const newActions = actions.filter(
        (a) => !existingActionIds.has(a.actionId),
      );

      // Calculate balance delta for new actions
      const newActionsDelta = newActions.reduce((total, action) => {
        if (action.type === 'rollback') {
          const originalAction = originalActionsMap.get(action.originalActionId!);

          if (originalAction) {
            // Original action exists: reverse the balance change
            if (originalAction.type === 'bet') {
              return total + originalAction.amount!;
            } else if (originalAction.type === 'win') {
              return total - originalAction.amount!;
            }
          }
          // Original action doesn't exist yet (pre-rollback): no balance change
          // This means the rollback is waiting for the original action to arrive
          return total;
        } else if (action.type === 'bet') {
          // Check if this bet is already rolled back (pre-rollback scenario)
          if (rolledBackActionIds.has(action.actionId)) {
            return total;
          }
          return total - action.amount!;
        } else if (action.type === 'win') {
          // Check if this win is already rolled back (pre-rollback scenario)
          if (rolledBackActionIds.has(action.actionId)) {
            return total;
          }
          return total + action.amount!;
        }
        return total;
      }, 0);

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
        const existing = relevantPreviousActions.find(
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
}

