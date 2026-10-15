import { BadRequestException, Injectable } from '@nestjs/common';
import { CopyStatus, LoanStatus, MemberType, Prisma } from '@prisma/client';
import {
  LIBRARY_UTC_OFFSET_MINUTES,
  overdueCutoff,
  overdueDays,
  rangeEnd,
  rangeStart,
} from '../../common/date.util';
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
  held: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
  ) {}

  /**
   * FR-REPORT-01: sách mượn nhiều nhất trong khoảng thời gian.
   * Gộp trong SQL (trước đây kéo toàn bộ phiếu mượn về Node rồi đếm). `to` dạng ngày
   * ("2026-12-31") bao trọn cả ngày đó theo giờ thư viện; đồng hạng xếp theo id sách cho ổn định.
   */
  async topBooks(query: TopBooksQueryDto): Promise<TopBookRow[]> {
    const from = query.from ? rangeStart(query.from) : undefined;
    const to = query.to ? rangeEnd(query.to) : undefined;
    // IsDateString chỉ kiểm dạng chuỗi: "2026-02-31" qua được nhưng không phải ngày thật
    if ((from && isNaN(from.getTime())) || (to && isNaN(to.getTime())))
      throw new BadRequestException('from / to không phải ngày hợp lệ');
    const rows = await this.prisma.$queryRaw<
      { bookId: number; loanCount: number }[]
    >`
      SELECT c.book_id AS "bookId", COUNT(*)::int AS "loanCount"
      FROM loans l
      JOIN book_copies c ON c.id = l.copy_id
      WHERE TRUE
        ${from ? Prisma.sql`AND l.borrowed_at >= ${from}` : Prisma.empty}
        ${to ? Prisma.sql`AND l.borrowed_at < ${to}` : Prisma.empty}
      GROUP BY c.book_id
      ORDER BY COUNT(*) DESC, c.book_id ASC
      LIMIT ${query.limit}`;
    if (rows.length === 0) return [];

    const books = await this.prisma.book.findMany({
      where: { id: { in: rows.map((r) => r.bookId) } },
      select: { id: true, title: true, coverUrl: true },
    });
    const byId = new Map(books.map((b) => [b.id, b]));
    return rows
      .filter((r) => byId.has(r.bookId))
      .map((r) => ({ book: byId.get(r.bookId)!, loanCount: r.loanCount }));
  }

  /** FR-REPORT-02: bạn đọc đang quá hạn + tiền phạt ước tính đến hôm nay (BR-09). */
  async overdueReaders(at: Date = new Date()): Promise<OverdueRow[]> {
    const loans = await this.prisma.loan.findMany({
      where: { status: LoanStatus.ACTIVE, dueAt: { lt: overdueCutoff(at) } },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            memberCode: true,
            memberType: true,
          },
        },
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
      const finePerDay =
        policies.get(loan.user.memberType ?? MemberType.STUDENT) ?? 0;
      return {
        loanId: loan.id,
        user: {
          id: loan.user.id,
          fullName: loan.user.fullName,
          memberCode: loan.user.memberCode,
        },
        book: loan.copy.book,
        dueAt: loan.dueAt,
        overdueDays: days,
        estimatedFine: days * finePerDay,
      };
    });
  }

  /**
   * FR-REPORT-03: lượt mượn theo tháng, N tháng gần nhất (kể cả tháng không có lượt nào).
   * Tháng tính theo giờ thư viện (UTC+7): phiếu mượn lúc 02:00 sáng ngày 1 thuộc tháng mới,
   * dù theo UTC vẫn là cuối tháng trước.
   */
  async loansByMonth(
    months: number,
    at: Date = new Date(),
    offsetMinutes: number = LIBRARY_UTC_OFFSET_MINUTES,
  ): Promise<MonthCount[]> {
    const local = new Date(at.getTime() + offsetMinutes * 60_000);
    const startLocal = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth() - (months - 1),
      1,
    );
    const start = new Date(startLocal - offsetMinutes * 60_000);
    const rows = await this.prisma.$queryRaw<
      { month: string; count: number }[]
    >`
      SELECT to_char(date_trunc('month', borrowed_at + make_interval(mins => ${offsetMinutes}::int)), 'YYYY-MM') AS month,
             COUNT(*)::int AS count
      FROM loans
      WHERE borrowed_at >= ${start}
      GROUP BY 1`;
    const counts = new Map<string, number>();
    for (let i = 0; i < months; i++) {
      const d = new Date(startLocal);
      d.setUTCMonth(d.getUTCMonth() + i);
      counts.set(
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        0,
      );
    }
    for (const r of rows) if (counts.has(r.month)) counts.set(r.month, r.count);
    return [...counts.entries()].map(([month, count]) => ({ month, count }));
  }

  /** FR-REPORT-04: tồn kho theo thể loại, đếm từ trạng thái bản sao (gộp trong SQL). */
  async inventoryByCategory(): Promise<InventoryRow[]> {
    const [categories, groups] = await Promise.all([
      this.prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.$queryRaw<
        { categoryId: number; status: CopyStatus; n: number }[]
      >`
        SELECT b.category_id AS "categoryId", c.status::text AS status, COUNT(*)::int AS n
        FROM book_copies c
        JOIN books b ON b.id = c.book_id
        GROUP BY b.category_id, c.status`,
    ]);
    const rows = new Map<number, InventoryRow>();
    for (const c of categories) {
      rows.set(c.id, {
        category: c,
        total: 0,
        available: 0,
        borrowed: 0,
        lost: 0,
        maintenance: 0,
        held: 0,
      });
    }
    for (const g of groups) {
      const row = rows.get(g.categoryId);
      if (!row) continue;
      row.total += g.n;
      if (g.status === CopyStatus.AVAILABLE) row.available += g.n;
      else if (g.status === CopyStatus.BORROWED) row.borrowed += g.n;
      else if (g.status === CopyStatus.LOST) row.lost += g.n;
      else if (g.status === CopyStatus.MAINTENANCE) row.maintenance += g.n;
      else if (g.status === CopyStatus.HELD) row.held += g.n;
    }
    return [...rows.values()].filter((r) => r.total > 0);
  }
}
