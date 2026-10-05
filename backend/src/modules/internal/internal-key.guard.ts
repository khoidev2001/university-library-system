import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * NFR-SEC-08: endpoint nội bộ chỉ dành cho AI Service, xác thực bằng khoá chia sẻ
 * trong header X-Internal-Key (không dùng JWT vì đây là giao tiếp máy–máy).
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INTERNAL_API_KEY');
    if (!expected) throw new UnauthorizedException('INTERNAL_API_KEY chưa được cấu hình');
    const provided = context.switchToHttp().getRequest<Request>().header('x-internal-key');
    if (provided !== expected) throw new UnauthorizedException('X-Internal-Key không hợp lệ');
    return true;
  }
}
