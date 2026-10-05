import { HttpStatus, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LoanStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { RatingsService } from './ratings.service';

describe('RatingsService', () => {
  let service: RatingsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [RatingsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(RatingsService);
  });

  it('BR-11: upserts a score for a book the reader returned', async () => {
    prisma.book.findUnique.mockResolvedValue({ id: 3 });
    prisma.loan.count.mockResolvedValue(1);
    prisma.rating.upsert.mockImplementation(async ({ create }) => ({ id: 1, ...create }));

    const rating = await service.rate(7, 3, 5);

    expect(rating).toMatchObject({ userId: 7, bookId: 3, score: 5 });
    expect(prisma.loan.count.mock.calls[0][0].where).toEqual({ userId: 7, status: LoanStatus.RETURNED, copy: { bookId: 3 } });
    expect(prisma.rating.upsert.mock.calls[0][0]).toMatchObject({
      where: { userId_bookId: { userId: 7, bookId: 3 } },
      update: { score: 5 },
    });
  });

  it('BR-11: 403 NOT_BORROWED when the reader never returned that book', async () => {
    prisma.book.findUnique.mockResolvedValue({ id: 3 });
    prisma.loan.count.mockResolvedValue(0);
    await expect(service.rate(7, 3, 4)).rejects.toMatchObject({ code: 'NOT_BORROWED', status: HttpStatus.FORBIDDEN });
    expect(prisma.rating.upsert).not.toHaveBeenCalled();
  });

  it('404s an unknown book', async () => {
    prisma.book.findUnique.mockResolvedValue(null);
    await expect(service.rate(7, 99, 4)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('summary returns the average and the count', async () => {
    prisma.rating.aggregate.mockResolvedValue({ _avg: { score: 4.25 }, _count: 8 });
    expect(await service.summary(3)).toEqual({ avg: 4.25, count: 8 });
  });
});
