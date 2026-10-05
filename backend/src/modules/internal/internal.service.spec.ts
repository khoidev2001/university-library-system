import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { LoanStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { InternalKeyGuard } from './internal-key.guard';
import { InternalService } from './internal.service';

describe('InternalService.trainingData', () => {
  let service: InternalService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        InternalService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(InternalService);

    prisma.book.findMany.mockResolvedValue([
      {
        id: 1,
        title: 'Dune',
        description: 'Sand',
        category: { name: 'Sci-Fi' },
        authors: [
          { author: { name: 'Herbert' } },
          { author: { name: 'Anderson' } },
        ],
      },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 7, memberType: 'STUDENT' }]);
    prisma.rating.findMany.mockResolvedValue([
      { userId: 7, bookId: 1, score: 5 },
    ]);
  });

  it('flattens authors and keeps the category name', async () => {
    prisma.loan.findMany.mockResolvedValue([]);
    const data = await service.trainingData();
    expect(data.books[0]).toEqual({
      id: 1,
      title: 'Dune',
      authors: 'Herbert, Anderson',
      category: 'Sci-Fi',
      description: 'Sand',
    });
    expect(data.users).toEqual([{ id: 7, memberType: 'STUDENT' }]);
  });

  it('emits one interaction per loan and per rating, as ISO strings', async () => {
    prisma.loan.findMany.mockResolvedValue([
      {
        userId: 7,
        borrowedAt: new Date('2026-09-01T00:00:00.000Z'),
        dueAt: new Date('2026-09-15T00:00:00.000Z'),
        returnedAt: new Date('2026-09-14T00:00:00.000Z'),
        status: LoanStatus.RETURNED,
        copy: { bookId: 1, book: { categoryId: 3 } },
      },
    ]);

    const data = await service.trainingData();

    expect(data.interactions).toHaveLength(2);
    const loan = data.interactions.find((i) => i.type === 'LOAN')!;
    expect(loan).toMatchObject({
      userId: 7,
      bookId: 1,
      categoryId: 3,
      returnedAt: '2026-09-14T00:00:00.000Z',
    });
    const rating = data.interactions.find((i) => i.type === 'RATING')!;
    expect(rating).toMatchObject({
      userId: 7,
      bookId: 1,
      score: 5,
      borrowedAt: null,
    });
  });

  it('a LOST loan is never reported as returned (nhãn trả đúng hạn sẽ sai)', async () => {
    prisma.loan.findMany.mockResolvedValue([
      {
        userId: 7,
        borrowedAt: new Date('2026-09-01T00:00:00.000Z'),
        dueAt: new Date('2026-09-15T00:00:00.000Z'),
        returnedAt: new Date('2026-09-20T00:00:00.000Z'),
        status: LoanStatus.LOST,
        copy: { bookId: 1, book: { categoryId: 3 } },
      },
    ]);

    const loan = (await service.trainingData()).interactions.find(
      (i) => i.type === 'LOAN',
    )!;
    expect(loan.returnedAt).toBeNull();
  });
});

describe('InternalKeyGuard', () => {
  function context(header?: string): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ header: () => header }) }),
    } as unknown as ExecutionContext;
  }

  function guard(configured?: string): InternalKeyGuard {
    return new InternalKeyGuard({
      get: () => configured,
    } as unknown as ConfigService);
  }

  it('accepts the configured key only', () => {
    expect(guard('secret').canActivate(context('secret'))).toBe(true);
    expect(() => guard('secret').canActivate(context('wrong'))).toThrow(
      UnauthorizedException,
    );
    expect(() => guard('secret').canActivate(context(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('refuses everything when no key is configured', () => {
    expect(() => guard(undefined).canActivate(context('anything'))).toThrow(
      UnauthorizedException,
    );
  });
});
