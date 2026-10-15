import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as http from 'http';
import request from 'supertest';
import { parseCsv } from '../src/common/csv/csv-parser';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL). Mỗi ca kiểm đường xuất đi qua đúng controller + Prisma + sink thật.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}x`;
const SUFFIX = `${RUN}@exp.local`;
const TITLE = `EXP ${RUN}`;
const HOUR = 60 * 60 * 1000;
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

interface Download {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

describeWithDb('Xuất CSV / Excel (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let api: ReturnType<typeof request>;
  let auth: (t: string) => Record<string, string>;
  let lib: string;
  let reader: string;
  let librarianId: number;
  let readerId: number;
  let categoryId: number;
  let copyId: number;
  let copy2Id: number;
  const books: number[] = [];

  /** Tải về nguyên dạng nhị phân để kiểm cả BOM lẫn xlsx. */
  const download = async (
    path: string,
    token: string | null = lib,
  ): Promise<Download> => {
    const req = api.get(path);
    if (token) req.set(auth(token));
    const res = await req.buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    return {
      status: res.status,
      headers: res.headers as Record<string, string>,
      body: res.body as Buffer,
    };
  };
  const csvRows = (d: Download) => parseCsv(d.body.toString('utf8'));
  const loadXlsx = async (d: Download) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(d.body as unknown as ExcelJS.Buffer);
    return wb.worksheets[0];
  };

  const loanAt = (
    cId: number,
    borrowedAt: Date,
    extra: { status?: 'ACTIVE' | 'RETURNED'; dueAt?: Date } = {},
  ) =>
    prisma.loan.create({
      data: {
        copyId: cId,
        userId: readerId,
        createdById: librarianId,
        borrowedAt,
        dueAt: extra.dueAt ?? new Date(borrowedAt.getTime() + 14 * 24 * HOUR),
        status: extra.status ?? 'RETURNED',
        returnedAt: extra.status === 'ACTIVE' ? null : borrowedAt,
      },
    });

  beforeAll(async () => {
    const e = await createE2eApp();
    ({ app, prisma, auth } = e);
    api = e.http;
    await e.ensureStudentPolicy();
    const librarian = await e.createUser(`lib${SUFFIX}`, Role.LIBRARIAN);
    const rd = await e.createUser(`rd${SUFFIX}`, Role.READER, {
      memberCode: `EXP${RUN}`,
      fullName: `=cmd|' /C calc'!A0 ${RUN}`,
    });
    librarianId = librarian.id;
    readerId = rd.id;
    lib = e.tokenFor(librarian);
    reader = e.tokenFor(rd);
    categoryId = (
      await prisma.category.create({
        data: { name: `EXP Cat ${RUN}`, slug: `exp-cat-${RUN}` },
      })
    ).id;
    const mk = async (title: string, price: number, copies: number) => {
      const b = await prisma.book.create({
        data: {
          title,
          price,
          categoryId,
          isbn: null,
          copies: {
            create: Array.from({ length: copies }, (_, i) => ({
              barcode: `EXP-${RUN}-${books.length}-${i}`,
              shelfLocation: 'Kệ A1',
            })),
          },
        },
        include: { copies: { orderBy: { id: 'asc' } } },
      });
      books.push(b.id);
      return b;
    };
    const b1 = await mk(`${TITLE} bình thường`, 120_000, 2);
    copyId = b1.copies[0].id;
    copy2Id = b1.copies[1].id;
    await mk(`=HYPERLINK("http://evil","x") ${TITLE}`, 50_000, 1);
    await mk(`+cmd ${TITLE}`, 1, 1);
    await mk(`-1+1 ${TITLE}`, 1, 1);
    await mk(`@SUM(A1) ${TITLE}`, 1, 1);
    await mk(`${TITLE} có "ngoặc kép", dấu phẩy\nvà xuống dòng`, 99_000, 1);
  });

  afterAll(async () => {
    await cleanupE2eData(prisma, {
      emailSuffix: SUFFIX,
      bookTitlePrefix: TITLE,
    });
    // Sách có tiêu đề bắt đầu bằng ký tự công thức không khớp tiền tố TITLE
    await prisma.bookCopy.deleteMany({
      where: { barcode: { startsWith: `EXP-${RUN}-` } },
    });
    await prisma.book.deleteMany({ where: { id: { in: books } } });
    await prisma.category.deleteMany({ where: { slug: { contains: RUN } } });
    await app.close();
  });

  describe('quyền truy cập', () => {
    const endpoints = [
      'overdue-loans',
      'loans',
      'top-books',
      'inventory',
      'fines',
      'readers',
      'books',
    ];
    it.each(endpoints)(
      '/exports/%s: không token → 401, bạn đọc → 403',
      async (name) => {
        expect((await download(`/api/exports/${name}`, null)).status).toBe(401);
        expect((await download(`/api/exports/${name}`, reader)).status).toBe(
          403,
        );
      },
    );

    it.each(endpoints)(
      '/exports/%s: thủ thư tải được cả CSV và xlsx',
      async (name) => {
        const csv = await download(`/api/exports/${name}?format=csv`);
        expect(csv.status).toBe(200);
        expect(csv.headers['content-type']).toContain('text/csv');
        const xlsx = await download(`/api/exports/${name}?format=xlsx`);
        expect(xlsx.status).toBe(200);
        expect(xlsx.headers['content-type']).toContain(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        expect(xlsx.body.subarray(0, 2).toString()).toBe('PK');
      },
    );
  });

  describe('định dạng CSV', () => {
    it('có BOM UTF-8, tiêu đề cột tiếng Việt, Content-Disposition có cả bản ASCII lẫn UTF-8', async () => {
      const d = await download(
        `/api/exports/books?q=${encodeURIComponent(TITLE)}`,
      );
      expect(d.body.subarray(0, 3).equals(BOM)).toBe(true);
      const rows = csvRows(d);
      expect(rows[0]).toEqual([
        'Mã sách',
        'ISBN',
        'Tiêu đề',
        'Tác giả',
        'Thể loại',
        'Nhà xuất bản',
        'Năm xuất bản',
        'Giá bìa (VND)',
        'Tổng bản sao',
        'Còn sẵn',
      ]);
      const cd = d.headers['content-disposition'];
      expect(cd).toMatch(
        /^attachment; filename="Danh_muc_sach_\d{8}-\d{4}\.csv"; filename\*=UTF-8''Danh%20m%E1%BB%A5c%20s%C3%A1ch/,
      );
      expect(d.headers['cache-control']).toBe('no-store');
      expect(d.headers['x-content-type-options']).toBe('nosniff');
      expect(d.headers['x-export-truncated']).toBe('false');
      expect(Number(d.headers['x-total-count'])).toBe(rows.length - 1);
    });

    it('chống CSV injection: mọi ô văn bản bắt đầu bằng = + - @ đều có dấu nháy đứng trước', async () => {
      const d = await download(
        `/api/exports/books?q=${encodeURIComponent(TITLE)}`,
      );
      const titles = csvRows(d)
        .slice(1)
        .map((r) => r[2]);
      expect(titles).toEqual(
        expect.arrayContaining([
          `'=HYPERLINK("http://evil","x") ${TITLE}`,
          `'+cmd ${TITLE}`,
          `'-1+1 ${TITLE}`,
          `'@SUM(A1) ${TITLE}`,
          // ô có ngoặc kép, dấu phẩy, xuống dòng đọc lại nguyên vẹn
          `${TITLE} có "ngoặc kép", dấu phẩy\nvà xuống dòng`,
        ]),
      );
      for (const t of titles) expect(/^[=+\-@\t\r]/.test(t)).toBe(false);
    });

    it('tên bạn đọc dạng công thức cũng bị vô hiệu hoá trong danh sách bạn đọc', async () => {
      const d = await download(`/api/exports/readers?q=${RUN}`);
      const rows = csvRows(d);
      expect(rows).toHaveLength(2);
      expect(rows[1][0]).toBe(`EXP${RUN}`);
      expect(rows[1][1].startsWith("'=cmd")).toBe(true);
    });

    it('số tiền và số lượng là chữ số trần (không định dạng ngàn) trong CSV', async () => {
      const d = await download(
        `/api/exports/books?q=${encodeURIComponent(`${TITLE} bình thường`)}`,
      );
      const row = csvRows(d)[1];
      expect(row[7]).toBe('120000');
      expect(row[8]).toBe('2');
      expect(row[9]).toBe('2');
    });
  });

  describe('định dạng xlsx', () => {
    it('ô số là số thật, tiền có định dạng VND, tên sheet và hàng tiêu đề đúng', async () => {
      const ws = await loadXlsx(
        await download(
          `/api/exports/books?format=xlsx&q=${encodeURIComponent(`${TITLE} bình thường`)}`,
        ),
      );
      expect(ws.name).toBe('Danh mục sách');
      expect(ws.getRow(1).getCell(3).value).toBe('Tiêu đề');
      const row = ws.getRow(2);
      expect(typeof row.getCell(8).value).toBe('number');
      expect(row.getCell(8).value).toBe(120000);
      expect(row.getCell(8).numFmt).toContain('#,##0');
      expect(row.getCell(9).value).toBe(2);
      expect(ws.rowCount).toBe(2);
    });

    it('ngày ghi thành ô ngày thật theo giờ thư viện UTC+7', async () => {
      // 2001-05-10T17:30Z = 11/05/2001 00:30 giờ địa phương
      await loanAt(copyId, new Date('2001-05-10T17:30:00Z'));
      const ws = await loadXlsx(
        await download(
          '/api/exports/loans?format=xlsx&from=2001-05-11&to=2001-05-11',
        ),
      );
      const rows: ExcelJS.Row[] = [];
      ws.eachRow((r, n) => n > 1 && rows.push(r));
      const mine = rows.filter(
        (r) => String(r.getCell(2).value) === `EXP${RUN}`,
      );
      expect(mine).toHaveLength(1);
      const borrowed = mine[0].getCell(6).value;
      expect(borrowed).toBeInstanceOf(Date);
      // Giờ treo tường: ô hiển thị 11/05/2001 00:30, tức UTC của ô là 00:30 ngày 11
      expect((borrowed as Date).toISOString()).toBe('2001-05-11T00:30:00.000Z');
      expect(mine[0].getCell(6).numFmt).toBe('dd/mm/yyyy hh:mm');
    });
  });

  describe('bộ lọc và ranh giới ngày theo giờ thư viện', () => {
    beforeAll(async () => {
      // Năm 1999 để không lẫn dữ liệu nơi khác. UTC+7:
      // 16:59:59.999Z ngày 01/03 = 23:59:59.999 ngày 01/03; 17:00:00.000Z = 00:00 ngày 02/03
      await loanAt(copyId, new Date('1999-03-01T16:59:59.999Z'));
      await loanAt(copyId, new Date('1999-03-01T17:00:00.000Z'));
      await loanAt(copy2Id, new Date('1999-03-02T16:59:59.999Z'));
      await loanAt(copy2Id, new Date('1999-03-02T17:00:00.000Z'));
    });

    const loanIdsOf = (d: Download) =>
      csvRows(d)
        .slice(1)
        .filter((r) => r[1] === `EXP${RUN}`)
        .map((r) => r[5].slice(0, 16));

    it('from=to=ngày 02/03 lấy đúng các phiếu từ 00:00 đến 23:59:59 ngày 02/03 giờ địa phương', async () => {
      const d = await download(
        '/api/exports/loans?from=1999-03-02&to=1999-03-02',
      );
      expect(loanIdsOf(d)).toEqual(['1999-03-02 00:00', '1999-03-02 23:59']);
    });

    it('to=ngày 01/03 gồm cả 23:59:59.999 nhưng loại 00:00 ngày kế', async () => {
      const d = await download(
        '/api/exports/loans?from=1999-03-01&to=1999-03-01',
      );
      expect(loanIdsOf(d)).toEqual(['1999-03-01 23:59']);
    });

    it('chỉ from (không to) và chỉ to (không from)', async () => {
      const from = await download('/api/exports/loans?from=1999-03-02');
      expect(loanIdsOf(from)).toEqual(
        expect.arrayContaining(['1999-03-02 00:00']),
      );
      expect(loanIdsOf(from)).not.toContain('1999-03-01 23:59');
      const to = await download('/api/exports/loans?to=1999-03-01');
      expect(loanIdsOf(to)).toContain('1999-03-01 23:59');
      expect(loanIdsOf(to)).not.toContain('1999-03-02 00:00');
    });

    it('lọc theo trạng thái và quá hạn', async () => {
      const longAgo = new Date('1998-01-01T00:00:00Z');
      await loanAt(copy2Id, longAgo, { status: 'ACTIVE' });
      const overdue = await download('/api/exports/overdue-loans');
      const mine = csvRows(overdue)
        .slice(1)
        .filter((r) => r[1] === `EXP${RUN}`);
      expect(mine).toHaveLength(1);
      expect(Number(mine[0][8])).toBeGreaterThan(1000);
      // phạt = số ngày trễ x 5000 (chính sách chuẩn của test)
      expect(Number(mine[0][9])).toBe(Number(mine[0][8]) * 5000);

      const active = await download(
        '/api/exports/loans?status=ACTIVE&from=1998-01-01&to=1998-01-01',
      );
      expect(
        csvRows(active)
          .slice(1)
          .filter((r) => r[1] === `EXP${RUN}`),
      ).toHaveLength(1);
      const returned = await download(
        '/api/exports/loans?status=RETURNED&from=1998-01-01&to=1998-01-01',
      );
      expect(
        csvRows(returned)
          .slice(1)
          .filter((r) => r[1] === `EXP${RUN}`),
      ).toHaveLength(0);
      const flagged = await download(
        '/api/exports/loans?overdue=true&userId=' + readerId,
      );
      expect(csvRows(flagged)).toHaveLength(2); // tiêu đề + đúng 1 phiếu quá hạn của bạn đọc này
    });

    it('khoản phạt: lọc đã thu / chưa thu và khoảng ngày phát sinh', async () => {
      const loan = (await loanAt(copyId, new Date('1997-06-01T00:00:00Z'))).id;
      await prisma.fine.create({
        data: {
          loanId: loan,
          type: 'OVERDUE',
          amount: 15_000,
          createdAt: new Date('1997-06-10T10:00:00Z'),
        },
      });
      await prisma.fine.create({
        data: {
          loanId: loan,
          type: 'LOST',
          amount: 200_000,
          createdAt: new Date('1997-06-20T10:00:00Z'),
          paidAt: new Date('1997-06-21T10:00:00Z'),
          paidToId: librarianId,
        },
      });
      const base = `/api/exports/fines?userId=${readerId}`;
      const all = csvRows(
        await download(`${base}&from=1997-06-01&to=1997-06-30`),
      );
      expect(all).toHaveLength(3);
      const unpaid = csvRows(
        await download(`${base}&paid=false&from=1997-06-01&to=1997-06-30`),
      );
      expect(unpaid).toHaveLength(2);
      expect(unpaid[1].slice(5, 11)).toEqual([
        'Trả trễ',
        '15000',
        '1997-06-10 17:00',
        'Chưa thu',
        '',
        '',
      ]);
      const paid = csvRows(
        await download(`${base}&paid=true&from=1997-06-01&to=1997-06-30`),
      );
      expect(paid).toHaveLength(2);
      expect(paid[1][5]).toBe('Mất sách');
      expect(paid[1][8]).toBe('Đã thu');
      expect(paid[1][10]).toBe(`lib${SUFFIX}`);
      const narrow = csvRows(
        await download(`${base}&from=1997-06-15&to=1997-06-30`),
      );
      expect(narrow).toHaveLength(2);
      expect(narrow[1][5]).toBe('Mất sách');
    });

    it('bạn đọc: lọc q / isActive, đếm số sách đang mượn và quá hạn', async () => {
      const found = csvRows(
        await download(`/api/exports/readers?q=${RUN}&isActive=true`),
      );
      expect(found).toHaveLength(2);
      expect(Number(found[1][6])).toBe(1); // 1 phiếu ACTIVE (1998)
      expect(Number(found[1][7])).toBe(1);
      const none = csvRows(
        await download(`/api/exports/readers?q=${RUN}&isActive=false`),
      );
      expect(none).toHaveLength(1);
    });

    it('danh mục sách: lọc theo thể loại và còn bản mượn được, số bản sao đúng', async () => {
      const d = await download(`/api/exports/books?categoryId=${categoryId}`);
      const rows = csvRows(d).slice(1);
      expect(rows).toHaveLength(books.length);
      const normal = rows.find((r) => r[2] === `${TITLE} bình thường`)!;
      expect(normal[8]).toBe('2');
      expect(normal[9]).toBe('2');
      await prisma.bookCopy.updateMany({
        where: { bookId: books[2] },
        data: { status: 'LOST' },
      });
      const avail = csvRows(
        await download(
          `/api/exports/books?categoryId=${categoryId}&available=true`,
        ),
      );
      expect(avail).toHaveLength(books.length); // tiêu đề + (n - 1 sách hết bản)
    });

    it('top sách và tồn kho trả đúng cột', async () => {
      const top = csvRows(
        await download(
          '/api/exports/top-books?limit=5&from=1999-03-01&to=1999-03-02',
        ),
      );
      expect(top[0]).toEqual([
        'Hạng',
        'Mã sách',
        'Tiêu đề',
        'Tác giả',
        'ISBN',
        'Thể loại',
        'Số lượt mượn',
      ]);
      const mine = top.find((r) => r[2] === `${TITLE} bình thường`)!;
      expect(mine[0]).toBe('1');
      expect(mine[6]).toBe('3');
      const inv = csvRows(await download('/api/exports/inventory'));
      expect(inv[0][0]).toBe('Thể loại');
      expect(inv.find((r) => r[0] === `EXP Cat ${RUN}`)).toBeDefined();
    });
  });

  describe('đầu vào sai', () => {
    it.each([
      ['/api/exports/loans?from=2026-02-31', 'ngày không có thật'],
      ['/api/exports/loans?from=2026-05-02&to=2026-05-01', 'ngày đảo ngược'],
      ['/api/exports/loans?format=pdf', 'định dạng lạ'],
      ['/api/exports/loans?foo=bar', 'tham số lạ'],
      ['/api/exports/loans?status=NOPE', 'trạng thái lạ'],
      ['/api/exports/top-books?limit=5000', 'limit quá lớn'],
      ['/api/exports/fines?userId=99999999999', 'id tràn INT4'],
      ['/api/exports/books?categoryId=abc', 'id không phải số'],
    ])('%s (%s) → 400 JSON, không phải file', async (url) => {
      const res = await api.get(url).set(auth(lib));
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body.message).toBeDefined();
    });
  });

  describe('xuất lượng lớn', () => {
    const BIG = 30_000;

    beforeAll(async () => {
      await prisma.$executeRaw`
        INSERT INTO loans (copy_id, user_id, created_by, borrowed_at, due_at, returned_at, status)
        SELECT ${copyId}, ${readerId}, ${librarianId},
               TIMESTAMP '1990-01-01' + (g * interval '1 minute'),
               TIMESTAMP '1990-01-15' + (g * interval '1 minute'),
               TIMESTAMP '1990-01-02' + (g * interval '1 minute'),
               'RETURNED'
        FROM generate_series(1, ${BIG}) g`;
    });

    it('CSV 30.000 dòng được phát theo lô (không Content-Length) và đủ từng dòng', async () => {
      const started = Date.now();
      const d = await download(
        `/api/exports/loans?userId=${readerId}&from=1990-01-01&to=1990-12-31`,
      );
      expect(d.status).toBe(200);
      expect(d.headers['content-length']).toBeUndefined();
      expect(d.headers['transfer-encoding']).toBe('chunked');
      expect(d.headers['x-total-count']).toBe(String(BIG));
      const rows = csvRows(d);
      expect(rows).toHaveLength(BIG + 1);
      expect(new Set(rows.slice(1).map((r) => r[0])).size).toBe(BIG); // không trùng, không thiếu mã phiếu
      expect(Date.now() - started).toBeLessThan(30_000);
    }, 60_000);

    it('xlsx 30.000 dòng mở lại được và đủ dòng', async () => {
      const d = await download(
        `/api/exports/loans?format=xlsx&userId=${readerId}&from=1990-01-01&to=1990-12-31`,
      );
      expect(d.status).toBe(200);
      const ws = await loadXlsx(d);
      expect(ws.rowCount).toBe(BIG + 1);
    }, 90_000);

    it('người dùng đóng kết nối giữa chừng: server không treo và vẫn phục vụ tiếp', async () => {
      const server = app.getHttpServer() as http.Server;
      await new Promise<void>((r) => server.listen(0, r));
      const port = (server.address() as { port: number }).port;
      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          {
            port,
            host: '127.0.0.1',
            path: `/api/exports/loans?userId=${readerId}&from=1990-01-01&to=1990-12-31`,
            headers: auth(lib),
          },
          (res) => {
            res.once('data', () => {
              req.destroy();
              resolve();
            });
          },
        );
        req.on('error', () => resolve());
        setTimeout(() => reject(new Error('không nhận được byte nào')), 20_000);
      });
      const after = await download('/api/exports/inventory');
      expect(after.status).toBe(200);
    }, 40_000);
  });
});
