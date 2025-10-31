import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AggregatorModule } from './aggregator/aggregator.module';
import { DatabaseModule } from './database/database.module';
import { RepositoriesModule } from './database/repositories.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RepositoriesModule,
    AggregatorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
