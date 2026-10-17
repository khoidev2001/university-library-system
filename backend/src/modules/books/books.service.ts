import { Injectable, NotFoundException } from '@nestjs/common';
import { CopyStatus, LoanStatus, Prisma } from '@prisma/client';
import { Page, toPage } from '../../common/dto/pagination.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { likePattern } from '../../common/sql.util';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify } from '../categories/categories.service';
import {
  CreateBookDto,
  ImportBooksDto,
  QueryBooksDto,
  UpdateBookDto,
} from './dto/books.dto';
import { BookInfo, GoogleBooksClient } from './google-books.client';

const bookInclude = {
  category: true,
  authors: { include: { author: true } },
} satisfies Prisma.BookInclude;

type BookRow = Prisma.BookGetPayload<{ include: typeof bookInclude }>;

export interface BookSummary {
  id: number;
  isbn: string | null;
  title: string;
  publisher: string | null;
  publishedYear: number | null;
  price: number;
  coverUrl: string | null;
  category: { id: number; name: string; slug: string };
  authors: { id: number; name: string }[];
  copiesTotal: number;
  copiesAvailable: number;
}

export interface BookDetail extends BookSummary {
  description: string | null;
  ratingAvg: number | null;
  ratingCount: number;
}

export interface ImportReport {
  created: BookSummary[];
  skipped: { isbn: string; reason: 'EXISTS' | 'NOT_FOUND' }[];
}

/** Giá bìa giả định khi nhập từ Google Books: 500đ/trang, tối thiểu 50.000đ (SRS 2.5). */
export function estimatePrice(pageCount?: number): number {
  return Math.max(50_000, Math.round(((pageCount ?? 200) * 500) / 1000) * 1000);
}

@Injectable()
export class BooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleBooks: GoogleBooksClient,
  ) {}

  /** FR-SEARCH-01..03 */
  async search(query: QueryBooksDto): Promise<Page<BookSummary>> {
    const q = likePattern(query.q);
    if (q) return this.searchByText(query, q);

    const where: Prisma.BookWhereInput = {
      categoryId: query.categoryId,
      ...(query.authorId && {
        authors: { some: { authorId: query.authorId } },
      }),
      ...(query.available && {
        copies: { some: { status: CopyStatus.AVAILABLE } },
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.book.findMany({
        where,
        include: bookInclude,
        orderBy: { id: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.book.count({ where }),
    ]);
    const counts = await this.copyCounts(rows.map((r) => r.id));
    return toPage(
      rows.map((r) => this.toSummary(r, counts)),
      total,
      query,
    );
  }

  /**
   * Tìm theo chuỗi: tiêu đề, ISBN hoặc tên tác giả. Viết bằng SQL thô vì điều kiện
   * `title ILIKE … OR isbn LIKE … OR id IN (tác giả)` mà Prisma sinh ra buộc Postgres quét tuần tự
   * cả bảng sách (không dùng được chỉ mục trigram). Tách thành UNION của ba truy vấn, mỗi cái
   * dùng một chỉ mục GIN (books_title_trgm_idx, books_isbn_trgm_idx, authors_name_trgm_idx):
   * 50k sách, từ khoá hiếm: 40ms → 0.5ms.
   */
  private async searchByText(
    query: QueryBooksDto,
    q: string,
  ): Promise<Page<BookSummary>> {
    const pattern = `%${q}%`;
    const isbnQ = likePattern(query.q?.replace(/-/g, ''));
    const filters = Prisma.sql`
      WHERE b.id IN (
        SELECT id FROM books WHERE title ILIKE ${pattern}
        ${isbnQ ? Prisma.sql`UNION SELECT id FROM books WHERE isbn LIKE ${`%${isbnQ}%`}` : Prisma.empty}
        UNION
        SELECT ba.book_id FROM book_authors ba
        JOIN authors a ON a.id = ba.author_id
        WHERE a.name ILIKE ${pattern}
      )
      ${query.categoryId ? Prisma.sql`AND b.category_id = ${query.categoryId}` : Prisma.empty}
      ${
        query.authorId
          ? Prisma.sql`AND EXISTS (
              SELECT 1 FROM book_authors x
              WHERE x.book_id = b.id AND x.author_id = ${query.authorId})`
          : Prisma.empty
      }
      ${
        query.available
          ? Prisma.sql`AND EXISTS (
              SELECT 1 FROM book_copies c
              WHERE c.book_id = b.id AND c.status = 'AVAILABLE'::"CopyStatus")`
          : Prisma.empty
      }`;
    const [idRows, countRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<{ id: number }[]>`
        SELECT b.id FROM books b ${filters}
        ORDER BY b.id ASC LIMIT ${query.limit} OFFSET ${query.skip}`,
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM books b ${filters}`,
    ]);
    const ids = idRows.map((r) => r.id);
    const rows = ids.length
      ? await this.prisma.book.findMany({
          where: { id: { in: ids } },
          include: bookInclude,
        })
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const counts = await this.copyCounts(ids);
    return toPage(
      ids
        .map((id) => byId.get(id))
        .filter((r): r is BookRow => !!r)
        .map((r) => this.toSummary(r, counts)),
      countRows[0]?.n ?? 0,
      query,
    );
  }

  /** FR-SEARCH-04 */
  async findOne(id: number): Promise<BookDetail> {
    const row = await this.prisma.book.findUnique({
      where: { id },
      include: bookInclude,
    });
    if (!row) throw new NotFoundException('Không tìm thấy sách');
    const [counts, rating] = await Promise.all([
      this.copyCounts([id]),
      this.prisma.rating.aggregate({
        where: { bookId: id },
        _avg: { score: true },
        _count: true,
      }),
    ]);
    return {
      ...this.toSummary(row, counts),
      description: row.description,
      ratingAvg: rating._avg.score,
      ratingCount: rating._count,
    };
  }

  /** FR-BOOK-01 */
  async create(dto: CreateBookDto): Promise<BookSummary> {
    const authorIds = [...new Set(dto.authorIds)];
    await this.assertReferences(dto.categoryId, authorIds);
    if (dto.isbn) await this.assertIsbnFree(dto.isbn);
    const row = await this.prisma.book.create({
      data: {
        title: dto.title,
        isbn: dto.isbn?.replace(/-/g, ''),
        description: dto.description,
        publisher: dto.publisher,
        publishedYear: dto.publishedYear,
        price: dto.price,
        coverUrl: dto.coverUrl,
        categoryId: dto.categoryId,
        authors: { create: authorIds.map((authorId) => ({ authorId })) },
      },
      include: bookInclude,
    });
    return this.toSummary(row, new Map());
  }

  /** FR-BOOK-02 */
  async update(id: number, dto: UpdateBookDto): Promise<BookSummary> {
    const existing = await this.prisma.book.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy sách');
    const authorIds = dto.authorIds && [...new Set(dto.authorIds)];
    await this.assertReferences(dto.categoryId ?? undefined, authorIds);
    // So sánh sau khi bỏ gạch ngang: gửi lại đúng ISBN cũ dạng "978-…" không phải là trùng
    const isbn = dto.isbn?.replace(/-/g, '');
    if (isbn && isbn !== existing.isbn) await this.assertIsbnFree(isbn);
    const row = await this.prisma.book.update({
      where: { id },
      data: {
        // null từ JSON không hợp lệ với cột bắt buộc → coi như không đổi
        title: dto.title ?? undefined,
        isbn,
        description: dto.description,
        publisher: dto.publisher,
        publishedYear: dto.publishedYear,
        price: dto.price ?? undefined,
        coverUrl: dto.coverUrl,
        categoryId: dto.categoryId ?? undefined,
        ...(authorIds && {
          authors: {
            deleteMany: {},
            create: authorIds.map((authorId) => ({ authorId })),
          },
        }),
      },
      include: bookInclude,
    });
    return this.toSummary(row, await this.copyCounts([id]));
  }

  /**
   * FR-BOOK-03, BR-12. Sách đã từng có phiếu mượn (kể cả đã trả) phải giữ lại để không mất
   * lịch sử mượn và phiếu phạt; chỉ sách chưa từng được mượn mới xoá được.
   */
  async remove(id: number): Promise<void> {
    const existing = await this.prisma.book.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy sách');
    const activeLoans = await this.prisma.loan.count({
      where: { copy: { bookId: id }, status: LoanStatus.ACTIVE },
    });
    if (activeLoans > 0) {
      throw new BusinessException(
        'BOOK_HAS_ACTIVE_LOANS',
        'Sách còn bản sao đang được mượn, không thể xoá',
      );
    }
    const history = await this.prisma.loan.count({
      where: { copy: { bookId: id } },
    });
    if (history > 0) {
      throw new BusinessException(
        'BOOK_HAS_LOAN_HISTORY',
        'Sách đã có lịch sử mượn, không thể xoá',
      );
    }
    await this.prisma.$transaction([
      this.prisma.reservation.deleteMany({ where: { bookId: id } }),
      this.prisma.rating.deleteMany({ where: { bookId: id } }),
      this.prisma.bookCopy.deleteMany({ where: { bookId: id } }),
      this.prisma.book.delete({ where: { id } }),
    ]);
  }

  /** FR-BOOK-05: nhập hàng loạt theo ISBN qua Google Books; lỗi từng ISBN không dừng cả lô. */
  async importByIsbn(dto: ImportBooksDto): Promise<ImportReport> {
    const report: ImportReport = { created: [], skipped: [] };
    const seen = new Set<string>();
    for (const raw of dto.isbns) {
      const isbn = raw.replace(/[^0-9Xx]/g, '');
      if (seen.has(isbn)) continue; // trùng trong cùng lô: bỏ qua, không gọi Google lần nữa
      seen.add(isbn);
      // ISBN phải 10 hoặc 13 ký tự; sai thì không tốn một lượt gọi Google Books
      if (isbn.length !== 10 && isbn.length !== 13) {
        report.skipped.push({ isbn, reason: 'NOT_FOUND' });
        continue;
      }
      if (await this.prisma.book.findUnique({ where: { isbn } })) {
        report.skipped.push({ isbn, reason: 'EXISTS' });
        continue;
      }
      const info = await this.googleBooks.lookup(isbn);
      if (!info) {
        report.skipped.push({ isbn, reason: 'NOT_FOUND' });
        continue;
      }
      report.created.push(await this.createFromInfo(info));
    }
    return report;
  }

  /** Dùng chung cho import và seed: tạo sách + tác giả + thể loại theo tên. */
  async createFromInfo(info: BookInfo): Promise<BookSummary> {
    const categoryName =
      info.categories[0]?.split('/')[0].trim() || 'Chưa phân loại';
    const category = await this.prisma.category.upsert({
      where: { slug: slugify(categoryName) },
      update: {},
      create: { name: categoryName, slug: slugify(categoryName) },
    });
    const authorNames = info.authors.length ? info.authors : ['Khuyết danh'];
    const authors = await Promise.all(
      authorNames.map(async (name) => {
        const found = await this.prisma.author.findFirst({ where: { name } });
        return found ?? this.prisma.author.create({ data: { name } });
      }),
    );
    const row = await this.prisma.book.create({
      data: {
        isbn: info.isbn,
        title: info.title,
        description: info.description,
        publisher: info.publisher,
        publishedYear: info.publishedYear,
        price: estimatePrice(info.pageCount),
        coverUrl: info.coverUrl,
        categoryId: category.id,
        authors: { create: authors.map((a) => ({ authorId: a.id })) },
      },
      include: bookInclude,
    });
    return this.toSummary(row, new Map());
  }

  private async assertIsbnFree(isbn: string): Promise<void> {
    const clean = isbn.replace(/-/g, '');
    if (await this.prisma.book.findUnique({ where: { isbn: clean } })) {
      throw new BusinessException('ISBN_EXISTS', `ISBN ${clean} đã tồn tại`);
    }
  }

  private async assertReferences(
    categoryId?: number,
    authorIds?: number[],
  ): Promise<void> {
    if (categoryId !== undefined) {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) throw new NotFoundException('Thể loại không tồn tại');
    }
    if (authorIds) {
      const found = await this.prisma.author.count({
        where: { id: { in: authorIds } },
      });
      if (found !== new Set(authorIds).size)
        throw new NotFoundException('Tác giả không tồn tại');
    }
  }

  /** FR-COPY-03: số bản còn, tính từ trạng thái bản sao, không lưu (SDD 4.3). */
  private async copyCounts(
    bookIds: number[],
  ): Promise<Map<number, { total: number; available: number }>> {
    const map = new Map<number, { total: number; available: number }>();
    if (bookIds.length === 0) return map;
    const groups = await this.prisma.bookCopy.groupBy({
      by: ['bookId', 'status'],
      where: { bookId: { in: bookIds } },
      _count: { _all: true },
    });
    for (const g of groups) {
      const entry = map.get(g.bookId) ?? { total: 0, available: 0 };
      entry.total += g._count._all;
      if (g.status === CopyStatus.AVAILABLE) entry.available += g._count._all;
      map.set(g.bookId, entry);
    }
    return map;
  }

  private toSummary(
    row: BookRow,
    counts: Map<number, { total: number; available: number }>,
  ): BookSummary {
    const c = counts.get(row.id) ?? { total: 0, available: 0 };
    return {
      id: row.id,
      isbn: row.isbn,
      title: row.title,
      publisher: row.publisher,
      publishedYear: row.publishedYear,
      price: row.price,
      coverUrl: row.coverUrl,
      category: {
        id: row.category.id,
        name: row.category.name,
        slug: row.category.slug,
      },
      authors: row.authors.map((ba) => ({
        id: ba.author.id,
        name: ba.author.name,
      })),
      copiesTotal: c.total,
      copiesAvailable: c.available,
    };
  }
}
