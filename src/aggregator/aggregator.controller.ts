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
import { InputValidationService } from './input-validation.service';
import type { ProcessRequestDto } from './dto/process-request.dto';
import type { ProcessResponseDto } from './dto/process-response.dto';
import type { RtpRequestDto } from './dto/rtp-request.dto';
import type { RtpResponseDto, UserRtpDto } from './dto/rtp-response.dto';

@Controller('aggregator/takehome')
export class AggregatorController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly inputValidationService: InputValidationService,
  ) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  @UseGuards(HmacAuthGuard)
  async process(@Body() request: ProcessRequestDto): Promise<ProcessResponseDto> {
    this.inputValidationService.validateProcessRequest(request);

    if (!request.actions || request.actions.length === 0) {
      const balance = await this.ledgerService.getCurrentBalance(
        request.user_id,
      );
      return { balance };
    }

    const ledgerActions = request.actions.map((action) => ({
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
        tx_id: action.actionId,
      })),
      balance: result.balance.balance,
    };
  }

  @Get('rtp')
  @HttpCode(HttpStatus.OK)
  async getCasinoWideRtpReport(@Query() query: RtpRequestDto): Promise<RtpResponseDto> {
    const { from, to, page, limit } = this.inputValidationService.validateRtpRequest(query);

    const [rtpResult, stats] = await Promise.all([
      this.ledgerService.getCasinoWideRtp(from, to, page, limit),
      this.ledgerService.getCasinoWideStats(from, to),
    ]);

    const totalPages = Math.ceil(rtpResult.total / limit);

    return {
      data: rtpResult.data,
      global_stats: stats,
      pagination: {
        page,
        limit,
        total: rtpResult.total,
        total_pages: totalPages,
      },
    };
  }

  @Get('rtp/:user_id')
  @HttpCode(HttpStatus.OK)
  async getUserRtpReport(
    @Param('user_id') userId: string,
    @Query() query: RtpRequestDto,
  ): Promise<UserRtpDto> {
    this.inputValidationService.validateUserId(userId);
    const { from, to } = this.inputValidationService.validateRtpRequest(query);

    return await this.ledgerService.getUserRtp(userId, from, to);
  }
}

