import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { HmacAuthGuard } from './hmac-auth.guard';

@Controller('aggregator/takehome')
export class AggregatorController {
  @Post('process')
  @HttpCode(HttpStatus.OK)
  @UseGuards(HmacAuthGuard)
  async process(@Body() body: any) {
    // For now, return an empty OK response
    return {};
  }
}

