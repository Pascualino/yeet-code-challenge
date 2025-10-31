import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('aggregator/takehome')
export class AggregatorController {
  @Post('process')
  @HttpCode(HttpStatus.OK)
  async process(@Body() body: any) {
    // For now, return an empty OK response
    return {};
  }
}

