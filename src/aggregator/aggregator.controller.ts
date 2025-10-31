import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { HmacAuthGuard } from './hmac-auth.guard';
import { LedgerService } from '../database/ledger.service';
import type { ProcessRequestDto } from './dto/process-request.dto';
import type { ProcessResponseDto } from './dto/process-response.dto';

@Controller('aggregator/takehome')
export class AggregatorController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  @UseGuards(HmacAuthGuard)
  async process(@Body() request: ProcessRequestDto): Promise<ProcessResponseDto> {
    const balance = await this.ledgerService.getCurrentBalance(request.user_id);

    return {
      balance,
    };
  }
}

