import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class HmacAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new ForbiddenException('Missing Authorization header');
    }

    const matches = authHeader.match(/^HMAC-SHA256\s+(.+)$/);
    if (!matches) {
      throw new ForbiddenException('Invalid Authorization header format');
    }
    const providedSignature = matches[1];

    const secret = this.configService.get<string>('HMAC_SECRET');
    if (!secret) {
      throw new Error('HMAC_SECRET is not configured');
    }
    
    const body = JSON.stringify(request.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex');

    if (providedSignature !== expectedSignature) {
      throw new ForbiddenException('Invalid HMAC signature');
    }

    return true;
  }
}

