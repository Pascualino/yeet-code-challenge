import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { actionsLedger, balances } from './schema';

dotenv.config();

async function seed() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  const db = drizzle(pool);

  await db.insert(actionsLedger).values({
    id: randomUUID(),
    userId: '8|USDT|USD',
    currency: 'USD',
    amount: 74322001,
    type: 'win',
    actionId: 'seed-initial-win',
    gameId: 'initial-balance',
  });

  await db.insert(balances).values({
    userId: '8|USDT|USD',
    balance: 74322001,
  });

  await pool.end();
}

seed();

