import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from './jwt-auth.guard';
import { hasRole, RolesGuard } from './roles.guard';

function context(user?: { role: Role }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('hasRole', () => {
  it('allows an exact role match', () => {
    expect(hasRole(Role.READER, [Role.READER])).toBe(true);
    expect(hasRole(Role.LIBRARIAN, [Role.LIBRARIAN])).toBe(true);
  });

  it('lets ADMIN act as LIBRARIAN but not as READER', () => {
    expect(hasRole(Role.ADMIN, [Role.LIBRARIAN])).toBe(true);
    expect(hasRole(Role.ADMIN, [Role.READER])).toBe(false);
  });

  it('never promotes LIBRARIAN or READER', () => {
    expect(hasRole(Role.LIBRARIAN, [Role.ADMIN])).toBe(false);
    expect(hasRole(Role.READER, [Role.LIBRARIAN])).toBe(false);
  });
});

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector & {
    getAllAndOverride: jest.Mock;
  };
  const guard = new RolesGuard(reflector);

  it('passes routes without @Roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(context({ role: Role.READER }))).toBe(true);
  });

  it('checks the user role against @Roles and rejects anonymous requests', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.LIBRARIAN]);
    expect(guard.canActivate(context({ role: Role.ADMIN }))).toBe(true);
    expect(guard.canActivate(context({ role: Role.READER }))).toBe(false);
    expect(guard.canActivate(context(undefined))).toBe(false);
  });
});

describe('JwtAuthGuard', () => {
  it('short-circuits @Public routes and defers others to passport', () => {
    const reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector & { getAllAndOverride: jest.Mock };
    const guard = new JwtAuthGuard(reflector);
    const superSpy = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true as never);

    reflector.getAllAndOverride.mockReturnValue(true);
    expect(guard.canActivate(context())).toBe(true);
    expect(superSpy).not.toHaveBeenCalled();

    reflector.getAllAndOverride.mockReturnValue(false);
    guard.canActivate(context());
    expect(superSpy).toHaveBeenCalledTimes(1);
    superSpy.mockRestore();
  });
});
