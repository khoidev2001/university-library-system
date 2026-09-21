import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MemberType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { DEFAULT_POLICIES, PoliciesService } from './policies.service';

describe('PoliciesService', () => {
  let service: PoliciesService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PoliciesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(PoliciesService);
  });

  it('getFor falls back to the SRS defaults when the table has no row', async () => {
    prisma.loanPolicy.findUnique.mockResolvedValue(null);
    expect(await service.getFor(MemberType.STUDENT)).toEqual(
      DEFAULT_POLICIES.STUDENT,
    );
    expect(DEFAULT_POLICIES.STUDENT).toMatchObject({
      maxBooks: 3,
      loanDays: 14,
      renewLimit: 1,
      renewExtraDays: 7,
      finePerDay: 5000,
    });
    expect(DEFAULT_POLICIES.LECTURER).toMatchObject({
      maxBooks: 5,
      loanDays: 30,
      renewExtraDays: 14,
    });
  });

  it('getFor prefers the configured row', async () => {
    prisma.loanPolicy.findUnique.mockResolvedValue({
      id: 1,
      memberType: 'STUDENT',
      maxBooks: 4,
    });
    expect((await service.getFor(MemberType.STUDENT)).maxBooks).toBe(4);
  });

  it('update patches only the given fields, 404 when not configured', async () => {
    prisma.loanPolicy.findUnique.mockResolvedValue({
      id: 1,
      memberType: 'STUDENT',
    });
    prisma.loanPolicy.update.mockImplementation(async ({ data }) => ({
      id: 1,
      ...data,
    }));
    expect(
      await service.update(MemberType.STUDENT, { finePerDay: 7000 }),
    ).toEqual({ id: 1, finePerDay: 7000 });

    prisma.loanPolicy.findUnique.mockResolvedValue(null);
    await expect(
      service.update(MemberType.LECTURER, { maxBooks: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll lists policies ordered by member type', async () => {
    prisma.loanPolicy.findMany.mockResolvedValue([]);
    await service.findAll();
    expect(prisma.loanPolicy.findMany).toHaveBeenCalledWith({
      orderBy: { memberType: 'asc' },
    });
  });
});
