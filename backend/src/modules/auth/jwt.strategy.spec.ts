import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemberType, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

function strategyFor(user: object | null) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
  } as unknown as PrismaService;
  return new JwtStrategy(new ConfigService({ JWT_SECRET: 's' }), prisma);
}

const base = {
  id: 1,
  role: Role.READER,
  memberType: MemberType.STUDENT,
  isActive: true,
  mustChangePassword: false,
  sessionsRevokedAt: null,
};
const payload = (iat?: number) => ({
  sub: 1,
  role: Role.READER,
  memberType: MemberType.STUDENT,
  iat,
});

describe('JwtStrategy session revocation', () => {
  const revokedAt = new Date('2026-10-16T10:00:00.500Z');
  const revokedSec = Math.floor(revokedAt.getTime() / 1000);

  it('rejects a token issued before the password was reset', async () => {
    const s = strategyFor({ ...base, sessionsRevokedAt: revokedAt });
    await expect(s.validate(payload(revokedSec - 1))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts a token issued in the same second or later (login right after the reset)', async () => {
    const s = strategyFor({ ...base, sessionsRevokedAt: revokedAt });
    await expect(s.validate(payload(revokedSec))).resolves.toMatchObject({
      id: 1,
    });
    await expect(s.validate(payload(revokedSec + 5))).resolves.toMatchObject({
      id: 1,
    });
  });

  it('is unaffected when nothing was ever revoked', async () => {
    await expect(strategyFor(base).validate(payload(1))).resolves.toMatchObject(
      { id: 1 },
    );
  });

  it('exposes mustChangePassword on the request user', async () => {
    const s = strategyFor({ ...base, mustChangePassword: true });
    await expect(s.validate(payload(1))).resolves.toMatchObject({
      mustChangePassword: true,
    });
  });

  it('still rejects locked or missing accounts', async () => {
    await expect(
      strategyFor({ ...base, isActive: false }).validate(payload(1)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(strategyFor(null).validate(payload(1))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
