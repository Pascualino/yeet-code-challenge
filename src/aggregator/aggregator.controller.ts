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
import type { ProcessRequestDto } from './dto/process-request.dto';
import type { ProcessResponseDto } from './dto/process-response.dto';

@Controller('aggregator/takehome')
export class AggregatorController {
  constructor(private readonly usersRepository: UsersRepository) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  @UseGuards(HmacAuthGuard)
  async process(@Body() request: ProcessRequestDto): Promise<ProcessResponseDto> {
    const user = await this.usersRepository.createOrGetUser(request.user_id);

    return {
      balance: user.balance,
    };
  }
}

