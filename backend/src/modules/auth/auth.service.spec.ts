import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { MemberType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { AuthService } from './auth.service';

const registerDto = {
  email: 'a@b.vn',
  password: 'Secret123',
  fullName: 'Nguyễn A',
  memberType: MemberType.STUDENT,
  memberCode: 'SV001',
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  const jwt = { sign: jest.fn().mockReturnValue('token') };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('creates a READER with a bcrypt hash and never returns the hash', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }) => ({
        id: 1,
        isActive: true,
        createdAt: new Date(),
        ...data,
      }));

      const result = await service.register(registerDto);

      const created = prisma.user.create.mock.calls[0][0].data;
      expect(created.role).toBe(Role.READER);
      expect(created.passwordHash).not.toBe(registerDto.password);
      expect(
        await bcrypt.compare(registerDto.password, created.passwordHash),
      ).toBe(true);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toMatchObject({
        id: 1,
        email: 'a@b.vn',
        role: Role.READER,
        memberCode: 'SV001',
      });
    });

    it('rejects a duplicate email with EMAIL_EXISTS', async () => {
      prisma.user.findUnique.mockImplementation(async ({ where }) =>
        where.email ? { id: 9 } : null,
      );
      await expect(service.register(registerDto)).rejects.toMatchObject({
        code: 'EMAIL_EXISTS',
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate member code with MEMBER_CODE_EXISTS', async () => {
      prisma.user.findUnique.mockImplementation(async ({ where }) =>
        where.memberCode ? { id: 9 } : null,
      );
      await expect(service.register(registerDto)).rejects.toMatchObject({
        code: 'MEMBER_CODE_EXISTS',
      });
    });
  });

  describe('login', () => {
    const stored = async (overrides = {}) => ({
      id: 5,
      email: 'a@b.vn',
      passwordHash: await bcrypt.hash('Secret123', 4),
      fullName: 'A',
      role: Role.READER,
      memberType: MemberType.STUDENT,
      memberCode: 'SV001',
      isActive: true,
      createdAt: new Date(),
      ...overrides,
    });

    it('returns a JWT and the safe user on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(await stored());
      const result = await service.login({
        email: 'a@b.vn',
        password: 'Secret123',
      });
      expect(result.accessToken).toBe('token');
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 5,
        role: Role.READER,
        memberType: MemberType.STUDENT,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('returns 401 INVALID_CREDENTIALS for a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(await stored());
      await expect(
        service.login({ email: 'a@b.vn', password: 'wrong' }),
      ).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('returns the same 401 for an unknown email (no user enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const err = await service
        .login({ email: 'nobody@b.vn', password: 'x' })
        .catch((e) => e);
      expect(err).toBeInstanceOf(BusinessException);
      expect(err.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 403 ACCOUNT_LOCKED for a locked account even with the right password', async () => {
      prisma.user.findUnique.mockResolvedValue(
        await stored({ isActive: false }),
      );
      await expect(
        service.login({ email: 'a@b.vn', password: 'Secret123' }),
      ).rejects.toMatchObject({
        code: 'ACCOUNT_LOCKED',
        status: HttpStatus.FORBIDDEN,
      });
    });
  });

  it('me returns the safe projection', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(
      await (async () => ({ id: 1, passwordHash: 'h', email: 'e' }))(),
    );
    const me = await service.me(1);
    expect(me).toEqual({ id: 1, email: 'e' });
  });
});
