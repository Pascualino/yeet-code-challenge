import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { HmacAuthGuard } from './hmac-auth.guard';
import { LedgerService } from '../database/ledger.service';
import type { ProcessRequestDto } from './dto/process-request.dto';
import type { ProcessResponseDto } from './dto/process-response.dto';
import type { RtpRequestDto } from './dto/rtp-request.dto';
import type { RtpResponseDto } from './dto/rtp-response.dto';

@Controller('aggregator/takehome')
export class AggregatorController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  @UseGuards(HmacAuthGuard)
  async process(@Body() request: ProcessRequestDto): Promise<ProcessResponseDto> {
    console.log("request", request);
    if (!request.actions || request.actions.length === 0) {
      const balance = await this.ledgerService.getCurrentBalance(
        request.user_id,
      );
      console.log("balance", balance);
      return { balance };
    }

    const ledgerActions = request.actions.map((action) => ({
      id: crypto.randomUUID(),
      userId: request.user_id,
      currency: request.currency,
      type: action.action,
      game: request.game,
      gameId: request.game_id,
      actionId: action.action_id,
      ...(action.action === 'rollback' ? { originalActionId: action.original_action_id } : {}),
      ...(action.action === 'bet' || action.action === 'win' ? { amount: action.amount } : {}),
    }));

    const result = await this.ledgerService.performActions(
      ledgerActions,
    );

    return {
      game_id: request.game_id!,
      transactions: result.actions.map((action) => ({
        action_id: action.actionId,
        tx_id: action.id,
      })),
      balance: result.balance.balance,
    };
  }

  @Get('rtp')
  @HttpCode(HttpStatus.OK)
  async getCasinoWideRtpReport(@Query() query: RtpRequestDto): Promise<RtpResponseDto> {
    // Mock response for casino-wide RTP
    return {
      data: [
        {
          user_id: '8|USDT|USD',
          currency: 'USD',
          rounds: 123456,
          total_bet: 123456789,
          total_win: 117283950,
          rtp: 0.9498,
        },
        {
          user_id: '42|BTC|USD',
          currency: 'USD',
          rounds: 98765,
          total_bet: 98765432,
          total_win: 95000000,
          rtp: 0.9619,
        },
        {
          user_id: '99|ETH|EUR',
          currency: 'EUR',
          rounds: 50000,
          total_bet: 50000000,
          total_win: 47500000,
          rtp: 0.95,
        },
      ],
    };
  }

  @Get('rtp/:user_id')
  @HttpCode(HttpStatus.OK)
  async getUserRtpReport(
    @Param('user_id') userId: string,
    @Query() query: RtpRequestDto,
  ): Promise<RtpResponseDto> {
    // Mock response for per-user RTP
    return {
      data: [
        {
          user_id: userId,
          currency: 'USD',
          rounds: 123456,
          total_bet: 123456789,
          total_win: 117283950,
          rtp: 0.9498,
        },
      ],
    };
  }
}

