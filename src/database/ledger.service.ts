import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
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
    balanceDelta: number,
  ): Promise<{ actions: ActionLedgerEntry[]; balance: Balance }> {
    const userId = actions[0].userId;
    if (actions.some((action) => action.userId !== userId)) {
      throw new Error('All actions must belong to the same user');
    }

    return await this.db.transaction(async (tx) => {
      const currentBalanceResult = await tx
        .select()
        .from(balances)
        .where(eq(balances.userId, userId))
        .for('update');

      const currentBalance = currentBalanceResult[0]?.balance ?? 0;
      const newBalance = currentBalance + balanceDelta;

      if (newBalance < 0) {
        throw new InsufficientFundsException();
      }

      const insertedActions = await tx
        .insert(actionsLedger)
        .values(actions)
        .returning();

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

      return {
        actions: insertedActions,
        balance: updatedBalance[0],
      };
    });
  }
}

