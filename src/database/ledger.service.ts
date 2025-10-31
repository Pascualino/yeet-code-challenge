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
      const insertedActions = await tx
        .insert(actionsLedger)
        .values(actions)
        .returning();

      const updatedBalance = await tx
        .insert(balances)
        .values({ userId, balance: balanceDelta })
        .onConflictDoUpdate({
          target: balances.userId,
          set: { balance: sql`${balances.balance} + ${balanceDelta}` },
        })
        .returning();

      return {
        actions: insertedActions,
        balance: updatedBalance[0],
      };
    });
  }
}

