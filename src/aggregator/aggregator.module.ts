import { Module } from '@nestjs/common';
import { AggregatorController } from './aggregator.controller';
import { HmacAuthGuard } from './hmac-auth.guard';
import { InputValidationService } from './input-validation.service';
import { RepositoriesModule } from '../database/repositories.module';

@Module({
  imports: [RepositoriesModule],
  controllers: [AggregatorController],
  providers: [HmacAuthGuard, InputValidationService],
})
export class AggregatorModule {}

