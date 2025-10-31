import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from './database.module';
import * as schema from './schema';
import {
  balances
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
      .where(eq(balances.userId, userId))
      .limit(1);

    return result[0]?.balance ?? 0;
  }
}

