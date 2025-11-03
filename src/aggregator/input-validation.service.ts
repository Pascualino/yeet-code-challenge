import { Injectable, BadRequestException } from '@nestjs/common';
import type { ProcessRequestDto } from './dto/process-request.dto';
import type { RtpRequestDto } from './dto/rtp-request.dto';

@Injectable()
export class InputValidationService {
  validateProcessRequest(request: ProcessRequestDto): void {
    if (!request.user_id || typeof request.user_id !== 'string' || request.user_id.trim().length === 0) {
      throw new BadRequestException('Invalid user_id: must be a non-empty string');
    }

    if (!request.currency || typeof request.currency !== 'string' || request.currency.trim().length === 0) {
      throw new BadRequestException('Invalid currency: must be a non-empty string');
    }

    if (!request.game || typeof request.game !== 'string' || request.game.trim().length === 0) {
      throw new BadRequestException('Invalid game: must be a non-empty string');
    }

    if (request.game_id !== undefined && (typeof request.game_id !== 'string' || request.game_id.trim().length === 0)) {
      throw new BadRequestException('Invalid game_id: must be a non-empty string if provided');
    }

    if (request.finished !== undefined && typeof request.finished !== 'boolean') {
      throw new BadRequestException('Invalid finished: must be a boolean if provided');
    }

    if (request.actions !== undefined) {
      if (!Array.isArray(request.actions)) {
        throw new BadRequestException('Invalid actions: must be an array if provided');
      }

      for (let i = 0; i < request.actions.length; i++) {
        this.validateAction(request.actions[i], i);
      }
    }
  }

  validateRtpRequest(query: RtpRequestDto): { from: Date; to: Date; page: number; limit: number } {
    if (!query.from || typeof query.from !== 'string' || query.from.trim().length === 0) {
      throw new BadRequestException('Missing or invalid "from" query parameter');
    }

    if (!query.to || typeof query.to !== 'string' || query.to.trim().length === 0) {
      throw new BadRequestException('Missing or invalid "to" query parameter');
    }

    const from = new Date(query.from);
    const to = new Date(query.to);

    if (isNaN(from.getTime())) {
      throw new BadRequestException('Invalid "from" date format');
    }

    if (isNaN(to.getTime())) {
      throw new BadRequestException('Invalid "to" date format');
    }

    if (from > to) {
      throw new BadRequestException('"from" date must be before or equal to "to" date');
    }

    const page = query.page ? parseInt(query.page) : 1;
    const limit = query.limit ? parseInt(query.limit) : 100;

    if (isNaN(page) || page < 1) {
      throw new BadRequestException('Invalid "page" parameter: must be a positive integer');
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid "limit" parameter: must be higher than 1 and lower than 100');
    }

    return { from, to, page, limit };
  }

  validateUserId(userId: string): void {
    // TODO: We'd have some real ID restrictions here in a real app
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new BadRequestException('Invalid user_id parameter');
    }
  }

  private validateAction(action: any, index: number): void {
    if (!action || typeof action !== 'object') {
      throw new BadRequestException(`Invalid action at index ${index}: must be an object`);
    }

    if (!action.action || typeof action.action !== 'string') {
      throw new BadRequestException(`Invalid action at index ${index}: missing or invalid 'action' field`);
    }

    if (!action.action_id || typeof action.action_id !== 'string' || action.action_id.trim().length === 0) {
      throw new BadRequestException(`Invalid action at index ${index}: missing or invalid 'action_id' field`);
    }

    if (action.action === 'bet' || action.action === 'win') {
      if (typeof action.amount !== 'number' || action.amount < 0 || !Number.isFinite(action.amount)) {
        throw new BadRequestException(`Invalid action at index ${index}: ${action.action} actions require a non-negative number for 'amount'`);
      }
      if (action.original_action_id !== undefined) {
        throw new BadRequestException(`Invalid action at index ${index}: ${action.action} actions should not have 'original_action_id'`);
      }
    } else if (action.action === 'rollback') {
      if (!action.original_action_id || typeof action.original_action_id !== 'string' || action.original_action_id.trim().length === 0) {
        throw new BadRequestException(`Invalid action at index ${index}: rollback actions require a non-empty string for 'original_action_id'`);
      }
      if (action.amount !== undefined) {
        throw new BadRequestException(`Invalid action at index ${index}: rollback actions should not have 'amount'`);
      }
    } else {
      throw new BadRequestException(`Invalid action at index ${index}: unknown action type '${action.action}'. Must be one of: 'bet', 'win', 'rollback'`);
    }
  }
}

