import { Module } from '@nestjs/common';
import { AggregatorController } from './aggregator.controller';

@Module({
  controllers: [AggregatorController],
})
export class AggregatorModule {}

