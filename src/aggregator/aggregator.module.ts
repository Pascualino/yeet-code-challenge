import { Module } from '@nestjs/common';
import { AggregatorController } from './aggregator.controller';
import { HmacAuthGuard } from './hmac-auth.guard';

@Module({
  controllers: [AggregatorController],
  providers: [HmacAuthGuard],
})
export class AggregatorModule {}

