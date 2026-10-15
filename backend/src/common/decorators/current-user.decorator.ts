import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, MemberType } from '@prisma/client';

export interface JwtUser {
  id: number;
  role: Role;
  memberType: MemberType | null;
  /** Đang dùng mật khẩu tạm: MustChangePasswordGuard chỉ cho gọi vài API cho tới khi đổi. */
  mustChangePassword?: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    return ctx.switchToHttp().getRequest().user as JwtUser;
  },
);
