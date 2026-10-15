import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator';
import { JwtUser } from '../decorators/current-user.decorator';
import { BusinessException } from '../exceptions/business.exception';

/**
 * Chạy sau JwtAuthGuard. Tài khoản đang dùng mật khẩu tạm chỉ được xem hồ sơ và đổi mật khẩu,
 * để việc "bắt đổi mật khẩu" không phụ thuộc vào giao diện. Route công khai (không có user) bỏ qua.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as
      JwtUser | undefined;
    if (!user?.mustChangePassword) return true;
    const allowed = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOW_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) return true;
    throw new BusinessException(
      'PASSWORD_CHANGE_REQUIRED',
      'Bạn đang dùng mật khẩu tạm, hãy đổi mật khẩu trước khi tiếp tục',
      HttpStatus.FORBIDDEN,
    );
  }
}
