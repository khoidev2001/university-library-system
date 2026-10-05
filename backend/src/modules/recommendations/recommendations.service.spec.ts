import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { AiClient, AiUnavailableError } from '../ai/ai.client';
import { RecommendationsService } from './recommendations.service';

const books = [
  {
    id: 10,
    title: 'A',
    coverUrl: null,
    category: { id: 1, name: 'Fantasy' },
    authors: [{ author: { name: 'X' } }],
    copies: [{ id: 1 }],
  },
  {
    id: 11,
    title: 'B',
    coverUrl: null,
    category: { id: 1, name: 'Fantasy' },
    authors: [{ author: { name: 'Y' } }],
    copies: [],
  },
];

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let prisma: PrismaMock;
  const ai = {
    recommend: jest.fn(),
    train: jest.fn(),
    metrics: jest.fn(),
    predictOverdue: jest.fn(),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiClient, useValue: ai },
      ],
    }).compile();
    service = moduleRef.get(RecommendationsService);
    jest.clearAllMocks();
    prisma.book.findMany.mockResolvedValue(books);
  });

  it('keeps the model order and reports available copies', async () => {
    prisma.loan.findMany.mockResolvedValue([]);
    ai.recommend.mockResolvedValue([11, 10]);

    const result = await service.forUser(7, 2);

    expect(result.source).toBe('MODEL');
    expect(result.items.map((i) => i.id)).toEqual([11, 10]);
    expect(result.items[0]).toMatchObject({
      title: 'B',
      copiesAvailable: 0,
      authors: ['Y'],
    });
    expect(result.items[1].copiesAvailable).toBe(1);
  });

  it('FR-AI-03: drops books the reader already borrowed', async () => {
    prisma.loan.findMany.mockResolvedValue([{ copy: { bookId: 11 } }]);
    ai.recommend.mockResolvedValue([11, 10]);

    const result = await service.forUser(7, 2);

    expect(result.items.map((i) => i.id)).toEqual([10]);
    expect(ai.recommend).toHaveBeenCalledWith(7, 3); // xin dư để bù phần bị loại
  });

  it('FR-AI-02: falls back to popular books when the AI service is down', async () => {
    prisma.loan.findMany.mockResolvedValue([]);
    ai.recommend.mockRejectedValue(new AiUnavailableError('ECONNREFUSED'));
    prisma.loan.groupBy.mockResolvedValue([
      { copyId: 1, _count: { _all: 9 } },
      { copyId: 2, _count: { _all: 4 } },
    ]);
    prisma.bookCopy.findMany.mockResolvedValue([
      { id: 1, bookId: 10 },
      { id: 2, bookId: 11 },
    ]);

    const result = await service.forUser(7, 2);

    expect(result.source).toBe('POPULAR');
    expect(result.reason).toBe('AI_UNAVAILABLE_OR_COLD_START');
    expect(result.items.map((i) => i.id)).toEqual([10, 11]);
  });

  it('falls back when the model returns nothing, and reports NONE when there is no data at all', async () => {
    prisma.loan.findMany.mockResolvedValue([]);
    ai.recommend.mockResolvedValue([]);
    prisma.loan.groupBy.mockResolvedValue([{ copyId: 1, _count: { _all: 2 } }]);
    prisma.bookCopy.findMany.mockResolvedValue([{ id: 1, bookId: 10 }]);
    expect((await service.forUser(7, 5)).source).toBe('POPULAR');

    prisma.loan.groupBy.mockResolvedValue([]);
    prisma.bookCopy.findMany.mockResolvedValue([]);
    const empty = await service.forUser(7, 5);
    expect(empty).toMatchObject({
      items: [],
      source: 'NONE',
      reason: 'NO_DATA',
    });
  });

  it('popular books never include ones the reader already borrowed', async () => {
    prisma.loan.findMany.mockResolvedValue([{ copy: { bookId: 10 } }]);
    ai.recommend.mockRejectedValue(new AiUnavailableError('down'));
    prisma.loan.groupBy.mockResolvedValue([
      { copyId: 1, _count: { _all: 9 } },
      { copyId: 2, _count: { _all: 4 } },
    ]);
    prisma.bookCopy.findMany.mockResolvedValue([
      { id: 1, bookId: 10 },
      { id: 2, bookId: 11 },
    ]);

    const result = await service.forUser(7, 5);
    expect(result.items.map((i) => i.id)).toEqual([11]);
  });

  it('SDD 5.8: train and metrics surface 503 AI_UNAVAILABLE instead of 500', async () => {
    ai.train.mockRejectedValue(new AiUnavailableError('fetch failed'));
    await expect(service.train()).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });

    ai.metrics.mockRejectedValue(new AiUnavailableError('fetch failed'));
    await expect(service.metrics()).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    });

    ai.train.mockResolvedValue(undefined);
    expect(await service.train()).toEqual({ status: 'started' });
  });

  it('overdueAccuracy compares stored predictions with what actually happened', async () => {
    prisma.loan.findMany.mockResolvedValue([
      {
        predictedOverdueRisk: 0.8,
        dueAt: new Date('2026-10-01'),
        returnedAt: new Date('2026-10-04'),
      }, // dự báo cao, trễ thật
      {
        predictedOverdueRisk: 0.7,
        dueAt: new Date('2026-10-01'),
        returnedAt: new Date('2026-09-30'),
      }, // dự báo cao, trả sớm
      {
        predictedOverdueRisk: 0.1,
        dueAt: new Date('2026-10-01'),
        returnedAt: new Date('2026-10-05'),
      }, // dự báo thấp
    ]);

    expect(await service.overdueAccuracy()).toEqual({
      sampled: 3,
      predictedHigh: 2,
      actuallyLate: 1,
      hitRate: 0.5,
    });
  });

  it('overdueAccuracy reports null hit rate with no high-risk sample', async () => {
    prisma.loan.findMany.mockResolvedValue([]);
    expect(await service.overdueAccuracy()).toMatchObject({
      sampled: 0,
      hitRate: null,
    });
  });
});
