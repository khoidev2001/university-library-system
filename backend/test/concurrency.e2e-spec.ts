import { INestApplication } from '@nestjs/common';
import {
  CopyStatus,
  LoanStatus,
  ReservationStatus,
  Role,
} from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
// Các yêu cầu bắn đồng thời qua HTTP thật để kiểm khoá hàng / cập nhật có điều kiện trong DB.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}c`;
const SUFFIX = `${RUN}@conc.local`;
const TITLE = `CONC ${RUN}`;
const DAY = 24 * 60 * 60 * 1000;

describeWithDb(
  'Đồng thời: mượn, trả, gia hạn, thu phạt, đặt trước (e2e)',
  () => {
    let e2e: Awaited<ReturnType<typeof createE2eApp>>;
    let app: INestApplication;
    let prisma: PrismaService;
    let http: ReturnType<typeof request>;
    let auth: (t: string) => Record<string, string>;
    let lib: string;
    let categoryId: number;
    let seq = 0;
    const readers: { id: number; code: string; token: string }[] = [];

    const count = (rs: { status: number }[], status: number) =>
      rs.filter((r) => r.status === status).length;

    /** Bạn đọc mới (hạn mức mượn còn nguyên); trả về chỉ số trong `readers`. */
    async function newReader(): Promise<number> {
      const n = readers.length;
      const code = `CONC${n}${RUN}`;
      const u = await e2e.createUser(`r${n}${SUFFIX}`, Role.READER, {
        memberCode: code,
      });
      readers.push({ id: u.id, code, token: e2e.tokenFor(u) });
      return n;
    }
    async function newReaders(n: number): Promise<number[]> {
      const out: number[] = [];
      for (let i = 0; i < n; i++) out.push(await newReader());
      return out;
    }

    /** Sách mới với `n` bản sao AVAILABLE. */
    async function makeBook(n: number, price = 100_000) {
      const tag = `${RUN}-${++seq}`;
      return prisma.book.create({
        data: {
          title: `${TITLE} ${tag}`,
          price,
          categoryId,
          copies: {
            create: Array.from({ length: n }, (_, i) => ({
              barcode: `CONC-${tag}-${i + 1}`,
            })),
          },
        },
        include: { copies: { orderBy: { id: 'asc' } } },
      });
    }
    const lend = (readerIdx: number, barcode: string) =>
      http
        .post('/api/loans')
        .set(auth(lib))
        .send({ barcode, memberCode: readers[readerIdx].code });
    /** Mượn và trả về phiếu (khẳng định 201). */
    const lendOk = async (readerIdx: number, barcode: string) =>
      (await lend(readerIdx, barcode).expect(201)).body.loan as {
        id: number;
        dueAt: string;
      };
    const giveBack = (loanId: number) =>
      http.post(`/api/loans/${loanId}/return`).set(auth(lib)).send({});
    const reserve = (readerIdx: number, bookId: number) =>
      http
        .post('/api/reservations')
        .set(auth(readers[readerIdx].token))
        .send({ bookId });
    const activeLoansOf = (userId: number) =>
      prisma.loan.count({ where: { userId, status: LoanStatus.ACTIVE } });

    beforeAll(async () => {
      e2e = await createE2eApp();
      ({ app, prisma, http, auth } = e2e);
      await e2e.ensureStudentPolicy();
      lib = e2e.tokenFor(await e2e.createUser(`lib${SUFFIX}`, Role.LIBRARIAN));
      categoryId = (
        await prisma.category.create({
          data: { name: `CONC Cat ${RUN}`, slug: `conc-cat-${RUN}` },
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

    it('five readers borrow the same copy at once: exactly one loan is created', async () => {
      const book = await makeBook(1);
      const five = await newReaders(5);
      const results = await Promise.all(
        five.map((i) => lend(i, book.copies[0].barcode)),
      );
      expect(count(results, 201)).toBe(1);
      for (const r of results.filter((r) => r.status !== 201))
        expect(r.body.error).toBe('COPY_NOT_AVAILABLE');
      expect(
        await prisma.loan.count({
          where: { copyId: book.copies[0].id, status: LoanStatus.ACTIVE },
        }),
      ).toBe(1);
      expect(
        (
          await prisma.bookCopy.findUniqueOrThrow({
            where: { id: book.copies[0].id },
          })
        ).status,
      ).toBe(CopyStatus.BORROWED);
    });

    it('one reader borrows many different copies at once: never above maxBooks (3)', async () => {
      const book = await makeBook(6);
      const [r] = await newReaders(1);
      const results = await Promise.all(
        book.copies.map((c) => lend(r, c.barcode)),
      );
      expect(count(results, 201)).toBe(3);
      expect(await activeLoansOf(readers[r].id)).toBe(3);
      for (const x of results.filter((x) => x.status !== 201))
        expect(x.body.error).toBe('LOAN_LIMIT_REACHED');
      // copy bị từ chối phải còn AVAILABLE, không kẹt ở trạng thái khác
      expect(
        await prisma.bookCopy.count({
          where: { bookId: book.id, status: CopyStatus.AVAILABLE },
        }),
      ).toBe(3);
    });

    it('the same overdue loan returned four times at once: one 200 and exactly one fine', async () => {
      const book = await makeBook(1);
      const [r] = await newReaders(1);
      const loan = await lendOk(r, book.copies[0].barcode);
      await prisma.loan.update({
        where: { id: loan.id },
        data: { dueAt: new Date(Date.now() - 3 * DAY) },
      });
      const results = await Promise.all(
        [1, 2, 3, 4].map(() => giveBack(loan.id)),
      );
      expect(count(results, 200)).toBe(1);
      for (const x of results.filter((x) => x.status !== 200)) {
        expect(x.status).toBe(409);
        expect(x.body.error).toBe('LOAN_NOT_ACTIVE');
      }
      expect(await prisma.fine.count({ where: { loanId: loan.id } })).toBe(1);
    });

    it('reporting the same loan lost three times at once creates one fine', async () => {
      const book = await makeBook(1);
      const [r] = await newReaders(1);
      const loan = await lendOk(r, book.copies[0].barcode);
      const results = await Promise.all(
        [1, 2, 3].map(() =>
          http
            .post(`/api/loans/${loan.id}/report-lost`)
            .set(auth(lib))
            .send({}),
        ),
      );
      expect(count(results, 200)).toBe(1);
      expect(await prisma.fine.count({ where: { loanId: loan.id } })).toBe(1);
    });

    it('renewing five times at once uses only the single allowed renewal', async () => {
      const book = await makeBook(1);
      const [r] = await newReaders(1);
      const loan = await lendOk(r, book.copies[0].barcode);
      const results = await Promise.all(
        [1, 2, 3, 4, 5].map(() =>
          http
            .post(`/api/loans/${loan.id}/renew`)
            .set(auth(readers[r].token))
            .send({}),
        ),
      );
      expect(count(results, 200)).toBe(1);
      expect(results.every((x) => [200, 409].includes(x.status))).toBe(true);
      const row = await prisma.loan.findUniqueOrThrow({
        where: { id: loan.id },
      });
      expect(row.renewedCount).toBe(1);
      expect(row.dueAt.getTime() - new Date(loan.dueAt).getTime()).toBe(
        7 * DAY,
      );
    });

    it('paying one fine from three requests at once: one 200, the rest FINE_ALREADY_PAID', async () => {
      const book = await makeBook(1);
      const [r] = await newReaders(1);
      const loan = await lendOk(r, book.copies[0].barcode);
      const fine = await prisma.fine.create({
        data: { loanId: loan.id, type: 'OVERDUE', amount: 10_000 },
      });
      const results = await Promise.all(
        [1, 2, 3].map(() =>
          http.post(`/api/fines/${fine.id}/pay`).set(auth(lib)).send({}),
        ),
      );
      expect(count(results, 200)).toBe(1);
      for (const x of results.filter((x) => x.status !== 200))
        expect(x.body.error).toBe('FINE_ALREADY_PAID');
    });

    describe('đặt trước', () => {
      it('the same reader reserving one book four times at once keeps a single reservation', async () => {
        const book = await makeBook(1);
        const [holder, waiter] = await newReaders(2);
        await lendOk(holder, book.copies[0].barcode);
        const results = await Promise.all(
          [1, 2, 3, 4].map(() => reserve(waiter, book.id)),
        );
        expect(count(results, 201)).toBe(1);
        for (const x of results.filter((x) => x.status !== 201))
          expect(x.body.error).toBe('ALREADY_RESERVED');
        expect(
          await prisma.reservation.count({
            where: {
              userId: readers[waiter].id,
              bookId: book.id,
              status: { in: ['WAITING', 'READY'] },
            },
          }),
        ).toBe(1);
      });

      it('one reader reserving five different books at once stays within the limit of 3', async () => {
        const books = await Promise.all([1, 2, 3, 4, 5].map(() => makeBook(1)));
        // làm cả 5 cuốn hết bản (không qua phiếu mượn để khỏi đụng hạn mức của bạn đọc)
        await prisma.bookCopy.updateMany({
          where: { id: { in: books.map((b) => b.copies[0].id) } },
          data: { status: CopyStatus.BORROWED },
        });
        const [r] = await newReaders(1);
        const results = await Promise.all(books.map((b) => reserve(r, b.id)));
        expect(count(results, 201)).toBe(3);
        for (const x of results.filter((x) => x.status !== 201))
          expect(x.body.error).toBe('RESERVATION_LIMIT');
      });

      it('two copies returned at once with ONE person waiting: one copy is held, the other goes back on the shelf', async () => {
        const book = await makeBook(2);
        const [a, b, waiter] = await newReaders(3);
        const l1 = await lendOk(a, book.copies[0].barcode);
        const l2 = await lendOk(b, book.copies[1].barcode);
        await reserve(waiter, book.id).expect(201);

        const results = await Promise.all([giveBack(l1.id), giveBack(l2.id)]);
        expect(results.map((x) => x.status)).toEqual([200, 200]);

        const copies = await prisma.bookCopy.findMany({
          where: { bookId: book.id },
        });
        const held = copies.filter((c) => c.status === CopyStatus.HELD);
        expect(held).toHaveLength(1);
        expect(
          copies.filter((c) => c.status === CopyStatus.AVAILABLE),
        ).toHaveLength(1);
        const ready = await prisma.reservation.findMany({
          where: { bookId: book.id, status: ReservationStatus.READY },
        });
        expect(ready).toHaveLength(1);
        expect(held[0].id).toBe(ready[0].copyId);
      });

      it('two copies returned at once with TWO people waiting: each gets a different copy', async () => {
        const book = await makeBook(2);
        const [a, b, w1, w2] = await newReaders(4);
        const l1 = await lendOk(a, book.copies[0].barcode);
        const l2 = await lendOk(b, book.copies[1].barcode);
        await reserve(w1, book.id).expect(201);
        await reserve(w2, book.id).expect(201);

        await Promise.all([giveBack(l1.id), giveBack(l2.id)]);

        const ready = await prisma.reservation.findMany({
          where: { bookId: book.id, status: ReservationStatus.READY },
        });
        expect(ready).toHaveLength(2);
        expect(new Set(ready.map((x) => x.copyId)).size).toBe(2);
        expect(
          await prisma.bookCopy.count({
            where: { bookId: book.id, status: CopyStatus.HELD },
          }),
        ).toBe(2);
      });

      it('the owner of a HELD copy borrowing it three times at once gets one loan and fulfils the reservation once', async () => {
        const book = await makeBook(1);
        const [holder, owner] = await newReaders(2);
        const l1 = await lendOk(holder, book.copies[0].barcode);
        await reserve(owner, book.id).expect(201);
        await giveBack(l1.id).expect(200);

        const results = await Promise.all(
          [1, 2, 3].map(() => lend(owner, book.copies[0].barcode)),
        );
        expect(count(results, 201)).toBe(1);
        expect(results.every((x) => x.status < 500)).toBe(true);
        expect(
          await prisma.loan.count({
            where: { copyId: book.copies[0].id, status: LoanStatus.ACTIVE },
          }),
        ).toBe(1);
        expect(
          (
            await prisma.reservation.findFirstOrThrow({
              where: { bookId: book.id },
            })
          ).status,
        ).toBe(ReservationStatus.FULFILLED);
      });

      it('cancelling a READY reservation while its owner borrows the HELD copy never errors with 500 (no deadlock)', async () => {
        for (let round = 0; round < 4; round++) {
          const book = await makeBook(1);
          const [holder, owner] = await newReaders(2);
          const l1 = await lendOk(holder, book.copies[0].barcode);
          const res = (await reserve(owner, book.id).expect(201)).body;
          await giveBack(l1.id).expect(200);

          const results = await Promise.all([
            lend(owner, book.copies[0].barcode),
            http.delete(`/api/reservations/${res.id}`).set(auth(lib)),
          ]);
          expect(results.every((x) => x.status < 500)).toBe(true);
          // trạng thái cuối nhất quán: không có bản HELD mồ côi (không còn đặt trước nào giữ nó)
          const copy = await prisma.bookCopy.findUniqueOrThrow({
            where: { id: book.copies[0].id },
          });
          const active = await prisma.reservation.count({
            where: { bookId: book.id, status: { in: ['WAITING', 'READY'] } },
          });
          if (copy.status === CopyStatus.HELD) expect(active).toBe(1);
          else expect(active).toBe(0);
        }
      });
    });
  },
);
