import { Injectable } from '@nestjs/common';
import { CopyStatus, LoanStatus, MemberType } from '@prisma/client';
import { overdueCutoff, overdueDays } from '../../common/date.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PoliciesService } from '../policies/policies.service';
import { TopBooksQueryDto } from './dto/reports.dto';

export interface TopBookRow {
  book: { id: number; title: string; coverUrl: string | null };
  loanCount: number;
}

export interface OverdueRow {
  loanId: number;
  user: { id: number; fullName: string; memberCode: string | null };
  book: { id: number; title: string };
  dueAt: Date;
  overdueDays: number;
  estimatedFine: number;
}

export interface MonthCount {
  month: string; // YYYY-MM
  count: number;
}

export interface InventoryRow {
  category: { id: number; name: string };
  total: number;
  available: number;
  borrowed: number;
  lost: number;
  maintenance: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
  ) {}

  /** FR-REPORT-01: sách mượn nhiều nhất trong khoảng thời gian. */
  async topBooks(query: TopBooksQueryDto): Promise<TopBookRow[]> {
    const loans = await this.prisma.loan.findMany({
      where: {
        borrowedAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      },
      select: { copy: { select: { bookId: true } } },
    });
    const counts = new Map<number, number>();
    for (const loan of loans) counts.set(loan.copy.bookId, (counts.get(loan.copy.bookId) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, query.limit);
    if (top.length === 0) return [];

    const books = await this.prisma.book.findMany({
      where: { id: { in: top.map(([bookId]) => bookId) } },
      select: { id: true, title: true, coverUrl: true },
    });
    const byId = new Map(books.map((b) => [b.id, b]));
    return top
      .filter(([bookId]) => byId.has(bookId))
      .map(([bookId, loanCount]) => ({ book: byId.get(bookId)!, loanCount }));
  }

  /** FR-REPORT-02: bạn đọc đang quá hạn + tiền phạt ước tính đến hôm nay (BR-09). */
  async overdueReaders(at: Date = new Date()): Promise<OverdueRow[]> {
    const loans = await this.prisma.loan.findMany({
      where: { status: LoanStatus.ACTIVE, dueAt: { lt: overdueCutoff(at) } },
      include: {
        user: { select: { id: true, fullName: true, memberCode: true, memberType: true } },
        copy: { include: { book: { select: { id: true, title: true } } } },
      },
      orderBy: { dueAt: 'asc' },
    });
    const policies = new Map<MemberType, number>();
    for (const type of [MemberType.STUDENT, MemberType.LECTURER]) {
      policies.set(type, (await this.policies.getFor(type)).finePerDay);
    }
    return loans.map((loan) => {
      const days = overdueDays(loan.dueAt, at);
      const finePerDay = policies.get(loan.user.memberType ?? MemberType.STUDENT) ?? 0;
      return {
        loanId: loan.id,
        user: { id: loan.user.id, fullName: loan.user.fullName, memberCode: loan.user.memberCode },
        book: loan.copy.book,
        dueAt: loan.dueAt,
        overdueDays: days,
        estimatedFine: days * finePerDay,
      };
    });
  }

  /** FR-REPORT-03: lượt mượn theo tháng, N tháng gần nhất (kể cả tháng không có lượt nào). */
  async loansByMonth(months: number, at: Date = new Date()): Promise<MonthCount[]> {
    const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - (months - 1), 1));
    const loans = await this.prisma.loan.findMany({
      where: { borrowedAt: { gte: start } },
      select: { borrowedAt: true },
    });
    const counts = new Map<string, number>();
    for (let i = 0; i < months; i++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      counts.set(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, 0);
    }
    for (const loan of loans) {
      const key = `${loan.borrowedAt.getUTCFullYear()}-${String(loan.borrowedAt.getUTCMonth() + 1).padStart(2, '0')}`;
      if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
    }
    return [...counts.entries()].map(([month, count]) => ({ month, count }));
  }

  /** FR-REPORT-04: tồn kho theo thể loại, đếm từ trạng thái bản sao. */
  async inventoryByCategory(): Promise<InventoryRow[]> {
    const [categories, copies] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.bookCopy.findMany({ select: { status: true, book: { select: { categoryId: true } } } }),
    ]);
    const rows = new Map<number, InventoryRow>();
    for (const c of categories) {
      rows.set(c.id, { category: c, total: 0, available: 0, borrowed: 0, lost: 0, maintenance: 0 });
    }
    for (const copy of copies) {
      const row = rows.get(copy.book.categoryId);
      if (!row) continue;
      row.total++;
      if (copy.status === CopyStatus.AVAILABLE) row.available++;
      else if (copy.status === CopyStatus.BORROWED) row.borrowed++;
      else if (copy.status === CopyStatus.LOST) row.lost++;
      else if (copy.status === CopyStatus.MAINTENANCE) row.maintenance++;
    }
    return [...rows.values()].filter((r) => r.total > 0);
  }
}
