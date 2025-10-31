import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AggregatorModule } from './aggregator/aggregator.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AggregatorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
