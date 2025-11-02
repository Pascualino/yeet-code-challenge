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
    /**
     * Here's how this works:
     * 1. We apply idempotency to filter out the actions that have already been processed
     * 2. We calculate which rollback actions are applicable, which can be:
     * 2.1. Previous rollback actions that are now "activating" because the action they refer to is processed now
     * 2.2. Current rollback actions for past actions
     * 3. We calculate the balance delta based on every win and bet action processed now, plus any rollback (processed or "activated" now)
     * 4. We update the balance and ledger tables and return the result
     */
    return await this.db.transaction(async (tx) => {
      const { duplicatedPreviousActions, newActions } = await this.queryIdempotentActions(
        tx,
        actions,
      );
      
      const { applicableRollbackActions, rolledBackedActions } = await this.calculateApplyingRollbackActions(
        tx,
        newActions,
      );

      const balanceDelta = this.calculateBalanceDelta(
        newActions,
        applicableRollbackActions,
        rolledBackedActions,
      );
      
      const insertedActionsRecords = newActions.length > 0 ? await tx.insert(actionsLedger).values(newActions).returning() : [];
      const updatedBalanceRecord = await this.updateUserBalanceTransaction(
        tx,
        userId,
        balanceDelta,
      );
      
      return this.buildResponse(
        actions,
        duplicatedPreviousActions,
        insertedActionsRecords,
        updatedBalanceRecord,
      );
    });
  }

  private async queryIdempotentActions(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    actions: NewActionLedgerEntry[],
  ): Promise<{
    duplicatedPreviousActions: ActionLedgerEntry[];
    newActions: NewActionLedgerEntry[];
  }> {
    const duplicatedPreviousActions = await tx
            .select()
            .from(actionsLedger)
            .where(inArray(actionsLedger.actionId, actions.map((a) => a.actionId)));

    return {
      duplicatedPreviousActions,
      newActions: actions.filter(
        (a) => !duplicatedPreviousActions.some((b) => b.actionId === a.actionId),
      ),
    };
  }

  private async calculateApplyingRollbackActions(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    newActions: NewActionLedgerEntry[],
  ): Promise<{ applicableRollbackActions: Array<ActionLedgerEntry | NewActionLedgerEntry>; rolledBackedActions: Array<ActionLedgerEntry | NewActionLedgerEntry> }> {
    // Previous rollback actions are "activated" when the action they refer to is processed
    // And they basically cancel each other. I think the code is cleaner and easier thinking 
    // about it that way.
    const previousRollbacksActions = await tx
            .select()
            .from(actionsLedger)
            .where(inArray(actionsLedger.originalActionId, newActions.map((a) => a.actionId)));
    
    const currentRollbacksActions = newActions.filter((a) => a.type === 'rollback');
    const previousActionsGettingRolledBack = await tx
            .select()
            .from(actionsLedger)
            .where(inArray(actionsLedger.actionId, currentRollbacksActions.map((a) => a.originalActionId!)));

    const applicableRollbackActions = [...previousRollbacksActions, ...currentRollbacksActions];
    const rolledBackedActions = [...previousActionsGettingRolledBack, ...newActions.filter((a) => applicableRollbackActions.some((b) => b.originalActionId === a.actionId))];

    return {
      applicableRollbackActions,
      rolledBackedActions,
    };
  }


  private calculateBalanceDelta(
    newActions: NewActionLedgerEntry[],
    applicableRollbackActions: Array<ActionLedgerEntry | NewActionLedgerEntry>,
    rolledBackedActions: Array<ActionLedgerEntry | NewActionLedgerEntry>,
  ): number {
    let balanceDelta = 0;
    for (const action of applicableRollbackActions) {
      const originalAction = rolledBackedActions.find((a) => a.actionId === action.originalActionId);
      if (originalAction) {
        balanceDelta += originalAction.type === 'bet' ? originalAction.amount! : -originalAction.amount!;
      }
    }
    for (const action of newActions) {
      if (action.type === 'bet') {
        balanceDelta -= action.amount!;
      } else if (action.type === 'win') {
        balanceDelta += action.amount!;
      }
    }
    return balanceDelta;
  }

  private buildResponse(
    requestedActions: NewActionLedgerEntry[],
    duplicatedPreviousActions: ActionLedgerEntry[],
    insertedActionsRecords: ActionLedgerEntry[],
    updatedBalanceRecord: Balance[],
  ): { actions: ActionLedgerEntry[]; balance: Balance } {
    const allActions = requestedActions.map((requestedAction) => {
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

