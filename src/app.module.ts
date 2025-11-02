import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AggregatorModule } from './aggregator/aggregator.module';
import { DatabaseModule } from './database/database.module';
import { RepositoriesModule } from './database/repositories.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RepositoriesModule,
    AggregatorModule,
    HealthModule,
  ],
})
export class AppModule {}
