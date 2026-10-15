import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AllowWhenPasswordChangeRequired } from '../decorators/allow-password-change.decorator';
import { MustChangePasswordGuard } from './must-change-password.guard';

class Sample {
  @AllowWhenPasswordChangeRequired()
  allowed() {}
  blocked() {}
}

function context(
  handler: () => void,
  user: object | undefined,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Sample,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('MustChangePasswordGuard', () => {
  const guard = new MustChangePasswordGuard(new Reflector());
  const flagged = {
    id: 1,
    role: Role.READER,
    memberType: null,
    mustChangePassword: true,
  };
  const normal = { ...flagged, mustChangePassword: false };
  const sample = new Sample();

  it('lets a normal user through everywhere', () => {
    expect(guard.canActivate(context(sample.blocked, normal))).toBe(true);
  });

  it('lets public routes (no user) through', () => {
    expect(guard.canActivate(context(sample.blocked, undefined))).toBe(true);
  });

  it('blocks a user on a temporary password with 403 PASSWORD_CHANGE_REQUIRED', () => {
    expect.assertions(2);
    try {
      guard.canActivate(context(sample.blocked, flagged));
    } catch (err) {
      expect((err as { code: string }).code).toBe('PASSWORD_CHANGE_REQUIRED');
      expect((err as { getStatus(): number }).getStatus()).toBe(403);
    }
  });

  it('still allows the whitelisted handlers', () => {
    expect(guard.canActivate(context(sample.allowed, flagged))).toBe(true);
  });
});
