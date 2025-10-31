import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
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

      // Separate new actions from existing ones
      const newActions = actions.filter(
        (a) => !existingActionIds.has(a.actionId),
      );

      // Calculate balance delta only for new actions
      const newActionsDelta = newActions.reduce((total, action) => {
        if (action.type === 'bet') {
          return total - action.amount!;
        } else if (action.type === 'win') {
          return total + action.amount!;
        }
        // TODO: Handle rollback
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
}

