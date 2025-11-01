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
      const { duplicatedPreviousActions, previousRollbacks } = await this.queryPreviousRelevantActions(
        tx,
        actions,
      );

      const { newActions, rolledBackActionIds, originalActionsMap } =
        this.prepareActionLookups(
          duplicatedPreviousActions,
          previousRollbacks,
          actions,
        );

      const balanceDelta = this.calculateBalanceDelta(
        newActions,
        rolledBackActionIds,
        originalActionsMap,
      );

      
      const insertedActionsRecords = newActions.length > 0 ? await tx.insert(actionsLedger).values(newActions).returning() : [];
      const updatedBalanceRecord = await this.updateUserBalanceTransaction(
        tx,
        userId,
        balanceDelta,
      );
      
      const allActions = actions.map((requestedAction) => {
        const existing = duplicatedPreviousActions.find(
          (a) => a.actionId === requestedAction.actionId,
        );
        if (existing) {
          return existing;
        }
        return insertedActionsRecords.find(
          (i) => i.actionId === requestedAction.actionId,
        )!;
      });

      return {
        actions: allActions,
        balance: updatedBalanceRecord[0],
      };
    });
  }

  // Query all relevant previous actions from database:
  // 1. Actions with same actionIds as new ones (for idempotency)
  // 2. Bet/win actions with actionId matching rollback originalActionIds (for rollback reversal)
  // 3. Rollbacks with originalActionId matching new bet/win actionIds (for pre-rollback detection)
  private async queryPreviousRelevantActions(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    actions: NewActionLedgerEntry[],
  ): Promise<{
    duplicatedPreviousActions: ActionLedgerEntry[];
    previousRollbacks: ActionLedgerEntry[];
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

    // Query duplicated actions (for idempotency) and original actions for rollback reversal
    const relevantIds = [
      ...actionIds,
      ...rollbackOriginalIds,
    ];
    
    const duplicatedPreviousActions =
      relevantIds.length > 0
        ? await tx
            .select()
            .from(actionsLedger)
            .where(inArray(actionsLedger.actionId, relevantIds))
        : [];

    // Query rollbacks that reference new bet/win actions (for pre-rollback detection)
    const previousRollbacks =
      newBetWinActionIds.length > 0
        ? await tx
            .select()
            .from(actionsLedger)
            .where(
              and(
                eq(actionsLedger.type, 'rollback'),
                inArray(actionsLedger.originalActionId, newBetWinActionIds),
              ),
            )
        : [];

    return {
      duplicatedPreviousActions,
      previousRollbacks,
    };
  }

  // Prepare lookup maps and determine which actions are new, rolled back, etc.
  private prepareActionLookups(
    existingActions: ActionLedgerEntry[],
    rollbacks: ActionLedgerEntry[],
    actions: NewActionLedgerEntry[],
  ): {
    newActions: NewActionLedgerEntry[];
    rolledBackActionIds: Set<string>;
    originalActionsMap: Map<string, ActionLedgerEntry>;
  } {
    const rollbackActions = actions.filter((a) => a.type === 'rollback');
    const rollbackOriginalIds = rollbackActions
      .map((a) => a.originalActionId)
      .filter((id): id is string => id !== null && id !== undefined);

    // Build lookup maps
    const existingActionIds = new Set(existingActions.map((a) => a.actionId));
    const rolledBackActionIds = new Set(
      rollbacks
        .filter((a) => a.originalActionId)
        .map((a) => a.originalActionId!)
        .filter((id): id is string => id !== null),
    );
    const originalActionsMap = new Map(
      existingActions
        .filter((a) => rollbackOriginalIds.includes(a.actionId))
        .map((a) => [a.actionId, a]),
    );

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
    
    return {
      newActions,
      rolledBackActionIds,
      originalActionsMap,
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
    balanceDelta: number,
  ): Promise<Balance[]> {
    const currentBalanceResult = await tx
    .select()
    .from(balances)
    .where(eq(balances.userId, userId))
    .for('update');
    const currentBalanceRecord = currentBalanceResult[0];
  
    const currentBalance = currentBalanceRecord?.balance ?? 0;
    const newBalance = currentBalance + balanceDelta;

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

