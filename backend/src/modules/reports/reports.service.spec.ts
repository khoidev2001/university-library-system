import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CopyStatus, LoanStatus, MemberType } from '@prisma/client';
import { overdueCutoff } from '../../common/date.util';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { PoliciesService } from '../policies/policies.service';
import { TopBooksQueryDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

const NOW = new Date('2026-10-05T09:00:00.000Z');

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: PrismaMock;
  const policies = { getFor: jest.fn() };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PoliciesService, useValue: policies },
      ],
    }).compile();
    service = moduleRef.get(ReportsService);
    jest.clearAllMocks();
    policies.getFor.mockImplementation(async (t: MemberType) => ({
      finePerDay: t === MemberType.LECTURER ? 5000 : 5000,
    }));
  });

  describe('topBooks', () => {
    it('ranks the SQL aggregate and keeps its order, enriched with book data', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { bookId: 1, loanCount: 3 },
        { bookId: 2, loanCount: 2 },
      ]);
      prisma.book.findMany.mockResolvedValue([
        { id: 2, title: 'B', coverUrl: null },
        { id: 1, title: 'A', coverUrl: null },
      ]);

      const rows = await service.topBooks(
        Object.assign(new TopBooksQueryDto(), { limit: 2 }),
      );

      expect(rows).toEqual([
        { book: { id: 1, title: 'A', coverUrl: null }, loanCount: 3 },
        { book: { id: 2, title: 'B', coverUrl: null }, loanCount: 2 },
      ]);
    });

    it('returns [] with no loans and rejects dates that are not real days', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const rows = await service.topBooks(
        Object.assign(new TopBooksQueryDto(), {
          from: '2026-01-01',
          to: '2026-06-30',
        }),
      );
      expect(rows).toEqual([]);
      expect(prisma.book.findMany).not.toHaveBeenCalled();

      await expect(
        service.topBooks(
          Object.assign(new TopBooksQueryDto(), { from: '2026-02-31' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('overdueReaders computes days late and the estimated fine', async () => {
    prisma.loan.findMany.mockResolvedValue([
      {
        id: 5,
        dueAt: new Date('2026-10-02T09:00:00.000Z'),
        user: {
          id: 7,
          fullName: 'SV',
          memberCode: 'SV001',
          memberType: MemberType.STUDENT,
        },
        copy: { book: { id: 3, title: 'T' } },
      },
    ]);

    const rows = await service.overdueReaders(NOW);

    expect(prisma.loan.findMany.mock.calls[0][0].where).toMatchObject({
      status: LoanStatus.ACTIVE,
      dueAt: { lt: overdueCutoff(NOW) },
    });
    expect(rows[0]).toMatchObject({
      loanId: 5,
      overdueDays: 3,
      estimatedFine: 15000,
    });
  });

  it('loansByMonth keeps empty months at 0 and fills the SQL counts', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { month: '2026-10', count: 2 },
      { month: '2026-08', count: 1 },
      { month: '2025-01', count: 9 }, // ngoài cửa sổ: bỏ
    ]);

    const rows = await service.loansByMonth(3, NOW);

    expect(rows).toEqual([
      { month: '2026-08', count: 1 },
      { month: '2026-09', count: 0 },
      { month: '2026-10', count: 2 },
    ]);
  });

  it('inventoryByCategory counts copies per status and drops empty categories', async () => {
    prisma.category.findMany.mockResolvedValue([
      { id: 1, name: 'Fantasy' },
      { id: 2, name: 'Trống' },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      { categoryId: 1, status: CopyStatus.AVAILABLE, n: 1 },
      { categoryId: 1, status: CopyStatus.BORROWED, n: 1 },
      { categoryId: 1, status: CopyStatus.LOST, n: 1 },
      { categoryId: 1, status: CopyStatus.MAINTENANCE, n: 1 },
    ]);

    const rows = await service.inventoryByCategory();

    expect(rows).toEqual([
      {
        category: { id: 1, name: 'Fantasy' },
        total: 4,
        available: 1,
        borrowed: 1,
        lost: 1,
        maintenance: 1,
        held: 0,
      },
    ]);
  });
});
