import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { csvLine } from '../src/common/csv/csv-writer';
import { BookImportService } from '../src/modules/books/import/book-import.service';
import { IMPORT_COLUMNS } from '../src/modules/books/import/book-import.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL): kiểm cả SQL thô (khoá advisory, createManyAndReturn) lẫn ràng buộc duy nhất.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = Date.now().toString().slice(-6);
const SUFFIX = `${RUN}i@imp.local`;
const TITLE = `IMP ${RUN}`;
const CATEGORY = `IMP Cat ${RUN}`;

/** ISBN-13 hợp lệ tiền tố 979 từ số thứ tự. */
function isbn13(n: number): string {
  const body = `979${String(Number(RUN) * 1000 + n).padStart(9, '0')}`.slice(
    0,
    12,
  );
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + ((10 - (sum % 10)) % 10);
}

type Row = Partial<Record<(typeof IMPORT_COLUMNS)[number], string | number>>;
const toCsv = (rows: Row[]) =>
  Buffer.from(
    csvLine([...IMPORT_COLUMNS]) +
      rows.map((r) => csvLine(IMPORT_COLUMNS.map((c) => r[c] ?? ''))).join(''),
  );

describeWithDb('Nhập sách từ file (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let api: ReturnType<typeof request>;
  let auth: (t: string) => Record<string, string>;
  let lib: string;
  let reader: string;
  let importer: BookImportService;

  const upload = (
    buf: Buffer,
    filename: string,
    query = '',
    token: string | null = lib,
  ) => {
    const req = api.post(`/api/books/import-file${query}`);
    if (token) req.set(auth(token));
    return req.attach('file', buf, { filename });
  };
  const dry = (buf: Buffer, extra = '') =>
    upload(buf, 'a.csv', `?dryRun=true${extra}`);
  const real = (buf: Buffer, extra = '') =>
    upload(buf, 'a.csv', `?dryRun=false${extra}`);
  const countBooks = () =>
    prisma.book.count({ where: { title: { startsWith: TITLE } } });
  const countCopies = () =>
    prisma.bookCopy.count({
      where: { book: { title: { startsWith: TITLE } } },
    });

  beforeAll(async () => {
    const e = await createE2eApp();
    ({ app, prisma, auth } = e);
    api = e.http;
    importer = app.get(BookImportService);
    const librarian = await e.createUser(`lib${SUFFIX}`, Role.LIBRARIAN);
    const rd = await e.createUser(`rd${SUFFIX}`, Role.READER, {
      memberCode: `IMP${RUN}`,
    });
    lib = e.tokenFor(librarian);
    reader = e.tokenFor(rd);
  });

  afterAll(async () => {
    await cleanupE2eData(prisma, {
      emailSuffix: SUFFIX,
      bookTitlePrefix: TITLE,
    });
    await prisma.author.deleteMany({ where: { name: { contains: RUN } } });
    await prisma.category.deleteMany({ where: { slug: { contains: RUN } } });
    await prisma.category.deleteMany({
      where: { slug: 'chua-phan-loai', books: { none: {} } },
    });
    await app.close();
  });

  describe('quyền và file mẫu', () => {
    it('không token 401, bạn đọc 403, cho cả nhập và tải mẫu', async () => {
      expect((await upload(toCsv([]), 'a.csv', '', null)).status).toBe(401);
      expect((await upload(toCsv([]), 'a.csv', '', reader)).status).toBe(403);
      expect((await api.get('/api/books/import-template')).status).toBe(401);
      expect(
        (await api.get('/api/books/import-template').set(auth(reader))).status,
      ).toBe(403);
    });

    it('mẫu CSV: có BOM, đủ cột, dòng ví dụ; Content-Disposition có tên tiếng Việt', async () => {
      const res = await api
        .get('/api/books/import-template')
        .set(auth(lib))
        .buffer(true);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain(
        'filename="Mau_nhap_sach.csv"',
      );
      expect(res.headers['content-disposition']).toContain(
        "filename*=UTF-8''M%E1%BA%ABu",
      );
      const text = res.text;
      expect(text.charCodeAt(0)).toBe(0xfeff);
      expect(text.split('\r\n')[0].slice(1)).toBe(IMPORT_COLUMNS.join(','));
      expect(text.split('\r\n')).toHaveLength(3);
    });

    it('mẫu xlsx mở được, sheet đầu "Sách", ISBN là văn bản; có sheet hướng dẫn', async () => {
      const res = await api
        .get('/api/books/import-template?format=xlsx')
        .set(auth(lib))
        .buffer(true)
        .parse((r, cb) => {
          const c: Buffer[] = [];
          r.on('data', (d: Buffer) => c.push(d));
          r.on('end', () => cb(null, Buffer.concat(c)));
        });
      expect(res.status).toBe(200);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body as ExcelJS.Buffer);
      expect(wb.worksheets.map((w) => w.name)).toEqual(['Sách', 'Hướng dẫn']);
      expect(wb.worksheets[0].getRow(2).getCell(4).value).toBe('9780306406157');
      // và chính file mẫu nhập lại được qua API
      const preview = await upload(
        Buffer.from(res.body as Buffer),
        'mau.xlsx',
        '?dryRun=true',
      );
      expect(preview.status).toBe(200);
      expect(preview.body.fileType).toBe('xlsx');
      expect(preview.body.counts.error).toBe(0);
    });
  });

  describe('dryRun: xem trước, không ghi', () => {
    it('trả trạng thái từng dòng, đếm đúng, báo thể loại mới, và KHÔNG ghi gì', async () => {
      const dupIsbn = isbn13(1);
      await prisma.book.create({
        data: {
          title: `${TITLE} đã có`,
          isbn: dupIsbn,
          price: 1000,
          category: {
            create: { name: `${CATEGORY} cũ`, slug: `imp-cat-${RUN}-cu` },
          },
        },
      });
      const before = {
        books: await prisma.book.count(),
        cats: await prisma.category.count(),
        authors: await prisma.author.count(),
      };

      const file = toCsv([
        {
          title: `${TITLE} A`,
          authors: 'Tác giả Một; Tác giả Hai',
          category: `${CATEGORY} mới`,
          isbn: isbn13(2),
          price: 100000,
          copies: 2,
        }, // 2 ok + thể loại mới
        { title: `${TITLE} B`, isbn: isbn13(3) }, // cảnh báo thiếu tác giả/thể loại/giá
        { title: '', isbn: isbn13(4) }, // 4 lỗi: thiếu tiêu đề
        { title: `${TITLE} C`, isbn: '9780306406158' }, // 5 lỗi: sai chữ số kiểm
        { title: `${TITLE} D`, isbn: '12345' }, // 6 lỗi: sai độ dài
        { title: `${TITLE} E`, isbn: isbn13(2) }, // 7 lỗi: trùng ISBN trong file với dòng 2
        { title: `${TITLE} F`, isbn: dupIsbn }, // 8 trùng DB → skip
        { title: `${TITLE} G`, isbn: isbn13(5), price: 'abc' }, // 9 lỗi giá
        { title: `${TITLE} H`, isbn: isbn13(6), publishedYear: 3000 }, // 10 lỗi năm
        {
          title: `${TITLE} I`,
          isbn: isbn13(7),
          coverUrl: 'javascript:alert(1)',
        }, // 11 lỗi URL
        { title: `${TITLE} J`, isbn: isbn13(8), copies: 51 }, // 12 lỗi copies
        { title: `${TITLE} K`, isbn: isbn13(9), copies: 0 }, // 13 ok copies=0
      ]);
      const res = await dry(file);
      expect(res.status).toBe(200);
      const body = res.body;
      expect(body.dryRun).toBe(true);
      expect(body.totalRows).toBe(12);
      const byRow = Object.fromEntries(
        body.rows.map((r: { row: number }) => [r.row, r]),
      );
      expect(byRow[2]).toMatchObject({ status: 'warning', action: 'create' });
      expect(byRow[2].warnings.map((w: { code: string }) => w.code)).toContain(
        'CATEGORY_WILL_BE_CREATED',
      );
      expect(byRow[3].warnings.map((w: { code: string }) => w.code)).toEqual(
        expect.arrayContaining([
          'AUTHORS_MISSING',
          'CATEGORY_MISSING',
          'PRICE_MISSING',
        ]),
      );
      const errCode = (r: number) =>
        byRow[r].errors.map((e: { code: string }) => e.code);
      expect(errCode(4)).toEqual(['TITLE_REQUIRED']);
      expect(errCode(5)).toEqual(['ISBN_CHECKSUM']);
      expect(errCode(6)).toEqual(['ISBN_LENGTH']);
      expect(errCode(7)).toEqual(['DUPLICATE_IN_FILE']);
      expect(byRow[7].errors[0].message).toContain('dòng 2');
      expect(byRow[8]).toMatchObject({ status: 'warning', action: 'skip' });
      expect(byRow[8].warnings.map((w: { code: string }) => w.code)).toContain(
        'DUPLICATE_IN_DB',
      );
      expect(errCode(9)).toEqual(['PRICE_INVALID']);
      expect(errCode(10)).toEqual(['YEAR_RANGE']);
      expect(errCode(11)).toEqual(['COVER_URL_INVALID']);
      expect(errCode(12)).toEqual(['COPIES_RANGE']);
      expect(byRow[13]).toMatchObject({ action: 'create', copies: 0 });
      // dòng lỗi mang theo raw để tải CSV sửa lại
      expect(byRow[5].raw).toMatchObject({
        title: `${TITLE} C`,
        isbn: '9780306406158',
      });
      expect(byRow[2].raw).toBeUndefined();
      expect(body.counts).toMatchObject({
        error: 8,
        create: 3,
        skip: 1,
        update: 0,
      });
      expect(body.newCategories).toContain(`${CATEGORY} mới`);

      // KHÔNG ghi gì
      expect(await prisma.book.count()).toBe(before.books);
      expect(await prisma.category.count()).toBe(before.cats);
      expect(await prisma.author.count()).toBe(before.authors);
    });

    it('dryRun với onDuplicate=update báo action=update cho sách đã có', async () => {
      const res = await dry(
        toCsv([{ title: `${TITLE} đã có`, isbn: isbn13(1), price: 5000 }]),
        '&onDuplicate=update',
      );
      expect(res.body.rows[0]).toMatchObject({ action: 'update' });
      expect(res.body.counts.update).toBe(1);
    });
  });

  describe('ghi thật', () => {
    it('tạo sách, tác giả, thể loại, bản sao đúng định dạng LIB-<id 6 số>-<n>; lưu text thô, không chạy công thức', async () => {
      const file = toCsv([
        {
          title: `${TITLE} Giải tích`,
          authors: 'Nguyễn Văn Ký; Lê Thị Hoà',
          category: `${CATEGORY} Toán`,
          isbn: `${isbn13(20).slice(0, 3)}-${isbn13(20).slice(3)}`,
          publisher: 'NXB GD',
          publishedYear: 2021,
          price: '95.000',
          description: 'Mô tả dài',
          coverUrl: 'https://example.com/a.jpg',
          copies: 3,
          shelfLocation: 'Kệ A2-03',
        },
        {
          title: `${TITLE} =HYPERLINK("http://evil","x")`,
          authors: '=cmd|calc',
          isbn: isbn13(21),
          copies: 1,
        },
        { title: `${TITLE} không ISBN`, authors: 'Nguyễn Văn Ký' },
      ]);
      const res = await real(file);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        dryRun: false,
        created: 3,
        updated: 0,
        skipped: 0,
        createdCopies: 5,
      });
      expect(res.body.failed).toEqual([]);
      expect(res.body.newCategories).toEqual(
        expect.arrayContaining([`${CATEGORY} Toán`]),
      );

      const book = await prisma.book.findFirstOrThrow({
        where: { isbn: isbn13(20) },
        include: {
          authors: { include: { author: true } },
          copies: { orderBy: { barcode: 'asc' } },
          category: true,
        },
      });
      expect(book).toMatchObject({
        publisher: 'NXB GD',
        publishedYear: 2021,
        price: 95000,
        coverUrl: 'https://example.com/a.jpg',
      });
      expect(book.category.name).toBe(`${CATEGORY} Toán`);
      expect(book.authors.map((a) => a.author.name).sort()).toEqual([
        'Lê Thị Hoà',
        'Nguyễn Văn Ký',
      ]);
      const pad = String(book.id).padStart(6, '0');
      expect(book.copies.map((c) => c.barcode)).toEqual([
        `LIB-${pad}-1`,
        `LIB-${pad}-2`,
        `LIB-${pad}-3`,
      ]);
      expect(
        book.copies.every(
          (c) => c.shelfLocation === 'Kệ A2-03' && c.status === 'AVAILABLE',
        ),
      ).toBe(true);

      const formula = await prisma.book.findFirstOrThrow({
        where: { isbn: isbn13(21) },
      });
      expect(formula.title).toBe(`${TITLE} =HYPERLINK("http://evil","x")`); // lưu nguyên văn
      const noIsbn = await prisma.book.findFirstOrThrow({
        where: { title: `${TITLE} không ISBN` },
        include: { authors: { include: { author: true } }, copies: true },
      });
      expect(noIsbn.price).toBe(50000); // giá mặc định
      expect(noIsbn.copies).toHaveLength(1); // copies trống = 1
      // "Nguyễn Văn Ký" dùng lại cùng một tác giả, không nhân đôi
      expect(
        await prisma.author.count({ where: { name: 'Nguyễn Văn Ký' } }),
      ).toBe(1);
      expect(noIsbn.authors[0].author.name).toBe('Nguyễn Văn Ký');
    });

    it('idempotent: nhập lại đúng file đó không tạo thêm gì', async () => {
      const file = toCsv([
        {
          title: `${TITLE} Giải tích`,
          authors: 'Nguyễn Văn Ký; Lê Thị Hoà',
          category: `${CATEGORY} Toán`,
          isbn: isbn13(20),
          copies: 3,
        },
        { title: `${TITLE} không ISBN`, authors: 'Nguyễn Văn Ký' },
      ]);
      const books = await countBooks();
      const copies = await countCopies();
      const res = await real(file);
      expect(res.body).toMatchObject({
        created: 0,
        updated: 0,
        skipped: 2,
        createdCopies: 0,
      });
      expect(await countBooks()).toBe(books);
      expect(await countCopies()).toBe(copies);
    });

    it('nhận ra cùng một sách qua ISBN-10 và ISBN-13', async () => {
      // 979 không có dạng ISBN-10; dùng ISBN thật 0306406152 ↔ 9780306406157
      const res1 = await real(
        toCsv([{ title: `${TITLE} Dual ISBN`, isbn: '0306406152', copies: 1 }]),
      );
      expect(res1.body.created).toBe(1);
      const res2 = await real(
        toCsv([
          { title: `${TITLE} Dual ISBN`, isbn: '978-0-306-40615-7', copies: 1 },
        ]),
      );
      expect(res2.body).toMatchObject({ created: 0, skipped: 1 });
      expect(
        await prisma.book.count({ where: { title: `${TITLE} Dual ISBN` } }),
      ).toBe(1);
    });

    it('onDuplicate=update: cập nhật trường có giá trị, không xoá trường trống, bổ sung bản sao tới đủ số, lần hai không đổi gì', async () => {
      const isbn = isbn13(30);
      await real(
        toCsv([
          {
            title: `${TITLE} Cập nhật`,
            isbn,
            publisher: 'NXB Cũ',
            price: 10000,
            description: 'Mô tả giữ lại',
            copies: 1,
            category: `${CATEGORY} Toán`,
          },
        ]),
      );
      const book = await prisma.book.findFirstOrThrow({ where: { isbn } });

      const upd = toCsv([
        {
          title: `${TITLE} Cập nhật`,
          isbn,
          publisher: 'NXB Mới',
          price: 20000,
          copies: 3,
          shelfLocation: 'Kệ Z9',
          authors: 'Tác giả Mới ' + RUN,
        },
      ]);
      const r1 = await real(upd, '&onDuplicate=update');
      expect(r1.body).toMatchObject({
        created: 0,
        updated: 1,
        skipped: 0,
        createdCopies: 2,
      });
      const after = await prisma.book.findUniqueOrThrow({
        where: { id: book.id },
        include: {
          copies: { orderBy: { id: 'asc' } },
          authors: { include: { author: true } },
        },
      });
      expect(after).toMatchObject({
        publisher: 'NXB Mới',
        price: 20000,
        description: 'Mô tả giữ lại',
      });
      const pad = String(book.id).padStart(6, '0');
      expect(after.copies.map((c) => c.barcode)).toEqual([
        `LIB-${pad}-1`,
        `LIB-${pad}-2`,
        `LIB-${pad}-3`,
      ]);
      expect(after.copies[0].shelfLocation).toBeNull(); // bản sao cũ giữ nguyên
      expect(after.copies[2].shelfLocation).toBe('Kệ Z9');
      expect(after.authors.map((a) => a.author.name)).toEqual([
        `Tác giả Mới ${RUN}`,
      ]);

      const r2 = await real(upd, '&onDuplicate=update');
      expect(r2.body).toMatchObject({
        created: 0,
        updated: 0,
        skipped: 1,
        createdCopies: 0,
      });
      expect(await prisma.bookCopy.count({ where: { bookId: book.id } })).toBe(
        3,
      );
    });

    it('bản sao mới tiếp nối mã vạch lớn nhất, kể cả khi có lỗ hổng hoặc mã tạo tay', async () => {
      const isbn = isbn13(31);
      await real(toCsv([{ title: `${TITLE} Mã vạch`, isbn, copies: 2 }]));
      const book = await prisma.book.findFirstOrThrow({ where: { isbn } });
      const pad = String(book.id).padStart(6, '0');
      await prisma.bookCopy.deleteMany({
        where: { bookId: book.id, barcode: `LIB-${pad}-1` },
      });
      await prisma.bookCopy.create({
        data: { bookId: book.id, barcode: `LIB-${pad}-7` },
      });
      await real(
        toCsv([{ title: `${TITLE} Mã vạch`, isbn, copies: 5 }]),
        '&onDuplicate=update',
      );
      const codes = (
        await prisma.bookCopy.findMany({
          where: { bookId: book.id },
          orderBy: { id: 'asc' },
        })
      ).map((c) => c.barcode);
      expect(new Set(codes).size).toBe(codes.length);
      expect(codes).toEqual([
        `LIB-${pad}-2`,
        `LIB-${pad}-7`,
        `LIB-${pad}-8`,
        `LIB-${pad}-9`,
        `LIB-${pad}-10`,
      ]);
    });

    it('dòng lỗi vào danh sách failed (kèm raw), dòng tốt vẫn được nhập', async () => {
      const file = toCsv([
        { title: `${TITLE} Tốt 1`, isbn: isbn13(40) },
        { title: `${TITLE} Xấu`, isbn: '9780306406158' },
        { title: `${TITLE} Tốt 2`, isbn: isbn13(41) },
        {
          title: `${TITLE} Xấu URL`,
          isbn: isbn13(42),
          coverUrl: 'data:text/html,x',
        },
      ]);
      const res = await real(file);
      expect(res.body).toMatchObject({ created: 2, skipped: 0 });
      expect(res.body.failed).toHaveLength(2);
      expect(res.body.failed.map((f: { row: number }) => f.row)).toEqual([
        3, 5,
      ]);
      expect(res.body.failed[0]).toMatchObject({
        reason: expect.stringContaining('chữ số kiểm'),
        raw: { title: `${TITLE} Xấu` },
      });
      expect(
        await prisma.book.count({
          where: { isbn: { in: [isbn13(40), isbn13(41)] } },
        }),
      ).toBe(2);
      expect(await prisma.book.count({ where: { isbn: isbn13(42) } })).toBe(0);
    });

    it('lỗi DB ở một dòng trong lô: cả lô thử lại từng dòng, chỉ dòng hỏng bị báo', async () => {
      type Internals = { processBatch: (...a: unknown[]) => Promise<unknown> };
      // Lấy bản gốc TRƯỚC khi gắn spy, nếu không bản "gốc" chính là spy và gọi đệ quy mãi
      const real0 = (importer as unknown as Internals).processBatch.bind(
        importer,
      );
      const spy = jest.spyOn(importer as unknown as Internals, 'processBatch');
      spy.mockImplementation((...args: unknown[]) => {
        const rows = args[1] as { data: { title: string } }[];
        if (rows.some((r) => r.data.title.endsWith('POISON')))
          return Promise.reject(new Error('mô phỏng lỗi ghi'));
        return real0(...args);
      });
      try {
        const res = await real(
          toCsv([
            { title: `${TITLE} F1`, isbn: isbn13(50) },
            { title: `${TITLE} F2 POISON`, isbn: isbn13(51) },
            { title: `${TITLE} F3`, isbn: isbn13(52) },
          ]),
        );
        expect(res.body.created).toBe(2);
        expect(res.body.failed).toEqual([
          expect.objectContaining({
            row: 3,
            reason: expect.stringContaining('Không ghi được'),
          }),
        ]);
        expect(
          await prisma.book.count({
            where: { isbn: { in: [isbn13(50), isbn13(52)] } },
          }),
        ).toBe(2);
        expect(await prisma.book.count({ where: { isbn: isbn13(51) } })).toBe(
          0,
        );
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('đồng thời', () => {
    it('hai lần nhập song song cùng một file: mỗi ISBN đúng một sách, mã vạch không trùng, tổng created = số dòng', async () => {
      const rows: Row[] = Array.from({ length: 300 }, (_, i) => ({
        title: `${TITLE} Song song ${i}`,
        authors: `Tác giả chung ${RUN}; Tác giả nhóm ${RUN}-${i % 25}; Tác giả riêng ${RUN}-${i}`,
        category: `${CATEGORY} Song song`,
        isbn: isbn13(100 + i),
        copies: 2,
      }));
      const file = toCsv(rows);
      const runs = await Promise.all([
        real(file),
        real(file),
        real(file, '&onDuplicate=update'),
        real(file),
        real(file, '&onDuplicate=update'),
      ]);
      for (const r of runs) {
        expect(r.status).toBe(200);
        expect(r.body.failed).toEqual([]);
      }
      const created = runs.reduce((n, r) => n + r.body.created, 0);
      expect(created).toBe(300);

      const isbns = rows.map((r) => r.isbn as string);
      const books = await prisma.book.findMany({
        where: { isbn: { in: isbns } },
        include: { copies: true, authors: true },
      });
      expect(books).toHaveLength(300);
      for (const bk of books) {
        expect(bk.copies).toHaveLength(2); // không nhân đôi bản sao dù ba lần nhập
        expect(bk.authors).toHaveLength(3);
      }
      const barcodes = books.flatMap((bk) => bk.copies.map((cp) => cp.barcode));
      expect(new Set(barcodes).size).toBe(600);
      // tác giả dùng chung không bị tạo nhiều bản dù ba lần nhập chạy cùng lúc
      expect(
        await prisma.author.count({ where: { name: `Tác giả chung ${RUN}` } }),
      ).toBe(1);
      for (let g = 0; g < 25; g++)
        expect(
          await prisma.author.count({
            where: { name: `Tác giả nhóm ${RUN}-${g}` },
          }),
        ).toBe(1);
      expect(
        await prisma.category.count({
          where: { name: `${CATEGORY} Song song` },
        }),
      ).toBe(1);
    }, 60_000);

    it('nhiều file KHÁC NHAU cùng lúc dùng chung một tác giả mới: chỉ tạo đúng một tác giả (bảng authors không có ràng buộc duy nhất)', async () => {
      const files = Array.from({ length: 6 }, (_, f) =>
        toCsv(
          Array.from({ length: 150 }, (_, i) => ({
            title: `${TITLE} Khác file ${f}-${i}`,
            authors: `Tác giả dùng chung ${RUN}; Tác giả nhóm khác ${RUN}-${i % 10}`,
            isbn: isbn13(20000 + f * 150 + i),
          })),
        ),
      );
      const runs = await Promise.all(files.map((f) => real(f)));
      for (const r of runs) {
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ created: 150, failed: [] });
      }
      expect(
        await prisma.author.count({
          where: { name: `Tác giả dùng chung ${RUN}` },
        }),
      ).toBe(1);
      for (let g = 0; g < 10; g++)
        expect(
          await prisma.author.count({
            where: { name: `Tác giả nhóm khác ${RUN}-${g}` },
          }),
        ).toBe(1);
    }, 60_000);

    it('hai bản ghi cùng ISBN-10 / ISBN-13 gửi song song vẫn chỉ ra một sách', async () => {
      const f10 = toCsv([{ title: `${TITLE} Race ISBN`, isbn: '0306406152' }]);
      const f13 = toCsv([
        { title: `${TITLE} Race ISBN`, isbn: '9780306406157' },
      ]);
      const bookBefore = await prisma.book.count({
        where: { isbn: { in: ['0306406152', '9780306406157'] } },
      });
      expect(bookBefore).toBe(1); // đã tạo ở ca ISBN-10/13 phía trên
      await Promise.all([real(f10), real(f13), real(f10), real(f13)]);
      expect(
        await prisma.book.count({
          where: { isbn: { in: ['0306406152', '9780306406157'] } },
        }),
      ).toBe(1);
    });
  });

  describe('file hỏng và giới hạn', () => {
    const err = async (res: request.Test, status: number, code: string) => {
      const r = await res;
      expect(r.status).toBe(status);
      expect(r.body.error).toBe(code);
      expect(r.headers['content-type']).toContain('application/json');
    };
    const before = () => countBooks();

    it('không đính kèm file → 400 IMPORT_NO_FILE', async () => {
      await err(
        api.post('/api/books/import-file').set(auth(lib)).send({}),
        400,
        'IMPORT_NO_FILE',
      );
    });

    it('PDF đội lốt .csv / .xlsx → 415', async () => {
      const pdf = Buffer.from('%PDF-1.7\n1 0 obj <<>> endobj');
      await err(
        upload(pdf, 'sach.csv', '?dryRun=true'),
        415,
        'IMPORT_FILE_TYPE_INVALID',
      );
      await err(
        upload(pdf, 'sach.xlsx', '?dryRun=true'),
        415,
        'IMPORT_FILE_TYPE_INVALID',
      );
    });

    it('đuôi không cho phép (.exe, .xls, .xlsm, .html) → 415', async () => {
      const text = toCsv([{ title: 'x' }]);
      for (const name of ['a.exe', 'a.xls', 'a.xlsm', 'a.html'])
        await err(
          upload(text, name, '?dryRun=true'),
          415,
          'IMPORT_FILE_TYPE_INVALID',
        );
    });

    it('xlsx có macro → 415 IMPORT_MACRO_NOT_ALLOWED', async () => {
      const macro = Buffer.from(
        zipSync({
          '[Content_Types].xml': strToU8('<Types/>'),
          'xl/workbook.xml': strToU8('<workbook/>'),
          'xl/vbaProject.bin': new Uint8Array([1, 2]),
        }),
      );
      await err(
        upload(macro, 'a.xlsx', '?dryRun=true'),
        415,
        'IMPORT_MACRO_NOT_ALLOWED',
      );
    });

    it('file > 5 MB → 413', async () => {
      const big = Buffer.alloc(5 * 1024 * 1024 + 1024, 'a');
      const r = await upload(big, 'a.csv', '?dryRun=true');
      expect(r.status).toBe(413);
    });

    it('xlsx kiểu zip bomb (nén nhỏ, giải nén khổng lồ) → 413, server không treo', async () => {
      const bomb = Buffer.from(
        zipSync({
          '[Content_Types].xml': strToU8('<Types/>'),
          'xl/workbook.xml': strToU8(
            '<workbook xmlns:r="r"><sheets><sheet name="S" r:id="rId1"/></sheets></workbook>',
          ),
          'xl/_rels/workbook.xml.rels': strToU8(
            '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
          ),
          'xl/worksheets/sheet1.xml': new Uint8Array(40 * 1024 * 1024).fill(
            0x20,
          ),
        }),
      );
      expect(bomb.length).toBeLessThan(1024 * 1024);
      const started = Date.now();
      await err(
        upload(bomb, 'a.xlsx', '?dryRun=true'),
        413,
        'IMPORT_FILE_TOO_LARGE',
      );
      expect(Date.now() - started).toBeLessThan(10_000);
    }, 30_000);

    it('CSV hỏng, thiếu cột title, quá 5000 dòng, rỗng → 422', async () => {
      await err(
        upload(Buffer.from('title,authors\n"A,B\nC'), 'a.csv', '?dryRun=true'),
        422,
        'IMPORT_MALFORMED',
      );
      await err(
        upload(Buffer.from('authors\nx'), 'a.csv', '?dryRun=true'),
        422,
        'IMPORT_MISSING_COLUMN',
      );
      await err(
        upload(Buffer.from(''), 'a.csv', '?dryRun=true'),
        422,
        'IMPORT_EMPTY',
      );
      const many = Buffer.from(
        'title\n' + Array.from({ length: 5001 }, (_, i) => `s${i}`).join('\n'),
      );
      await err(
        upload(many, 'a.csv', '?dryRun=true'),
        422,
        'IMPORT_TOO_MANY_ROWS',
      );
      await err(
        upload(
          Buffer.concat([
            Buffer.from('title\n'),
            Buffer.from([0x53, 0xe1, 0xff]),
          ]),
          'a.csv',
          '?dryRun=true',
        ),
        422,
        'IMPORT_ENCODING',
      );
    });

    it('tham số sai → 400; không có file nào ghi vào DB sau tất cả các ca lỗi', async () => {
      expect((await upload(toCsv([]), 'a.csv', '?dryRun=maybe')).status).toBe(
        400,
      );
      expect(
        (await upload(toCsv([]), 'a.csv', '?onDuplicate=delete')).status,
      ).toBe(400);
      expect((await upload(toCsv([]), 'a.csv', '?foo=1')).status).toBe(400);
      const stable = await before();
      expect(await countBooks()).toBe(stable);
    });

    it('đúng 5000 dòng vẫn nhận, nhập thật trong thời gian hợp lý', async () => {
      const rows: Row[] = Array.from({ length: 5000 }, (_, i) => ({
        title: `${TITLE} Lớn ${i}`,
        authors: `Tác giả lớn ${RUN}-${i % 200}`,
        category: `${CATEGORY} Lớn ${i % 7}`,
        isbn: isbn13(1000 + i),
        copies: 1,
      }));
      const file = toCsv(rows);
      const dryStarted = Date.now();
      const preview = await dry(file);
      expect(preview.status).toBe(200);
      expect(preview.body.counts.error).toBe(0);
      expect(preview.body.counts.create).toBe(5000);
      const dryMs = Date.now() - dryStarted;

      const started = Date.now();
      const res = await real(file);
      const ms = Date.now() - started;
      console.log(`import 5000 dòng: dryRun ${dryMs}ms, ghi thật ${ms}ms`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ created: 5000, createdCopies: 5000 });
      expect(res.body.failed).toEqual([]);
      expect(ms).toBeLessThan(90_000);
      // lần hai: toàn bộ bị bỏ qua
      const again = await real(file);
      expect(again.body).toMatchObject({ created: 0, skipped: 5000 });
    }, 240_000);
  });
});
