import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { LedgerService } from './ledger.service';
import { AtomicLedgerUpdateService } from './atomic-ledger-update.service';

@Module({
  imports: [DatabaseModule],
  providers: [LedgerService, AtomicLedgerUpdateService],
  exports: [LedgerService],
})
export class RepositoriesModule {}

