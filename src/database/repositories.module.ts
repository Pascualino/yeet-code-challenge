import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { LedgerService } from './ledger.service';

@Module({
  imports: [DatabaseModule],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class RepositoriesModule {}

