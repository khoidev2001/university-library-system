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
    it('ranks by loan count and respects the limit', async () => {
      prisma.loan.findMany.mockResolvedValue([
        { copy: { bookId: 1 } },
        { copy: { bookId: 1 } },
        { copy: { bookId: 2 } },
        { copy: { bookId: 1 } },
        { copy: { bookId: 2 } },
        { copy: { bookId: 3 } },
      ]);
      prisma.book.findMany.mockResolvedValue([
        { id: 1, title: 'A', coverUrl: null },
        { id: 2, title: 'B', coverUrl: null },
      ]);

      const rows = await service.topBooks(
        Object.assign(new TopBooksQueryDto(), { limit: 2 }),
      );

      expect(rows).toEqual([
        { book: { id: 1, title: 'A', coverUrl: null }, loanCount: 3 },
        { book: { id: 2, title: 'B', coverUrl: null }, loanCount: 2 },
      ]);
    });

    it('passes the date range through and returns [] with no loans', async () => {
      prisma.loan.findMany.mockResolvedValue([]);
      const rows = await service.topBooks(
        Object.assign(new TopBooksQueryDto(), {
          from: '2026-01-01',
          to: '2026-06-30',
        }),
      );
      expect(rows).toEqual([]);
      expect(prisma.loan.findMany.mock.calls[0][0].where.borrowedAt).toEqual({
        gte: new Date('2026-01-01'),
        lte: new Date('2026-06-30'),
      });
      expect(prisma.book.findMany).not.toHaveBeenCalled();
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

  it('loansByMonth keeps empty months at 0 and counts the rest', async () => {
    prisma.loan.findMany.mockResolvedValue([
      { borrowedAt: new Date('2026-10-01T00:00:00.000Z') },
      { borrowedAt: new Date('2026-10-04T00:00:00.000Z') },
      { borrowedAt: new Date('2026-08-15T00:00:00.000Z') },
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
    prisma.bookCopy.findMany.mockResolvedValue([
      { status: CopyStatus.AVAILABLE, book: { categoryId: 1 } },
      { status: CopyStatus.BORROWED, book: { categoryId: 1 } },
      { status: CopyStatus.LOST, book: { categoryId: 1 } },
      { status: CopyStatus.MAINTENANCE, book: { categoryId: 1 } },
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
