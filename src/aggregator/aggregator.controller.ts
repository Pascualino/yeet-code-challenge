import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { HmacAuthGuard } from './hmac-auth.guard';
import { UsersRepository } from '../database/users.repository';

@Controller('aggregator/takehome')
export class AggregatorController {
  constructor(private readonly usersRepository: UsersRepository) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  @UseGuards(HmacAuthGuard)
  async process(@Body() body: any) {
    // Get or create user
    const user = await this.usersRepository.createOrGetUser(
      body.user_id || '8|USDT|USD',
    );

    // For now, return the user's balance
    return {
      balance: user.balance,
      user_id: user.userId,
    };
  }
}

