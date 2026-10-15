import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CopyStatus,
  FineType,
  LoanStatus,
  MemberType,
  Prisma,
} from '@prisma/client';
import {
  overdueCutoff,
  overdueDays,
  rangeEnd,
  rangeStart,
} from '../../common/date.util';
import { likePattern } from '../../common/sql.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PoliciesService } from '../policies/policies.service';
import { ReportsService } from '../reports/reports.service';
import { ExportColumn } from './export-sinks';
import {
  BooksExportQueryDto,
  FinesExportQueryDto,
  LoansExportQueryDto,
  ReadersExportQueryDto,
  TopBooksExportQueryDto,
} from './dto/exports.dto';

/** Một bộ dữ liệu xuất được: cột, tổng số dòng khớp và nguồn đọc theo lô. */
export interface Dataset<T> {
  /** Tên file (không đuôi), có dấu; Content-Disposition tự sinh bản ASCII. */
  title: string;
  sheetName: string;
  columns: ExportColumn<T>[];
  total: number;
  batches(): AsyncGenerator<T[]>;
}

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  ACTIVE: 'Đang mượn',
  RETURNED: 'Đã trả',
  LOST: 'Mất sách',
};
const FINE_TYPE_LABEL: Record<FineType, string> = {
  OVERDUE: 'Trả trễ',
  LOST: 'Mất sách',
};
const MEMBER_TYPE_LABEL: Record<MemberType, string> = {
  STUDENT: 'Sinh viên',
  LECTURER: 'Giảng viên',
};
const BATCH = 1000;

/**
 * Đọc theo lô bằng con trỏ (cursor) trên id thay vì OFFSET: mỗi lô tốn cùng một chi phí dù đang ở
 * dòng thứ 90.000, và không bao giờ giữ cả bảng trong bộ nhớ.
 */
async function* byCursor<T extends { id: number }>(
  fetch: (cursor: { id: number } | undefined, take: number) => Promise<T[]>,
): AsyncGenerator<T[]> {
  let cursor: { id: number } | undefined;
  for (;;) {
    const rows = await fetch(cursor, BATCH);
    if (rows.length === 0) return;
    yield rows;
    if (rows.length < BATCH) return;
    cursor = { id: rows[rows.length - 1].id };
  }
}

/** Khoảng ngày theo giờ thư viện; ném 400 khi ngày không có thật hoặc đảo ngược. */
export function parseDateRange(
  from?: string,
  to?: string,
): { gte?: Date; lt?: Date } {
  const gte = from ? rangeStart(from) : undefined;
  const lt = to ? rangeEnd(to) : undefined;
  if ((gte && isNaN(gte.getTime())) || (lt && isNaN(lt.getTime())))
    throw new BadRequestException('from / to không phải ngày hợp lệ');
  if (gte && lt && gte >= lt)
    throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
  return { gte, lt };
}

const loanSelect = {
  id: true,
  borrowedAt: true,
  dueAt: true,
  returnedAt: true,
  renewedCount: true,
  status: true,
  user: { select: { fullName: true, memberCode: true, memberType: true } },
  copy: {
    select: { barcode: true, book: { select: { title: true } } },
  },
} satisfies Prisma.LoanSelect;

type LoanRow = Prisma.LoanGetPayload<{ select: typeof loanSelect }>;

export interface OverdueExportRow {
  id: number;
  loan: LoanRow;
  overdueDays: number;
  estimatedFine: number;
}
export interface LoanExportRow {
  id: number;
  loan: LoanRow;
  overdueDays: number;
}
export interface TopBookExportRow {
  rank: number;
  bookId: number;
  title: string;
  authors: string;
  isbn: string | null;
  category: string;
  loanCount: number;
}
export interface InventoryExportRow {
  category: string;
  total: number;
  available: number;
  borrowed: number;
  held: number;
  maintenance: number;
  lost: number;
}
export interface FineExportRow {
  id: number;
  type: FineType;
  amount: number;
  createdAt: Date;
  paidAt: Date | null;
  paidTo: { fullName: string } | null;
  loan: {
    id: number;
    user: { fullName: string; memberCode: string | null };
    copy: { barcode: string; book: { title: string } };
  };
}
export interface ReaderExportRow {
  id: number;
  memberCode: string | null;
  fullName: string;
  email: string;
  memberType: MemberType | null;
  isActive: boolean;
  createdAt: Date;
  activeLoans: number;
  overdueLoans: number;
}
export interface BookExportRow {
  id: number;
  isbn: string | null;
  title: string;
  authors: string;
  category: string;
  publisher: string | null;
  publishedYear: number | null;
  price: number;
  copiesTotal: number;
  copiesAvailable: number;
}

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
    private readonly reports: ReportsService,
  ) {}

  async overdueLoans(
    now: Date = new Date(),
  ): Promise<Dataset<OverdueExportRow>> {
    const where: Prisma.LoanWhereInput = {
      status: LoanStatus.ACTIVE,
      dueAt: { lt: overdueCutoff(now) },
    };
    const finePerDay = new Map<MemberType, number>();
    for (const type of [MemberType.STUDENT, MemberType.LECTURER])
      finePerDay.set(type, (await this.policies.getFor(type)).finePerDay);

    return {
      title: 'Phiếu mượn quá hạn',
      sheetName: 'Quá hạn',
      total: await this.prisma.loan.count({ where }),
      columns: OVERDUE_COLUMNS,
      batches: () =>
        byCursor(async (cursor, take) => {
          const loans = await this.prisma.loan.findMany({
            where,
            take,
            ...(cursor && { cursor, skip: 1 }),
            // Quá hạn lâu nhất trước, giống báo cáo trên màn hình; id làm khoá phụ cho con trỏ ổn định
            orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
            select: loanSelect,
          });
          return loans.map((l) => {
            const days = overdueDays(l.dueAt, now);
            const rate =
              finePerDay.get(l.user.memberType ?? MemberType.STUDENT) ?? 0;
            return {
              id: l.id,
              loan: l,
              overdueDays: days,
              estimatedFine: days * rate,
            };
          });
        }),
    };
  }

  async loans(
    query: LoansExportQueryDto,
    now: Date = new Date(),
  ): Promise<Dataset<LoanExportRow>> {
    const range = parseDateRange(query.from, query.to);
    const where: Prisma.LoanWhereInput = {
      userId: query.userId,
      status: query.status,
      ...((range.gte || range.lt) && { borrowedAt: range }),
      ...(query.overdue && {
        status: LoanStatus.ACTIVE,
        dueAt: { lt: overdueCutoff(now) },
      }),
    };
    return {
      title: 'Phiếu mượn',
      sheetName: 'Phiếu mượn',
      total: await this.prisma.loan.count({ where }),
      columns: LOAN_COLUMNS,
      batches: () =>
        byCursor(async (cursor, take) => {
          const loans = await this.prisma.loan.findMany({
            where,
            take,
            ...(cursor && { cursor, skip: 1 }),
            orderBy: { id: 'asc' },
            select: loanSelect,
          });
          return loans.map((l) => ({
            id: l.id,
            loan: l,
            overdueDays:
              l.status === LoanStatus.ACTIVE ? overdueDays(l.dueAt, now) : 0,
          }));
        }),
    };
  }

  async topBooks(
    query: TopBooksExportQueryDto,
  ): Promise<Dataset<TopBookExportRow>> {
    parseDateRange(query.from, query.to);
    const top = await this.reports.topBooks({
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
    const details = top.length
      ? await this.prisma.book.findMany({
          where: { id: { in: top.map((t) => t.book.id) } },
          select: {
            id: true,
            isbn: true,
            category: { select: { name: true } },
            authors: { select: { author: { select: { name: true } } } },
          },
        })
      : [];
    const byId = new Map(details.map((d) => [d.id, d]));
    const rows: TopBookExportRow[] = top.map((t, i) => {
      const d = byId.get(t.book.id);
      return {
        rank: i + 1,
        bookId: t.book.id,
        title: t.book.title,
        authors: d?.authors.map((a) => a.author.name).join('; ') ?? '',
        isbn: d?.isbn ?? null,
        category: d?.category.name ?? '',
        loanCount: t.loanCount,
      };
    });
    return {
      title: 'Sách mượn nhiều nhất',
      sheetName: 'Top sách',
      total: rows.length,
      columns: TOP_BOOK_COLUMNS,
      // eslint-disable-next-line @typescript-eslint/require-await
      batches: async function* () {
        if (rows.length) yield rows;
      },
    };
  }

  async inventory(): Promise<Dataset<InventoryExportRow>> {
    const rows = await this.reports.inventoryByCategory();
    const mapped = rows.map((r) => ({
      category: r.category.name,
      total: r.total,
      available: r.available,
      borrowed: r.borrowed,
      held: r.held,
      maintenance: r.maintenance,
      lost: r.lost,
    }));
    return {
      title: 'Tồn kho theo thể loại',
      sheetName: 'Tồn kho',
      total: mapped.length,
      columns: INVENTORY_COLUMNS,
      // eslint-disable-next-line @typescript-eslint/require-await
      batches: async function* () {
        if (mapped.length) yield mapped;
      },
    };
  }

  async fines(query: FinesExportQueryDto): Promise<Dataset<FineExportRow>> {
    const range = parseDateRange(query.from, query.to);
    const where: Prisma.FineWhereInput = {
      ...(query.paid !== undefined &&
        (query.paid ? { paidAt: { not: null } } : { paidAt: null })),
      ...(query.userId && { loan: { userId: query.userId } }),
      ...((range.gte || range.lt) && { createdAt: range }),
    };
    return {
      title: 'Khoản phạt',
      sheetName: 'Khoản phạt',
      total: await this.prisma.fine.count({ where }),
      columns: FINE_COLUMNS,
      batches: () =>
        byCursor((cursor, take) =>
          this.prisma.fine.findMany({
            where,
            take,
            ...(cursor && { cursor, skip: 1 }),
            orderBy: { id: 'desc' },
            select: {
              id: true,
              type: true,
              amount: true,
              createdAt: true,
              paidAt: true,
              paidTo: { select: { fullName: true } },
              loan: {
                select: {
                  id: true,
                  user: { select: { fullName: true, memberCode: true } },
                  copy: {
                    select: {
                      barcode: true,
                      book: { select: { title: true } },
                    },
                  },
                },
              },
            },
          }),
        ),
    };
  }

  async readers(
    query: ReadersExportQueryDto,
    now: Date = new Date(),
  ): Promise<Dataset<ReaderExportRow>> {
    const q = likePattern(query.q);
    const where: Prisma.UserWhereInput = {
      role: 'READER',
      isActive: query.isActive,
      memberType: query.memberType,
      ...(q && {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { memberCode: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };
    const cutoff = overdueCutoff(now);
    return {
      title: 'Danh sách bạn đọc',
      sheetName: 'Bạn đọc',
      total: await this.prisma.user.count({ where }),
      columns: READER_COLUMNS,
      batches: () =>
        byCursor(async (cursor, take) => {
          const users = await this.prisma.user.findMany({
            where,
            take,
            ...(cursor && { cursor, skip: 1 }),
            orderBy: { id: 'asc' },
            select: {
              id: true,
              memberCode: true,
              fullName: true,
              email: true,
              memberType: true,
              isActive: true,
              createdAt: true,
            },
          });
          const ids = users.map((u) => u.id);
          // Hai truy vấn gộp cho cả lô thay vì đếm riêng từng người
          const [active, late] = await Promise.all([
            this.prisma.loan.groupBy({
              by: ['userId'],
              where: { userId: { in: ids }, status: LoanStatus.ACTIVE },
              _count: { _all: true },
            }),
            this.prisma.loan.groupBy({
              by: ['userId'],
              where: {
                userId: { in: ids },
                status: LoanStatus.ACTIVE,
                dueAt: { lt: cutoff },
              },
              _count: { _all: true },
            }),
          ]);
          const activeBy = new Map(
            active.map((g) => [g.userId, g._count._all]),
          );
          const lateBy = new Map(late.map((g) => [g.userId, g._count._all]));
          return users.map((u) => ({
            ...u,
            activeLoans: activeBy.get(u.id) ?? 0,
            overdueLoans: lateBy.get(u.id) ?? 0,
          }));
        }),
    };
  }

  async books(query: BooksExportQueryDto): Promise<Dataset<BookExportRow>> {
    const q = likePattern(query.q);
    const isbnQ = likePattern(query.q?.replace(/-/g, ''));
    const where: Prisma.BookWhereInput = {
      categoryId: query.categoryId,
      ...(query.authorId && {
        authors: { some: { authorId: query.authorId } },
      }),
      ...(query.available && {
        copies: { some: { status: CopyStatus.AVAILABLE } },
      }),
      // Cùng ngữ nghĩa với ô tìm kiếm trên danh sách: tiêu đề, ISBN hoặc tên tác giả
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          ...(isbnQ ? [{ isbn: { contains: isbnQ } }] : []),
          {
            authors: {
              some: {
                author: { name: { contains: q, mode: 'insensitive' as const } },
              },
            },
          },
        ],
      }),
    };
    return {
      title: 'Danh mục sách',
      sheetName: 'Danh mục sách',
      total: await this.prisma.book.count({ where }),
      columns: BOOK_COLUMNS,
      batches: () =>
        byCursor(async (cursor, take) => {
          const books = await this.prisma.book.findMany({
            where,
            take,
            ...(cursor && { cursor, skip: 1 }),
            orderBy: { id: 'asc' },
            select: {
              id: true,
              isbn: true,
              title: true,
              publisher: true,
              publishedYear: true,
              price: true,
              category: { select: { name: true } },
              authors: { select: { author: { select: { name: true } } } },
            },
          });
          const groups = await this.prisma.bookCopy.groupBy({
            by: ['bookId', 'status'],
            where: { bookId: { in: books.map((b) => b.id) } },
            _count: { _all: true },
          });
          const counts = new Map<
            number,
            { total: number; available: number }
          >();
          for (const g of groups) {
            const c = counts.get(g.bookId) ?? { total: 0, available: 0 };
            c.total += g._count._all;
            if (g.status === CopyStatus.AVAILABLE) c.available += g._count._all;
            counts.set(g.bookId, c);
          }
          return books.map((b) => ({
            id: b.id,
            isbn: b.isbn,
            title: b.title,
            authors: b.authors.map((a) => a.author.name).join('; '),
            category: b.category.name,
            publisher: b.publisher,
            publishedYear: b.publishedYear,
            price: b.price,
            copiesTotal: counts.get(b.id)?.total ?? 0,
            copiesAvailable: counts.get(b.id)?.available ?? 0,
          }));
        }),
    };
  }
}

const OVERDUE_COLUMNS: ExportColumn<OverdueExportRow>[] = [
  { header: 'Mã phiếu', width: 10, type: 'int', value: (r) => r.loan.id },
  {
    header: 'Mã thẻ',
    width: 16,
    type: 'text',
    value: (r) => r.loan.user.memberCode,
  },
  {
    header: 'Bạn đọc',
    width: 28,
    type: 'text',
    value: (r) => r.loan.user.fullName,
  },
  {
    header: 'Đối tượng',
    width: 12,
    type: 'text',
    value: (r) =>
      r.loan.user.memberType ? MEMBER_TYPE_LABEL[r.loan.user.memberType] : null,
  },
  {
    header: 'Sách',
    width: 44,
    type: 'text',
    value: (r) => r.loan.copy.book.title,
  },
  {
    header: 'Mã vạch',
    width: 16,
    type: 'text',
    value: (r) => r.loan.copy.barcode,
  },
  {
    header: 'Ngày mượn',
    width: 14,
    type: 'date',
    value: (r) => r.loan.borrowedAt,
  },
  { header: 'Hạn trả', width: 14, type: 'date', value: (r) => r.loan.dueAt },
  {
    header: 'Số ngày trễ',
    width: 12,
    type: 'int',
    value: (r) => r.overdueDays,
  },
  {
    header: 'Phạt ước tính (VND)',
    width: 20,
    type: 'vnd',
    value: (r) => r.estimatedFine,
  },
];

const LOAN_COLUMNS: ExportColumn<LoanExportRow>[] = [
  { header: 'Mã phiếu', width: 10, type: 'int', value: (r) => r.loan.id },
  {
    header: 'Mã thẻ',
    width: 16,
    type: 'text',
    value: (r) => r.loan.user.memberCode,
  },
  {
    header: 'Bạn đọc',
    width: 28,
    type: 'text',
    value: (r) => r.loan.user.fullName,
  },
  {
    header: 'Sách',
    width: 44,
    type: 'text',
    value: (r) => r.loan.copy.book.title,
  },
  {
    header: 'Mã vạch',
    width: 16,
    type: 'text',
    value: (r) => r.loan.copy.barcode,
  },
  {
    header: 'Ngày giờ mượn',
    width: 18,
    type: 'datetime',
    value: (r) => r.loan.borrowedAt,
  },
  { header: 'Hạn trả', width: 14, type: 'date', value: (r) => r.loan.dueAt },
  {
    header: 'Ngày giờ trả',
    width: 18,
    type: 'datetime',
    value: (r) => r.loan.returnedAt,
  },
  {
    header: 'Trạng thái',
    width: 12,
    type: 'text',
    value: (r) => LOAN_STATUS_LABEL[r.loan.status],
  },
  {
    header: 'Số lần gia hạn',
    width: 14,
    type: 'int',
    value: (r) => r.loan.renewedCount,
  },
  {
    header: 'Số ngày trễ hiện tại',
    width: 18,
    type: 'int',
    value: (r) => r.overdueDays,
  },
];

const TOP_BOOK_COLUMNS: ExportColumn<TopBookExportRow>[] = [
  { header: 'Hạng', width: 8, type: 'int', value: (r) => r.rank },
  { header: 'Mã sách', width: 10, type: 'int', value: (r) => r.bookId },
  { header: 'Tiêu đề', width: 48, type: 'text', value: (r) => r.title },
  { header: 'Tác giả', width: 30, type: 'text', value: (r) => r.authors },
  { header: 'ISBN', width: 16, type: 'text', value: (r) => r.isbn },
  { header: 'Thể loại', width: 20, type: 'text', value: (r) => r.category },
  { header: 'Số lượt mượn', width: 14, type: 'int', value: (r) => r.loanCount },
];

const INVENTORY_COLUMNS: ExportColumn<InventoryExportRow>[] = [
  { header: 'Thể loại', width: 30, type: 'text', value: (r) => r.category },
  { header: 'Tổng bản sao', width: 14, type: 'int', value: (r) => r.total },
  { header: 'Sẵn sàng', width: 12, type: 'int', value: (r) => r.available },
  { header: 'Đang mượn', width: 12, type: 'int', value: (r) => r.borrowed },
  {
    header: 'Đang giữ cho bạn đọc',
    width: 20,
    type: 'int',
    value: (r) => r.held,
  },
  { header: 'Bảo trì', width: 10, type: 'int', value: (r) => r.maintenance },
  { header: 'Mất', width: 8, type: 'int', value: (r) => r.lost },
];

const FINE_COLUMNS: ExportColumn<FineExportRow>[] = [
  { header: 'Mã khoản phạt', width: 14, type: 'int', value: (r) => r.id },
  { header: 'Mã phiếu', width: 10, type: 'int', value: (r) => r.loan.id },
  {
    header: 'Mã thẻ',
    width: 16,
    type: 'text',
    value: (r) => r.loan.user.memberCode,
  },
  {
    header: 'Bạn đọc',
    width: 28,
    type: 'text',
    value: (r) => r.loan.user.fullName,
  },
  {
    header: 'Sách',
    width: 44,
    type: 'text',
    value: (r) => r.loan.copy.book.title,
  },
  {
    header: 'Loại phạt',
    width: 12,
    type: 'text',
    value: (r) => FINE_TYPE_LABEL[r.type],
  },
  { header: 'Số tiền (VND)', width: 16, type: 'vnd', value: (r) => r.amount },
  {
    header: 'Ngày phát sinh',
    width: 18,
    type: 'datetime',
    value: (r) => r.createdAt,
  },
  {
    header: 'Trạng thái',
    width: 12,
    type: 'text',
    value: (r) => (r.paidAt ? 'Đã thu' : 'Chưa thu'),
  },
  { header: 'Ngày thu', width: 18, type: 'datetime', value: (r) => r.paidAt },
  {
    header: 'Người thu',
    width: 24,
    type: 'text',
    value: (r) => r.paidTo?.fullName ?? null,
  },
];

const READER_COLUMNS: ExportColumn<ReaderExportRow>[] = [
  { header: 'Mã thẻ', width: 16, type: 'text', value: (r) => r.memberCode },
  { header: 'Họ tên', width: 28, type: 'text', value: (r) => r.fullName },
  { header: 'Email', width: 32, type: 'text', value: (r) => r.email },
  {
    header: 'Đối tượng',
    width: 12,
    type: 'text',
    value: (r) => (r.memberType ? MEMBER_TYPE_LABEL[r.memberType] : null),
  },
  {
    header: 'Trạng thái thẻ',
    width: 14,
    type: 'text',
    value: (r) => (r.isActive ? 'Hoạt động' : 'Đang khoá'),
  },
  {
    header: 'Ngày đăng ký',
    width: 14,
    type: 'date',
    value: (r) => r.createdAt,
  },
  { header: 'Đang mượn', width: 12, type: 'int', value: (r) => r.activeLoans },
  { header: 'Quá hạn', width: 10, type: 'int', value: (r) => r.overdueLoans },
];

const BOOK_COLUMNS: ExportColumn<BookExportRow>[] = [
  { header: 'Mã sách', width: 10, type: 'int', value: (r) => r.id },
  { header: 'ISBN', width: 16, type: 'text', value: (r) => r.isbn },
  { header: 'Tiêu đề', width: 48, type: 'text', value: (r) => r.title },
  { header: 'Tác giả', width: 30, type: 'text', value: (r) => r.authors },
  { header: 'Thể loại', width: 20, type: 'text', value: (r) => r.category },
  {
    header: 'Nhà xuất bản',
    width: 24,
    type: 'text',
    value: (r) => r.publisher,
  },
  {
    header: 'Năm xuất bản',
    width: 14,
    type: 'int',
    value: (r) => r.publishedYear,
  },
  { header: 'Giá bìa (VND)', width: 16, type: 'vnd', value: (r) => r.price },
  {
    header: 'Tổng bản sao',
    width: 14,
    type: 'int',
    value: (r) => r.copiesTotal,
  },
  {
    header: 'Còn sẵn',
    width: 10,
    type: 'int',
    value: (r) => r.copiesAvailable,
  },
];
