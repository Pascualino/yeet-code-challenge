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
}

