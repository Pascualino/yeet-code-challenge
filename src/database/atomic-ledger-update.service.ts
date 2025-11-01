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
      
      const { existingActionIds, rolledBackActionIds, originalActionsMap, existingActionsMap } =
        await this.gatherPreviousRelevantTransactions(
          tx,
          actions,
        );

      const rollbackActions = actions.filter((a) => a.type === 'rollback');
      // Check for in-batch pre-rollbacks (rollback and original in same request)
      for (const rollbackAction of rollbackActions) {
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

      const currentBalance = currentBalanceResult[0]?.balance ?? 0;

      const balanceDelta = this.calculateBalanceDelta(
        newActions,
        rolledBackActionIds,
        originalActionsMap,
      );

      const insertedActions = newActions.length > 0 ? await tx.insert(actionsLedger).values(newActions).returning() : [];

      const updatedBalance = await this.updateUserBalanceTransaction(
        tx,
        userId,
        currentBalanceResult[0],
        currentBalance + balanceDelta,
      );

      const allActions = actions.map((requestedAction) => {
        const existing = existingActionsMap.get(requestedAction.actionId);
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

  // Get all relevant previous actions in a single tx:
  // 1. Actions with same actionIds as new ones (for idempotency)
  // 2. Rollbacks with originalActionId matching new bet/win actionIds (for pre-rollback detection)
  // 3. Bet/win actions with actionId matching rollback originalActionIds (for rollback reversal)
  private async gatherPreviousRelevantTransactions(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    actions: NewActionLedgerEntry[],
  ): Promise<{
    existingActionIds: Set<string>;
    rolledBackActionIds: Set<string>;
    originalActionsMap: Map<string, ActionLedgerEntry>;
    existingActionsMap: Map<string, ActionLedgerEntry>;
  }> {
    const actionIds = actions.map((a) => a.actionId);
    const newBetWinActions = actions.filter(
      (a) => a.type === 'bet' || a.type === 'win',
    );
    const newBetWinActionIds = newBetWinActions.map((a) => a.actionId);
    const rollbackActions = actions.filter((a) => a.type === 'rollback');
    const rollbackOriginalIds = rollbackActions
      .map((a) => a.originalActionId)
      .filter((id): id is string => id !== null && id !== undefined);


    const relevantIds = [
      ...actionIds,
      ...rollbackOriginalIds,
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
    const existingActionsMap = new Map(
      relevantPreviousActions
        .filter((a) => actionIds.includes(a.actionId))
        .map((a) => [a.actionId, a]),
    );
    const existingActionIds = new Set(existingActionsMap.keys());
    const rolledBackActionIds = new Set(
      relevantPreviousActions
        .filter((a) => a.type === 'rollback')
        .map((a) => a.originalActionId!)
    );
    const originalActionsMap = new Map(
      relevantPreviousActions
        .filter((a) => rollbackOriginalIds.includes(a.actionId))
        .map((a) => [a.actionId, a]),
    );

    return {
      existingActionIds,
      rolledBackActionIds,
      originalActionsMap,
      existingActionsMap,
    };
  }

  private calculateBalanceDelta(
    newActions: NewActionLedgerEntry[],
    rolledBackActionIds: Set<string>,
    originalActionsMap: Map<string, ActionLedgerEntry>,
  ): number {
    return newActions.reduce((total, action) => {
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
  }

  private async updateUserBalanceTransaction(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    userId: string,
    currentBalanceRecord: Balance | undefined,
    newBalance: number,
  ): Promise<Balance[]> {
    if (newBalance < 0) {
      throw new InsufficientFundsException();
    }

    if (currentBalanceRecord) {
      return await tx
        .update(balances)
        .set({ balance: newBalance })
        .where(eq(balances.userId, userId))
        .returning();
    } else {
      return await tx
        .insert(balances)
        .values({ userId, balance: newBalance })
        .returning();
    }
  }
}

