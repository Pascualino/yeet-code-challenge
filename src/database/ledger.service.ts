import { Injectable, Inject } from '@nestjs/common';
import { eq, and, between, sql, ne, or, isNull, isNotNull, inArray } from 'drizzle-orm';
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
import { AtomicLedgerUpdateService } from './atomic-ledger-update.service';

@Injectable()
export class LedgerService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
    private atomicLedgerUpdate: AtomicLedgerUpdateService,
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

    return await this.atomicLedgerUpdate.execute(userId, actions);
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
          // Exclude initial balance transactions
          or(
            ne(actionsLedger.gameId, 'initial-balance'),
            isNull(actionsLedger.gameId),
          ),
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
        .where(
          and(
            between(actionsLedger.createdAt, from, to),
            // Exclude initial balance transactions
            or(
              ne(actionsLedger.gameId, 'initial-balance'),
              isNull(actionsLedger.gameId),
            ),
          ),
        )
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

  async getCasinoWideStats(
    from: Date,
    to: Date,
  ): Promise<{
    total_rounds: number;
    total_bet: number;
    total_win: number;
    total_rtp: number | null;
    total_rollback_bet: number;
    total_rollback_win: number;
  }> {
    const totalsResult = await this.db
      .select({
        total_rounds: sql<number>`CAST(COUNT(CASE WHEN ${actionsLedger.type} = 'bet' AND ${actionsLedger.amount} IS NOT NULL THEN 1 END) AS INTEGER)`,
        total_bet: sql<number>`COALESCE(SUM(CASE WHEN ${actionsLedger.type} = 'bet' THEN ${actionsLedger.amount} ELSE 0 END), 0)`,
        total_win: sql<number>`COALESCE(SUM(CASE WHEN ${actionsLedger.type} = 'win' THEN ${actionsLedger.amount} ELSE 0 END), 0)`,
      })
      .from(actionsLedger)
      .where(
        and(
          between(actionsLedger.createdAt, from, to),
          // Exclude initial balance transactions
          or(
            ne(actionsLedger.gameId, 'initial-balance'),
            isNull(actionsLedger.gameId),
          ),
        ),
      )
      .limit(1);

    const totals = totalsResult[0] || {
      total_rounds: 0,
      total_bet: 0,
      total_win: 0,
    };

    // Get rollback statistics: positive amounts = win rollbacks, negative amounts = bet rollbacks
    const rollbackStatsResult = await this.db
      .select({
        total_rollback_bet: sql<number>`COALESCE(SUM(CASE WHEN ${actionsLedger.amount} < 0 THEN ABS(${actionsLedger.amount}) ELSE 0 END), 0)`,
        total_rollback_win: sql<number>`COALESCE(SUM(CASE WHEN ${actionsLedger.amount} > 0 THEN ${actionsLedger.amount} ELSE 0 END), 0)`,
      })
      .from(actionsLedger)
      .where(
        and(
          eq(actionsLedger.type, 'rollback'),
          between(actionsLedger.createdAt, from, to),
          isNotNull(actionsLedger.amount),
          // Exclude initial balance transactions
          or(
            ne(actionsLedger.gameId, 'initial-balance'),
            isNull(actionsLedger.gameId),
          ),
        ),
      )
      .limit(1);

    const rollbackStats = rollbackStatsResult[0] || {
      total_rollback_bet: 0,
      total_rollback_win: 0,
    };

    const totalRollbackBet = Number(rollbackStats.total_rollback_bet);
    const totalRollbackWin = Number(rollbackStats.total_rollback_win);

    const totalBet = Number(totals.total_bet);
    const totalWin = Number(totals.total_win);
    const totalRtp = totalBet > 0 ? totalWin / totalBet : null;

    return {
      total_rounds: Number(totals.total_rounds),
      total_bet: totalBet,
      total_win: totalWin,
      total_rtp: totalRtp,
      total_rollback_bet: totalRollbackBet,
      total_rollback_win: totalRollbackWin,
    };
  }
}

