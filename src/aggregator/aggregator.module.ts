import { Module } from '@nestjs/common';
import { AggregatorController } from './aggregator.controller';
import { HmacAuthGuard } from './hmac-auth.guard';
import { RepositoriesModule } from '../database/repositories.module';

@Module({
  imports: [RepositoriesModule],
  controllers: [AggregatorController],
  providers: [HmacAuthGuard],
})
export class AggregatorModule {}

