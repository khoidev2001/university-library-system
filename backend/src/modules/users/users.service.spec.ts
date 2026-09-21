import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { QueryUsersDto } from './dto/users.dto';
import { UsersService } from './users.service';

const reader = {
  id: 3,
  email: 'r@b.vn',
  passwordHash: 'h',
  fullName: 'R',
  role: Role.READER,
  isActive: true,
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('findAll searches name/email/code and strips password hashes', async () => {
    prisma.user.findMany.mockResolvedValue([reader]);
    prisma.user.count.mockResolvedValue(1);
    const query = Object.assign(new QueryUsersDto(), {
      q: 'r',
      page: 2,
      limit: 10,
    });

    const page = await service.findAll(query);

    expect(page).toEqual({
      items: [expect.not.objectContaining({ passwordHash: 'h' })],
      total: 1,
      page: 2,
      limit: 10,
    });
    const args = prisma.user.findMany.mock.calls[0][0];
    expect(args.skip).toBe(10);
    expect(args.where.OR).toHaveLength(3);
  });

  it('findOne aggregates active loans, overdue loans and unpaid fines', async () => {
    prisma.user.findUnique.mockResolvedValue(reader);
    prisma.loan.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    prisma.fine.aggregate.mockResolvedValue({ _sum: { amount: 15000 } });

    const detail = await service.findOne(3);

    expect(detail).toMatchObject({
      id: 3,
      activeLoans: 2,
      overdueLoans: 1,
      unpaidFines: 15000,
    });
    expect(detail).not.toHaveProperty('passwordHash');
  });

  it('findOne treats no fines as 0 and unknown user as 404', async () => {
    prisma.user.findUnique.mockResolvedValue(reader);
    prisma.loan.count.mockResolvedValue(0);
    prisma.fine.aggregate.mockResolvedValue({ _sum: { amount: null } });
    expect((await service.findOne(3)).unpaidFines).toBe(0);

    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update locks a card and refuses memberType on staff accounts', async () => {
    prisma.user.findUnique.mockResolvedValue(reader);
    prisma.user.update.mockResolvedValue({ ...reader, isActive: false });
    expect((await service.update(3, { isActive: false })).isActive).toBe(false);

    prisma.user.findUnique.mockResolvedValue({
      ...reader,
      role: Role.LIBRARIAN,
    });
    await expect(
      service.update(3, { memberType: 'LECTURER' }),
    ).rejects.toMatchObject({ code: 'NOT_A_READER' });
  });

  it('createStaff hashes the password and rejects duplicate emails', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }) => ({
      id: 7,
      isActive: true,
      createdAt: new Date(),
      memberType: null,
      memberCode: null,
      ...data,
    }));
    const created = await service.createStaff({
      email: 'l@b.vn',
      password: 'Secret123',
      fullName: 'L',
      role: Role.LIBRARIAN,
    });
    expect(created).toMatchObject({ id: 7, role: Role.LIBRARIAN });
    expect(prisma.user.create.mock.calls[0][0].data.passwordHash).not.toBe(
      'Secret123',
    );

    prisma.user.findUnique.mockResolvedValue({ id: 1 });
    await expect(
      service.createStaff({
        email: 'l@b.vn',
        password: 'Secret123',
        fullName: 'L',
        role: Role.ADMIN,
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
  });
});
