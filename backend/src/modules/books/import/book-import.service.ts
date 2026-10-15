import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { slugify } from '../../categories/categories.service';
import { readImportTable, parseRow } from './book-import.parser';
import {
  IMPORT_BATCH_SIZE,
  ImportBookData,
  ImportFailure,
  ImportPreview,
  ImportPreviewRow,
  ImportReport,
  OnDuplicate,
  ParsedRow,
  RowAction,
} from './book-import.types';
import { isbnVariants } from './isbn';

/** Giá bìa mặc định khi file không ghi (tối thiểu theo SRS 2.5). */
const DEFAULT_PRICE = 50_000;
const UNCATEGORIZED = 'Chưa phân loại';
const ANONYMOUS_AUTHOR = 'Khuyết danh';
/**
 * Khoá advisory toàn cục cho mọi lần nhập: hai lần nhập đồng thời xếp hàng theo từng lô thay vì
 * giẫm nhau. Nhờ vậy: cùng một ISBN chỉ sinh một sách, tác giả (không có ràng buộc duy nhất)
 * không bị nhân đôi, và mã vạch bản sao không đụng nhau.
 */
const IMPORT_LOCK_KEY = 7_210_001;
const TX_OPTIONS = { maxWait: 20_000, timeout: 120_000 } as const;

export interface AnalyzedRow extends ParsedRow {
  action: RowAction;
}

export interface Analysis {
  fileType: 'csv' | 'xlsx';
  rows: AnalyzedRow[];
  newCategories: string[];
  unknownColumns: string[];
  notes: string[];
}

interface ExistingBook {
  id: number;
  isbn: string | null;
  title: string;
  publisher: string | null;
  publishedYear: number | null;
  price: number;
  description: string | null;
  coverUrl: string | null;
  categoryId: number;
  authorNames: string[];
  copyCount: number;
}

interface BatchResult {
  created: number;
  updated: number;
  skipped: number;
  createdCopies: number;
}

const padId = (id: number) => String(id).padStart(6, '0');

@Injectable()
export class BookImportService {
  private readonly logger = new Logger(BookImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Pha 1: đọc + kiểm tra (không ghi gì)
  // -------------------------------------------------------------------------

  async analyze(
    buf: Buffer,
    filename: string,
    onDuplicate: OnDuplicate,
  ): Promise<Analysis> {
    const table = readImportTable(buf, filename);
    const parsed: AnalyzedRow[] = table.rows.map((r) => ({
      ...parseRow(r.row, r.raw),
      action: 'none' as RowAction,
    }));

    this.markDuplicatesInFile(parsed);

    const valid = parsed.filter((r) => r.errors.length === 0 && r.data);
    const existing = await this.findExisting(
      this.prisma,
      valid.map((r) => r.data!),
    );
    for (const row of valid) {
      const found = existing.get(this.keyOf(row.data!));
      if (found) {
        row.action = onDuplicate === 'update' ? 'update' : 'skip';
        row.warnings.push({
          field: row.data!.isbn ? 'isbn' : 'title',
          code: 'DUPLICATE_IN_DB',
          message:
            (row.data!.isbn
              ? `ISBN đã có trong kho (sách #${found.id})`
              : `Đã có sách cùng tiêu đề chưa ghi ISBN (sách #${found.id})`) +
            (onDuplicate === 'update' ? ': sẽ cập nhật' : ': sẽ bỏ qua'),
        });
      } else {
        row.action = 'create';
      }
    }

    const categories = await this.prisma.category.findMany({
      select: { name: true, slug: true },
    });
    const knownSlug = new Set(categories.map((c) => c.slug));
    const knownName = new Set(categories.map((c) => c.name.toLowerCase()));
    const newCategories = new Map<string, string>();
    for (const row of valid) {
      if (row.action === 'skip') continue;
      const name = row.data!.category ?? UNCATEGORIZED;
      const lower = name.toLowerCase();
      if (!knownSlug.has(slugify(name)) && !knownName.has(lower)) {
        if (!newCategories.has(slugify(name)))
          newCategories.set(slugify(name), name);
        if (row.data!.category)
          row.warnings.push({
            field: 'category',
            code: 'CATEGORY_WILL_BE_CREATED',
            message: `Thể loại "${name}" chưa có, sẽ được tạo mới`,
          });
      }
    }
    return {
      fileType: table.fileType,
      rows: parsed,
      newCategories: [...newCategories.values()],
      unknownColumns: table.unknownColumns,
      notes: table.notes,
    };
  }

  /** ISBN (hoặc tiêu đề với dòng không ISBN) lặp trong chính file: dòng sau bị loại. */
  private markDuplicatesInFile(rows: AnalyzedRow[]): void {
    const isbnSeen = new Map<string, number>();
    const titleSeen = new Map<string, number>();
    for (const row of rows) {
      if (row.errors.length || !row.data) continue;
      const { isbn, title } = row.data;
      if (isbn) {
        const variants = isbnVariants(isbn);
        const first = variants
          .map((v) => isbnSeen.get(v))
          .find((n) => n !== undefined);
        if (first !== undefined) {
          row.errors.push({
            field: 'isbn',
            code: 'DUPLICATE_IN_FILE',
            message: `ISBN trùng với dòng ${first} trong cùng file`,
          });
          row.data = null;
        } else for (const v of variants) isbnSeen.set(v, row.row);
      } else {
        const key = title.toLowerCase();
        const first = titleSeen.get(key);
        if (first !== undefined)
          row.warnings.push({
            field: 'title',
            code: 'DUPLICATE_TITLE_IN_FILE',
            message: `Trùng tiêu đề với dòng ${first} (cả hai đều không có ISBN), vẫn được nhập`,
          });
        else titleSeen.set(key, row.row);
      }
    }
  }

  private keyOf(data: ImportBookData): string {
    return data.isbn
      ? `isbn:${isbnVariants(data.isbn).sort().join('|')}`
      : `title:${data.title.toLowerCase()}`;
  }

  /** Sách đã có trong kho khớp với các dòng: theo mọi dạng ISBN, hoặc theo tiêu đề nếu dòng không ISBN. */
  private async findExisting(
    db: Prisma.TransactionClient | PrismaService,
    items: ImportBookData[],
  ): Promise<Map<string, ExistingBook>> {
    const result = new Map<string, ExistingBook>();
    if (items.length === 0) return result;
    const variants = [
      ...new Set(items.flatMap((d) => (d.isbn ? isbnVariants(d.isbn) : []))),
    ];
    const titles = [
      ...new Set(
        items.filter((d) => !d.isbn).map((d) => d.title.toLowerCase()),
      ),
    ];
    const titleIds = titles.length
      ? await db.$queryRaw<{ id: number }[]>`
          SELECT id FROM books WHERE isbn IS NULL AND lower(title) = ANY(${titles})`
      : [];
    const rows = await db.book.findMany({
      where: {
        OR: [
          ...(variants.length ? [{ isbn: { in: variants } }] : []),
          ...(titleIds.length
            ? [{ id: { in: titleIds.map((t) => t.id) } }]
            : []),
        ],
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        isbn: true,
        title: true,
        publisher: true,
        publishedYear: true,
        price: true,
        description: true,
        coverUrl: true,
        categoryId: true,
        authors: { select: { author: { select: { name: true } } } },
        _count: { select: { copies: true } },
      },
    });
    for (const r of rows) {
      const book: ExistingBook = {
        id: r.id,
        isbn: r.isbn,
        title: r.title,
        publisher: r.publisher,
        publishedYear: r.publishedYear,
        price: r.price,
        description: r.description,
        coverUrl: r.coverUrl,
        categoryId: r.categoryId,
        authorNames: r.authors.map((a) => a.author.name),
        copyCount: r._count.copies,
      };
      const key = r.isbn
        ? `isbn:${isbnVariants(r.isbn).sort().join('|')}`
        : `title:${r.title.toLowerCase()}`;
      if (!result.has(key)) result.set(key, book);
    }
    // Khoá theo dạng ISBN khác nhau (ISBN-10 trong DB vs ISBN-13 trong file) phải gặp nhau
    for (const d of items) {
      const k = this.keyOf(d);
      if (result.has(k)) continue;
      if (d.isbn)
        for (const v of isbnVariants(d.isbn)) {
          const hit = [...result.values()].find((b) => b.isbn === v);
          if (hit) {
            result.set(k, hit);
            break;
          }
        }
    }
    return result;
  }

  toPreview(analysis: Analysis): ImportPreview {
    const counts = {
      ok: 0,
      warning: 0,
      error: 0,
      create: 0,
      update: 0,
      skip: 0,
    };
    const rows: ImportPreviewRow[] = analysis.rows.map((r) => {
      const status: ImportPreviewRow['status'] = r.errors.length
        ? 'error'
        : r.warnings.length
          ? 'warning'
          : 'ok';
      counts[status]++;
      if (r.action === 'create' || r.action === 'update' || r.action === 'skip')
        counts[r.action]++;
      return {
        row: r.row,
        status,
        action: r.action,
        title: r.raw.title ?? null,
        isbn: r.data?.isbn ?? r.raw.isbn ?? null,
        category: r.data?.category ?? r.raw.category ?? null,
        copies: r.data?.copies ?? null,
        errors: r.errors,
        warnings: r.warnings,
        ...(r.errors.length ? { raw: r.raw } : {}),
      };
    });
    return {
      dryRun: true,
      fileType: analysis.fileType,
      totalRows: analysis.rows.length,
      counts,
      newCategories: analysis.newCategories,
      unknownColumns: analysis.unknownColumns,
      notes: analysis.notes,
      rows,
    };
  }

  // -------------------------------------------------------------------------
  // Pha 2: ghi
  // -------------------------------------------------------------------------

  async run(
    buf: Buffer,
    filename: string,
    onDuplicate: OnDuplicate,
  ): Promise<ImportReport> {
    const analysis = await this.analyze(buf, filename, onDuplicate);
    const report: ImportReport = {
      dryRun: false,
      fileType: analysis.fileType,
      totalRows: analysis.rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: [],
      createdCopies: 0,
      newCategories: [],
      notes: analysis.notes,
    };

    const work: AnalyzedRow[] = [];
    for (const row of analysis.rows) {
      if (row.errors.length || !row.data) {
        report.failed.push({
          row: row.row,
          reason: row.errors.map((e) => e.message).join('; '),
          raw: row.raw,
        });
      } else if (row.action === 'skip') report.skipped++;
      else work.push(row);
    }
    if (work.length === 0) return report;

    const categoryIds = await this.ensureCategories(
      work.map((r) => r.data!.category ?? UNCATEGORIZED),
      report,
    );

    for (let i = 0; i < work.length; i += IMPORT_BATCH_SIZE) {
      const batch = work.slice(i, i + IMPORT_BATCH_SIZE);
      try {
        const done = await this.prisma.$transaction(
          (tx) => this.processBatch(tx, batch, onDuplicate, categoryIds),
          TX_OPTIONS,
        );
        this.add(report, done);
      } catch (error) {
        this.logger.warn(
          `Lô ${i / IMPORT_BATCH_SIZE + 1} lỗi, thử lại từng dòng: ${String(error)}`,
        );
        // Một dòng xấu không được kéo cả lô xuống: chạy riêng từng dòng, dòng nào hỏng thì báo dòng đó
        for (const row of batch) {
          try {
            const done = await this.prisma.$transaction(
              (tx) => this.processBatch(tx, [row], onDuplicate, categoryIds),
              TX_OPTIONS,
            );
            this.add(report, done);
          } catch (rowError) {
            report.failed.push(this.toFailure(row, rowError));
          }
        }
      }
    }
    report.failed.sort((a, b) => a.row - b.row);
    return report;
  }

  private add(report: ImportReport, done: BatchResult): void {
    report.created += done.created;
    report.updated += done.updated;
    report.skipped += done.skipped;
    report.createdCopies += done.createdCopies;
  }

  private toFailure(row: AnalyzedRow, error: unknown): ImportFailure {
    this.logger.error(`Dòng ${row.row} lỗi: ${String(error)}`);
    const code =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? ` (${error.code})`
        : '';
    return {
      row: row.row,
      reason: `Không ghi được vào cơ sở dữ liệu${code}`,
      raw: row.raw,
    };
  }

  /** Tạo các thể loại còn thiếu (một lần, dưới khoá) và trả về bảng tên-thường → id. */
  private async ensureCategories(
    names: string[],
    report: ImportReport,
  ): Promise<Map<string, number>> {
    const wanted = new Map<string, string>();
    for (const n of names)
      if (!wanted.has(n.toLowerCase())) wanted.set(n.toLowerCase(), n);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${IMPORT_LOCK_KEY})`;
      const all = await tx.category.findMany({
        select: { id: true, name: true, slug: true },
      });
      const out = new Map<string, number>();
      for (const [lower, name] of wanted) {
        const slug = slugify(name);
        let found = all.find(
          (c) => c.slug === slug || c.name.toLowerCase() === lower,
        );
        if (!found) {
          // DO NOTHING không chỉ định cột: bỏ qua cả xung đột tên lẫn slug do người khác vừa tạo
          await tx.$executeRaw`
            INSERT INTO categories (name, slug) VALUES (${name}, ${slug}) ON CONFLICT DO NOTHING`;
          found = await tx.category.findFirst({
            where: {
              OR: [{ slug }, { name: { equals: name, mode: 'insensitive' } }],
            },
            select: { id: true, name: true, slug: true },
          });
          if (found) {
            all.push(found);
            report.newCategories.push(name);
          }
        }
        if (found) out.set(lower, found.id);
      }
      return out;
    }, TX_OPTIONS);
  }

  private async processBatch(
    tx: Prisma.TransactionClient,
    rows: AnalyzedRow[],
    onDuplicate: OnDuplicate,
    categoryIds: Map<string, number>,
  ): Promise<BatchResult> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${IMPORT_LOCK_KEY})`;
    const result: BatchResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      createdCopies: 0,
    };

    // Tra lại trong khoá: lần nhập khác có thể vừa tạo sách này giữa pha kiểm tra và bây giờ
    const existing = await this.findExisting(
      tx,
      rows.map((r) => r.data!),
    );
    const toCreate: ImportBookData[] = [];
    const toUpdate: { data: ImportBookData; book: ExistingBook }[] = [];
    for (const { data } of rows) {
      const book = existing.get(this.keyOf(data!));
      if (!book) toCreate.push(data!);
      else if (onDuplicate === 'update') toUpdate.push({ data: data!, book });
      else result.skipped++;
    }
    if (toCreate.length === 0 && toUpdate.length === 0) return result;

    const authorIds = await this.ensureAuthors(
      tx,
      [...toCreate, ...toUpdate.map((u) => u.data)].flatMap((d) => d.authors),
      toCreate.some((d) => d.authors.length === 0),
    );
    const categoryOf = (d: ImportBookData) =>
      categoryIds.get((d.category ?? UNCATEGORIZED).toLowerCase())!;
    const authorsOf = (d: ImportBookData) =>
      (d.authors.length ? d.authors : [ANONYMOUS_AUTHOR]).map((a) =>
        authorIds.get(a.toLowerCase())!,
      );

    if (toCreate.length) {
      const created = await tx.book.createManyAndReturn({
        data: toCreate.map((d) => ({
          isbn: d.isbn,
          title: d.title,
          description: d.description,
          publisher: d.publisher,
          publishedYear: d.publishedYear,
          price: d.price ?? DEFAULT_PRICE,
          coverUrl: d.coverUrl,
          categoryId: categoryOf(d),
        })),
        select: { id: true, isbn: true, title: true },
      });
      // Thứ tự trả về trùng thứ tự chèn; kiểm lại để không gán nhầm tác giả / bản sao cho sách khác
      if (
        created.length !== toCreate.length ||
        created.some(
          (b, i) =>
            b.title !== toCreate[i].title || b.isbn !== toCreate[i].isbn,
        )
      )
        throw new Error('Thứ tự sách vừa tạo không khớp dữ liệu nhập');

      await tx.bookAuthor.createMany({
        data: created.flatMap((b, i) =>
          [...new Set(authorsOf(toCreate[i]))].map((authorId) => ({
            bookId: b.id,
            authorId,
          })),
        ),
      });
      result.created += created.length;
      result.createdCopies += await this.createCopies(
        tx,
        created.map((b, i) => ({
          bookId: b.id,
          count: toCreate[i].copies ?? 1,
          shelf: toCreate[i].shelfLocation,
          isNew: true,
        })),
      );
    }

    for (const { data, book } of toUpdate) {
      const patch: Prisma.BookUpdateInput = {};
      if (data.title !== book.title) patch.title = data.title;
      if (data.publisher !== null && data.publisher !== book.publisher)
        patch.publisher = data.publisher;
      if (
        data.publishedYear !== null &&
        data.publishedYear !== book.publishedYear
      )
        patch.publishedYear = data.publishedYear;
      if (data.price !== null && data.price !== book.price)
        patch.price = data.price;
      if (data.description !== null && data.description !== book.description)
        patch.description = data.description;
      if (data.coverUrl !== null && data.coverUrl !== book.coverUrl)
        patch.coverUrl = data.coverUrl;
      if (data.category !== null && categoryOf(data) !== book.categoryId)
        patch.category = { connect: { id: categoryOf(data) } };
      const newAuthors = data.authors.length
        ? [...new Set(authorsOf(data))]
        : null;
      const authorsChanged =
        newAuthors !== null &&
        (newAuthors.length !== book.authorNames.length ||
          !data.authors.every((a) =>
            book.authorNames.some((n) => n.toLowerCase() === a.toLowerCase()),
          ));
      const missingCopies =
        data.copies !== null ? Math.max(0, data.copies - book.copyCount) : 0;

      if (
        Object.keys(patch).length === 0 &&
        !authorsChanged &&
        missingCopies === 0
      ) {
        result.skipped++; // không có gì khác: nhập lại cùng file không đổi gì cả
        continue;
      }
      if (Object.keys(patch).length)
        await tx.book.update({ where: { id: book.id }, data: patch });
      if (authorsChanged) {
        await tx.bookAuthor.deleteMany({ where: { bookId: book.id } });
        await tx.bookAuthor.createMany({
          data: newAuthors.map((authorId) => ({ bookId: book.id, authorId })),
        });
      }
      if (missingCopies > 0)
        result.createdCopies += await this.createCopies(tx, [
          {
            bookId: book.id,
            count: missingCopies,
            shelf: data.shelfLocation,
            isNew: false,
          },
        ]);
      result.updated++;
    }
    return result;
  }

  /** Tên (không phân biệt hoa thường) → id; tác giả chưa có thì tạo. Bảng authors không có ràng buộc duy nhất nên cần khoá. */
  private async ensureAuthors(
    tx: Prisma.TransactionClient,
    names: string[],
    needAnonymous: boolean,
  ): Promise<Map<string, number>> {
    const wanted = new Map<string, string>();
    for (const n of [...names, ...(needAnonymous ? [ANONYMOUS_AUTHOR] : [])])
      if (!wanted.has(n.toLowerCase())) wanted.set(n.toLowerCase(), n);
    const out = new Map<string, number>();
    if (wanted.size === 0) return out;
    const found = await tx.$queryRaw<{ id: number; name: string }[]>`
      SELECT id, name FROM authors WHERE lower(name) = ANY(${[...wanted.keys()]}) ORDER BY id`;
    for (const a of found)
      if (!out.has(a.name.toLowerCase())) out.set(a.name.toLowerCase(), a.id);
    const missing = [...wanted].filter(([lower]) => !out.has(lower));
    if (missing.length) {
      const created = await tx.author.createManyAndReturn({
        data: missing.map(([, name]) => ({ name })),
        select: { id: true, name: true },
      });
      for (const a of created) out.set(a.name.toLowerCase(), a.id);
    }
    return out;
  }

  /**
   * Sinh bản sao với mã vạch `LIB-<id 6 chữ số>-<n>`. Sách mới: n chạy từ 1, kiểm một lần xem có mã nào
   * đã bị chiếm (bản sao tạo tay trước đó). Sách cũ: n tiếp nối số lớn nhất đang có. Chạy dưới khoá
   * advisory nên không có hai lần nhập nào cùng cấp một mã.
   */
  private async createCopies(
    tx: Prisma.TransactionClient,
    items: {
      bookId: number;
      count: number;
      shelf: string | null;
      isNew: boolean;
    }[],
  ): Promise<number> {
    const planned = items.filter((i) => i.count > 0);
    if (planned.length === 0) return 0;
    const data: {
      bookId: number;
      barcode: string;
      shelfLocation: string | null;
    }[] = [];

    // Với mỗi sách lấy số lớn nhất đã dùng trong tiền tố của nó (một truy vấn cho cả lô)
    const prefixes = planned.map((i) => `LIB-${padId(i.bookId)}-`);
    const used = await tx.bookCopy.findMany({
      where: { OR: prefixes.map((p) => ({ barcode: { startsWith: p } })) },
      select: { barcode: true },
    });
    const maxByPrefix = new Map<string, number>();
    for (const { barcode } of used) {
      const idx = barcode.lastIndexOf('-');
      const prefix = barcode.slice(0, idx + 1);
      const n = Number(barcode.slice(idx + 1));
      if (Number.isInteger(n))
        maxByPrefix.set(prefix, Math.max(maxByPrefix.get(prefix) ?? 0, n));
    }
    planned.forEach((item, i) => {
      const start = (maxByPrefix.get(prefixes[i]) ?? 0) + 1;
      for (let n = 0; n < item.count; n++)
        data.push({
          bookId: item.bookId,
          barcode: `${prefixes[i]}${start + n}`,
          shelfLocation: item.shelf,
        });
    });
    await tx.bookCopy.createMany({ data });
    return data.length;
  }
}
