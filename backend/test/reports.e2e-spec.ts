import { INestApplication } from '@nestjs/common';
import { CopyStatus, LoanStatus, Role } from '@prisma/client';
import request from 'supertest';
import {
  LIBRARY_UTC_OFFSET_MINUTES,
  overdueCutoff,
} from '../src/common/date.util';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
// Báo cáo giờ gộp bằng SQL: các ca này kiểm đúng câu SQL đó, đặc biệt ranh giới ngày / tháng theo giờ thư viện.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}p`;
const SUFFIX = `${RUN}@rep.local`;
const TITLE = `REP ${RUN}`;
const HOUR = 60 * 60 * 1000;
const OFFSET_MS = LIBRARY_UTC_OFFSET_MINUTES * 60 * 1000;

describeWithDb('Báo cáo gộp bằng SQL (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let auth: (t: string) => Record<string, string>;
  let lib: string;
  let librarianId: number;
  let readerId: number;
  let categoryId: number;
  const books: { id: number; copyIds: number[] }[] = [];

  async function makeBook(copies: number, tag: string) {
    const book = await prisma.book.create({
      data: {
        title: `${TITLE} ${tag}`,
        price: 1000,
        categoryId,
        copies: {
          create: Array.from({ length: copies }, (_, i) => ({
            barcode: `REP-${RUN}-${tag}-${i}`,
          })),
        },
      },
      include: { copies: { orderBy: { id: 'asc' } } },
    });
    const out = { id: book.id, copyIds: book.copies.map((c) => c.id) };
    books.push(out);
    return out;
  }
  const loanAt = (copyId: number, borrowedAt: Date, status = 'RETURNED') =>
    prisma.loan.create({
      data: {
        copyId,
        userId: readerId,
        createdById: librarianId,
        borrowedAt,
        dueAt: new Date(borrowedAt.getTime() + 14 * 24 * HOUR),
        status: status as LoanStatus,
        returnedAt: status === 'RETURNED' ? borrowedAt : null,
      },
    });
  const monthKey = (utcMs: number) => {
    const d = new Date(utcMs + OFFSET_MS);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  beforeAll(async () => {
    const e = await createE2eApp();
    ({ app, prisma, http, auth } = e);
    await e.ensureStudentPolicy();
    const librarian = await e.createUser(`lib${SUFFIX}`, Role.LIBRARIAN);
    librarianId = librarian.id;
    lib = e.tokenFor(librarian);
    readerId = (
      await e.createUser(`rd${SUFFIX}`, Role.READER, {
        memberCode: `REP${RUN}`,
      })
    ).id;
    categoryId = (
      await prisma.category.create({
        data: { name: `REP Cat ${RUN}`, slug: `rep-cat-${RUN}` },
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupE2eData(prisma, {
      emailSuffix: SUFFIX,
      bookTitlePrefix: TITLE,
    });
    await prisma.category.deleteMany({ where: { slug: { contains: RUN } } });
    await app.close();
  });

  describe('top-books', () => {
    it('ranks by loans, breaks ties by book id, and an inclusive `to` date covers the whole library day', async () => {
      const a = await makeBook(1, 'A');
      const b = await makeBook(1, 'B');
      const c = await makeBook(1, 'C');
      // Năm 2000 để không lẫn dữ liệu khác. Giờ thư viện = UTC+7.
      // 14/03 18:00Z = 15/03 01:00 địa phương; 15/03 16:59Z = 15/03 23:59; 15/03 17:00Z = 16/03 00:00.
      await loanAt(a.copyIds[0], new Date('2000-03-14T18:00:00Z'));
      await loanAt(a.copyIds[0], new Date('2000-03-15T16:59:00Z'));
      await loanAt(a.copyIds[0], new Date('2000-03-15T17:00:00Z')); // ngày 16
      await loanAt(b.copyIds[0], new Date('2000-03-15T05:00:00Z'));
      await loanAt(b.copyIds[0], new Date('2000-03-15T06:00:00Z'));
      await loanAt(c.copyIds[0], new Date('2000-03-15T07:00:00Z'));
      await loanAt(c.copyIds[0], new Date('2000-03-15T08:00:00Z'));

      const day15 = await http
        .get('/api/reports/top-books?limit=50&from=2000-03-15&to=2000-03-15')
        .set(auth(lib))
        .expect(200);
      const mine15 = day15.body.filter((r: { book: { id: number } }) =>
        [a.id, b.id, c.id].includes(r.book.id),
      );
      // ngày 15 địa phương: A có 2 (01:00 và 23:59), B 2, C 2 → hoà, xếp theo id sách
      expect(
        mine15.map((r: { book: { id: number }; loanCount: number }) => [
          r.book.id,
          r.loanCount,
        ]),
      ).toEqual([
        [a.id, 2],
        [b.id, 2],
        [c.id, 2],
      ]);

      const day16 = await http
        .get('/api/reports/top-books?limit=50&from=2000-03-16&to=2000-03-16')
        .set(auth(lib))
        .expect(200);
      const mine16 = day16.body.filter((r: { book: { id: number } }) =>
        [a.id, b.id, c.id].includes(r.book.id),
      );
      expect(mine16).toHaveLength(1);
      expect(mine16[0]).toMatchObject({ book: { id: a.id }, loanCount: 1 });

      const both = await http
        .get('/api/reports/top-books?limit=50&from=2000-03-15&to=2000-03-16')
        .set(auth(lib))
        .expect(200);
      expect(
        both.body.find((r: { book: { id: number } }) => r.book.id === a.id)
          .loanCount,
      ).toBe(3);
    });

    it('rejects dates that do not exist instead of silently shifting them', async () => {
      await http
        .get('/api/reports/top-books?from=2026-02-31')
        .set(auth(lib))
        .expect(400);
      await http
        .get('/api/reports/top-books?to=not-a-date')
        .set(auth(lib))
        .expect(400);
    });
  });

  describe('loans-by-month', () => {
    it('buckets loans by LIBRARY-local month: 01:00 on the 1st (UTC+7) belongs to the new month', async () => {
      const bk = await makeBook(1, 'M');
      const now = Date.now();
      const local = new Date(now + OFFSET_MS);
      const startOfLocalMonth =
        Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET_MS;
      const thisKey = monthKey(startOfLocalMonth + HOUR);
      const prevKey = monthKey(startOfLocalMonth - HOUR);

      const read = async () => {
        const res = await http
          .get('/api/reports/loans-by-month?months=2')
          .set(auth(lib))
          .expect(200);
        return Object.fromEntries(
          res.body.map((r: { month: string; count: number }) => [
            r.month,
            r.count,
          ]),
        ) as Record<string, number>;
      };
      const before = await read();
      await loanAt(bk.copyIds[0], new Date(startOfLocalMonth + HOUR));
      await loanAt(bk.copyIds[0], new Date(startOfLocalMonth - HOUR));
      const after = await read();

      expect(Object.keys(after)).toEqual([prevKey, thisKey]);
      expect(after[thisKey] - before[thisKey]).toBe(1);
      expect(after[prevKey] - before[prevKey]).toBe(1);
    });
  });

  describe('inventory', () => {
    it('counts copies per status in SQL; HELD copies are not available', async () => {
      const bk = await makeBook(5, 'I');
      const status = [
        CopyStatus.AVAILABLE,
        CopyStatus.AVAILABLE,
        CopyStatus.BORROWED,
        CopyStatus.HELD,
        CopyStatus.LOST,
      ];
      for (const [i, id] of bk.copyIds.entries())
        await prisma.bookCopy.update({
          where: { id },
          data: { status: status[i] },
        });

      const res = await http
        .get('/api/reports/inventory')
        .set(auth(lib))
        .expect(200);
      const row = res.body.find(
        (r: { category: { id: number } }) => r.category.id === categoryId,
      );
      // Cả thể loại REP chỉ có các sách của test này; các ca khác có thêm bản AVAILABLE nên so tối thiểu
      const all = await prisma.bookCopy.groupBy({
        by: ['status'],
        where: { book: { categoryId } },
        _count: { _all: true },
      });
      const expected = Object.fromEntries(
        all.map((g) => [g.status, g._count._all]),
      );
      expect(row).toMatchObject({
        total: all.reduce((s, g) => s + g._count._all, 0),
        available: expected.AVAILABLE ?? 0,
        borrowed: expected.BORROWED ?? 0,
        held: expected.HELD ?? 0,
        lost: expected.LOST ?? 0,
        maintenance: expected.MAINTENANCE ?? 0,
      });
      expect(row.held).toBeGreaterThanOrEqual(1);
    });
  });

  describe('overdue', () => {
    it('caps the rows with ?limit and reports the true total in X-Total-Count', async () => {
      const bk = await makeBook(2, 'L');
      for (const copyId of bk.copyIds) {
        const loan = await loanAt(
          copyId,
          new Date(Date.now() - 40 * 24 * HOUR),
          'ACTIVE',
        );
        await prisma.loan.update({
          where: { id: loan.id },
          data: { dueAt: new Date(Date.now() - 20 * 24 * HOUR) },
        });
      }
      const dbTotal = await prisma.loan.count({
        where: {
          status: LoanStatus.ACTIVE,
          dueAt: { lt: overdueCutoff(new Date()) },
        },
      });
      const capped = await http
        .get('/api/reports/overdue?limit=1')
        .set(auth(lib))
        .expect(200);
      expect(capped.body).toHaveLength(1);
      expect(Number(capped.headers['x-total-count'])).toBeGreaterThanOrEqual(2);
      expect(
        Math.abs(Number(capped.headers['x-total-count']) - dbTotal),
      ).toBeLessThan(5);
      // trả lại để không làm lệch ca đếm quá hạn của bạn đọc dùng chung bên dưới
      await prisma.loan.updateMany({
        where: { copyId: { in: bk.copyIds } },
        data: { status: LoanStatus.RETURNED, returnedAt: new Date() },
      });
      await http
        .get('/api/reports/overdue?limit=5001')
        .set(auth(lib))
        .expect(400);
      await http.get('/api/reports/overdue?limit=0').set(auth(lib)).expect(400);
    });
  });

  describe('quá hạn nhất quán giữa các màn hình (BR-09 theo ngày lịch)', () => {
    it('a loan due earlier TODAY is not overdue in the user profile, the loan list or the overdue report', async () => {
      const bk = await makeBook(2, 'O');
      const startOfToday = overdueCutoff(new Date()).getTime();
      const earlierToday = new Date(
        Math.max(startOfToday + 1000, Date.now() - 60_000),
      );
      const today = await loanAt(
        bk.copyIds[0],
        new Date(Date.now() - 20 * 24 * HOUR),
        'ACTIVE',
      );
      await prisma.loan.update({
        where: { id: today.id },
        data: { dueAt: earlierToday },
      });

      const profile = await http
        .get(`/api/users/${readerId}`)
        .set(auth(lib))
        .expect(200);
      const list = await http
        .get(`/api/loans?overdue=true&userId=${readerId}`)
        .set(auth(lib))
        .expect(200);
      expect(profile.body.overdueLoans).toBe(0);
      expect(list.body.total).toBe(0);

      // Hạn là hôm qua (địa phương) → cả hai cùng đếm là quá hạn
      await prisma.loan.update({
        where: { id: today.id },
        data: { dueAt: new Date(startOfToday - 1000) },
      });
      const profile2 = await http
        .get(`/api/users/${readerId}`)
        .set(auth(lib))
        .expect(200);
      const list2 = await http
        .get(`/api/loans?overdue=true&userId=${readerId}`)
        .set(auth(lib))
        .expect(200);
      expect(profile2.body.overdueLoans).toBe(1);
      expect(list2.body.total).toBe(1);
    });
  });
});
