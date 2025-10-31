import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from './database.module';
import * as schema from './schema';
import { users, User, NewUser } from './schema';

@Injectable()
export class UsersRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  async findByUserId(userId: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    return result[0];
  }

  private async create(user: NewUser): Promise<User> {
    const result = await this.db.insert(users).values(user).returning();
    return result[0];
  }

  async createOrGetUser(userId: string): Promise<User> {
    const existingUser = await this.findByUserId(userId);
    
    if (existingUser) {
      return existingUser;
    }

    return this.create({ userId, balance: 0 });
  }
}

