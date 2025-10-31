import { HttpException, HttpStatus } from '@nestjs/common';

export class InsufficientFundsException extends HttpException {
  constructor() {
    super(
      {
        code: 100,
        message: 'Player has not enough funds to process an action',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

