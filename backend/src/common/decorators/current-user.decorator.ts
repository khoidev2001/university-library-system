import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, MemberType } from '@prisma/client';

export interface JwtUser {
  id: number;
  role: Role;
  memberType: MemberType | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    return ctx.switchToHttp().getRequest().user as JwtUser;
  },
);
