import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtUser } from '../decorators/current-user.decorator';

/** Quyền lồng nhau: ADMIN ⊃ LIBRARIAN. READER chỉ có quyền READER. */
export function hasRole(userRole: Role, allowed: Role[]): boolean {
  if (allowed.includes(userRole)) return true;
  return userRole === Role.ADMIN && allowed.includes(Role.LIBRARIAN);
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;
    const user = context.switchToHttp().getRequest().user as
      JwtUser | undefined;
    return !!user && hasRole(user.role, required);
  }
}
