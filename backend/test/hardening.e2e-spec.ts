import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}h`;
const SUFFIX = `${RUN}@hard.local`;
const TITLE = `HARD ${RUN}`;
const INT4_OVERFLOW = 99_999_999_999;

describeWithDb('Củng cố đầu vào, xác thực và xung đột (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let auth: (t: string) => Record<string, string>;
  let jwt: JwtService;
  let lib: string;
  let admin: string;
  let reader: string;
  let readerId: number;
  let librarianId: number;
  let adminId: number;
  let categoryId: number;
  let authorId: number;

  beforeAll(async () => {
    const e = await createE2eApp();
    ({ app, prisma, http, auth } = e);
    jwt = app.get(JwtService, { strict: false });
    await e.ensureStudentPolicy();
    const librarian = await e.createUser(`lib${SUFFIX}`, Role.LIBRARIAN);
    const adm = await e.createUser(`adm${SUFFIX}`, Role.ADMIN);
    const rd = await e.createUser(`rd${SUFFIX}`, Role.READER, {
      memberCode: `HARD${RUN}`,
    });
    librarianId = librarian.id;
    adminId = adm.id;
    readerId = rd.id;
    lib = await e.login(librarian.email);
    admin = await e.login(adm.email);
    reader = await e.login(rd.email);
    categoryId = (
      await prisma.category.create({
        data: { name: `HARD Cat ${RUN}`, slug: `hard-cat-${RUN}` },
      })
    ).id;
    authorId = (
      await prisma.author.create({ data: { name: `HARD Au ${RUN}` } })
    ).id;
  });

  afterAll(async () => {
    await cleanupE2eData(prisma, {
      emailSuffix: SUFFIX,
      bookTitlePrefix: TITLE,
    });
    await prisma.bookAuthor.deleteMany({ where: { authorId } });
    await prisma.author.deleteMany({ where: { name: { contains: RUN } } });
    await prisma.category.deleteMany({ where: { slug: { contains: RUN } } });
    await app.close();
  });

  describe('JWT phải khớp tài khoản hiện tại trong DB', () => {
    it('rejects the token of a locked account immediately, accepts it again once unlocked', async () => {
      await http.get('/api/auth/me').set(auth(reader)).expect(200);
      await prisma.user.update({
        where: { id: readerId },
        data: { isActive: false },
      });
      await http.get('/api/auth/me').set(auth(reader)).expect(401);
      await http.get('/api/loans/me').set(auth(reader)).expect(401);
      await prisma.user.update({
        where: { id: readerId },
        data: { isActive: true },
      });
      await http.get('/api/auth/me').set(auth(reader)).expect(200);
    });

    it('rejects a correctly signed token for a user that no longer exists (401, not 500)', async () => {
      const ghost = jwt.sign({ sub: 2_000_000_000, role: 'ADMIN' });
      await http.get('/api/auth/me').set(auth(ghost)).expect(401);
      await http.get('/api/users').set(auth(ghost)).expect(401);
    });

    it('takes the role from the DB, not the token (a demoted admin loses access at once)', async () => {
      const forged = jwt.sign({ sub: readerId, role: 'ADMIN' });
      await http.get('/api/users').set(auth(forged)).expect(403);
    });
  });

  describe('lỗi đầu vào không bao giờ thành 500', () => {
    it('ids beyond INT4 in the path are 404, in query / body are 400', async () => {
      await http.get(`/api/books/${INT4_OVERFLOW}`).expect(404);
      await http.get(`/api/users/${INT4_OVERFLOW}`).set(auth(lib)).expect(404);
      await http
        .post(`/api/notifications/${INT4_OVERFLOW}/read`)
        .set(auth(reader))
        .expect(404);
      await http
        .post(`/api/books/${INT4_OVERFLOW}/ratings`)
        .set(auth(reader))
        .send({ score: 5 })
        .expect(404);
      await http.get(`/api/books?categoryId=${INT4_OVERFLOW}`).expect(400);
      await http
        .get(`/api/loans?userId=${INT4_OVERFLOW}`)
        .set(auth(lib))
        .expect(400);
      await http
        .post('/api/reservations')
        .set(auth(reader))
        .send({ bookId: INT4_OVERFLOW })
        .expect(400);
    });

    it('rejects NUL bytes with 400 (Postgres cannot store them)', async () => {
      await http.get('/api/books?q=%00').expect(400);
      await http
        .post('/api/books')
        .set(auth(lib))
        .send({
          title: 'a\u0000b',
          price: 1000,
          categoryId,
          authorIds: [authorId],
        })
        .expect(400);
    });

    it('answers an oversized body with 413, keeping the error format', async () => {
      const res = await http
        .post('/api/auth/register')
        .send({ email: 'x@y.vn', password: 'x'.repeat(300_000) })
        .expect(413);
      expect(res.body).toMatchObject({
        statusCode: 413,
        error: 'PAYLOAD_TOO_LARGE',
      });
    });

    it('rejects out-of-range numbers instead of overflowing INT4 (price, finePerDay)', async () => {
      await http
        .post('/api/books')
        .set(auth(lib))
        .send({
          title: `${TITLE} price`,
          price: 3_000_000_000,
          categoryId,
          authorIds: [authorId],
        })
        .expect(400);
      await http
        .patch('/api/policies/STUDENT')
        .set(auth(admin))
        .send({ finePerDay: 3_000_000_000 })
        .expect(400);
    });
  });

  describe('trùng đồng thời trả 409 có mã, không phải 500', () => {
    it('registering the same email / member code in parallel: one 201, the rest 409', async () => {
      const email = `race${SUFFIX}`;
      const results = await Promise.all(
        [1, 2, 3, 4].map((i) =>
          http.post('/api/auth/register').send({
            email,
            password: 'Secret123',
            fullName: 'Race',
            memberType: 'STUDENT',
            memberCode: `RACE${RUN}${i}`,
          }),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      for (const r of results.filter((r) => r.status !== 201)) {
        expect(r.status).toBe(409);
        expect(r.body.error).toBe('EMAIL_EXISTS');
      }
      const sameCode = await Promise.all(
        [1, 2, 3].map((i) =>
          http.post('/api/auth/register').send({
            email: `code${i}${SUFFIX}`,
            password: 'Secret123',
            fullName: 'Race',
            memberType: 'STUDENT',
            memberCode: `RCODE${RUN}`,
          }),
        ),
      );
      expect(sameCode.filter((r) => r.status === 201)).toHaveLength(1);
      for (const r of sameCode.filter((r) => r.status !== 201))
        expect(r.body.error).toBe('MEMBER_CODE_EXISTS');
    });

    it('creating the same category / barcode / ISBN in parallel', async () => {
      const cats = await Promise.all(
        [1, 2, 3].map(() =>
          http
            .post('/api/categories')
            .set(auth(lib))
            .send({ name: `HARD Race ${RUN}` }),
        ),
      );
      expect(cats.filter((r) => r.status === 201)).toHaveLength(1);
      for (const r of cats.filter((r) => r.status !== 201))
        expect(r.body.error).toBe('CATEGORY_EXISTS');

      const book = await http
        .post('/api/books')
        .set(auth(lib))
        .send({
          title: `${TITLE} race`,
          price: 1000,
          categoryId,
          authorIds: [authorId],
        })
        .expect(201);
      const copies = await Promise.all(
        [1, 2, 3].map(() =>
          http
            .post(`/api/books/${book.body.id}/copies`)
            .set(auth(lib))
            .send({ barcode: `HARD-${RUN}-R` }),
        ),
      );
      expect(copies.filter((r) => r.status === 201)).toHaveLength(1);
      for (const r of copies.filter((r) => r.status !== 201))
        expect(r.body.error).toBe('BARCODE_EXISTS');
    });
  });

  describe('thể loại, tác giả, sách', () => {
    it('refuses a category name that has no letters or digits (empty slug)', async () => {
      await http
        .post('/api/categories')
        .set(auth(lib))
        .send({ name: '!!!' })
        .expect(400);
    });

    it('refuses a blank author name instead of storing an empty one', async () => {
      await http
        .post('/api/authors')
        .set(auth(lib))
        .send({ name: '   ' })
        .expect(400);
    });

    it('create / update tolerate duplicate authorIds, null required fields and an ISBN resent with dashes', async () => {
      const isbn = `978${RUN.replace(/\D/g, '').padEnd(10, '1')}`.slice(0, 13);
      const created = await http
        .post('/api/books')
        .set(auth(lib))
        .send({
          title: `${TITLE} dup`,
          isbn,
          price: 50000,
          categoryId,
          authorIds: [authorId, authorId],
        })
        .expect(201);
      expect(created.body.authors).toHaveLength(1);

      const dashed = `${isbn.slice(0, 3)}-${isbn.slice(3)}`;
      await http
        .patch(`/api/books/${created.body.id}`)
        .set(auth(lib))
        .send({ isbn: dashed })
        .expect(200);
      const patched = await http
        .patch(`/api/books/${created.body.id}`)
        .set(auth(lib))
        .send({ price: null, title: null, authorIds: [authorId, authorId] })
        .expect(200);
      expect(patched.body).toMatchObject({
        price: 50000,
        title: `${TITLE} dup`,
      });
      expect(patched.body.authors).toHaveLength(1);

      await http
        .post('/api/books')
        .set(auth(lib))
        .send({
          title: `${TITLE} dup2`,
          isbn: dashed,
          price: 1,
          categoryId,
          authorIds: [authorId],
        })
        .expect(409);
    });

    it('delete: a book with loan history is 409 BOOK_HAS_LOAN_HISTORY (was 500); a never-lent book is removed with its copies', async () => {
      const lent = await prisma.book.create({
        data: {
          title: `${TITLE} lent`,
          price: 1000,
          categoryId,
          copies: { create: [{ barcode: `HARD-${RUN}-L1` }] },
        },
        include: { copies: true },
      });
      await prisma.loan.create({
        data: {
          copyId: lent.copies[0].id,
          userId: readerId,
          createdById: librarianId,
          dueAt: new Date(Date.now() + 86_400_000),
          status: 'RETURNED',
          returnedAt: new Date(),
        },
      });
      const res = await http
        .delete(`/api/books/${lent.id}`)
        .set(auth(lib))
        .expect(409);
      expect(res.body.error).toBe('BOOK_HAS_LOAN_HISTORY');

      const fresh = await prisma.book.create({
        data: {
          title: `${TITLE} fresh`,
          price: 1000,
          categoryId,
          copies: { create: [{ barcode: `HARD-${RUN}-F1` }] },
        },
      });
      await prisma.reservation.create({
        data: { userId: readerId, bookId: fresh.id, status: 'CANCELLED' },
      });
      await http.delete(`/api/books/${fresh.id}`).set(auth(lib)).expect(204);
      expect(await prisma.book.count({ where: { id: fresh.id } })).toBe(0);
      expect(await prisma.bookCopy.count({ where: { bookId: fresh.id } })).toBe(
        0,
      );
    });

    it('search treats % and _ literally and ignores blank / dash-only queries', async () => {
      await prisma.book.createMany({
        data: [
          { title: `${TITLE} 50% off`, price: 1, categoryId },
          { title: `${TITLE} 50X off`, price: 1, categoryId },
        ],
      });
      const pct = await http
        .get(`/api/books?q=${encodeURIComponent(`${TITLE} 50%`)}`)
        .expect(200);
      expect(pct.body.items.map((b: { title: string }) => b.title)).toEqual([
        `${TITLE} 50% off`,
      ]);

      const all = await http.get('/api/books?limit=1').expect(200);
      for (const q of ['%', '_', '-', '   ']) {
        const res = await http
          .get(`/api/books?limit=1&q=${encodeURIComponent(q)}`)
          .expect(200);
        if (q.trim() === '' || q === '-') {
          // bỏ điều kiện lọc hoặc không khớp ISBN trống: không được khớp "mọi sách có ISBN"
          expect(res.body.total).toBeLessThanOrEqual(all.body.total);
        } else {
          expect(res.body.total).toBeLessThan(all.body.total);
        }
      }
      const dash = await http.get('/api/books?q=-').expect(200);
      const withIsbn = await prisma.book.count({
        where: { isbn: { not: null } },
      });
      if (withIsbn > 0) expect(dash.body.total).toBeLessThan(withIsbn);
    });

    it('sets Cache-Control on the public catalogue', async () => {
      const books = await http.get('/api/books?limit=1').expect(200);
      expect(books.headers['cache-control']).toContain('s-maxage=30');
      const cats = await http.get('/api/categories').expect(200);
      expect(cats.headers['cache-control']).toContain('s-maxage=300');
      const me = await http.get('/api/loans/me').set(auth(reader)).expect(200);
      expect(me.headers['cache-control']).toBeUndefined();
    });
  });

  describe('email và mã bạn đọc không phân biệt hoa thường', () => {
    it('refuses a look-alike email / member code and lets the owner log in with any casing', async () => {
      const body = {
        email: `Case.User${SUFFIX}`,
        password: 'Secret123',
        fullName: 'Case User',
        memberType: 'STUDENT',
        memberCode: `CaSe${RUN}`,
      };
      const created = await http
        .post('/api/auth/register')
        .send(body)
        .expect(201);
      expect(created.body.email).toBe(`case.user${SUFFIX}`);

      const dupEmail = await http
        .post('/api/auth/register')
        .send({
          ...body,
          email: `CASE.USER${SUFFIX}`,
          memberCode: `OTHER${RUN}`,
        })
        .expect(409);
      expect(dupEmail.body.error).toBe('EMAIL_EXISTS');
      const dupCode = await http
        .post('/api/auth/register')
        .send({ ...body, email: `another${SUFFIX}`, memberCode: `CASE${RUN}` })
        .expect(409);
      expect(dupCode.body.error).toBe('MEMBER_CODE_EXISTS');

      await http
        .post('/api/auth/login')
        .send({ email: `CASE.user${SUFFIX}`, password: 'Secret123' })
        .expect(200);
    });
  });

  describe('giữ sách quá hạn nhận', () => {
    it('lets another reader borrow a HELD copy once its hold has expired, without waiting for the scheduler', async () => {
      const book = await prisma.book.create({
        data: {
          title: `${TITLE} hold`,
          price: 1000,
          categoryId,
          copies: {
            create: [{ barcode: `HARD-${RUN}-H1`, status: 'HELD' as const }],
          },
        },
        include: { copies: true },
      });
      const owner = await prisma.user.findFirstOrThrow({
        where: { email: `rd${SUFFIX}` },
      });
      await prisma.reservation.create({
        data: {
          userId: owner.id,
          bookId: book.id,
          copyId: book.copies[0].id,
          status: 'READY',
          readyAt: new Date(Date.now() - 4 * 86_400_000),
          expiresAt: new Date(Date.now() - 86_400_000),
        },
      });
      const other = await prisma.user.create({
        data: {
          email: `other${SUFFIX}`,
          passwordHash: 'x',
          fullName: 'Other',
          role: 'READER',
          memberType: 'STUDENT',
          memberCode: `OTH${RUN}`,
        },
      });

      await http
        .post('/api/loans')
        .set(auth(lib))
        .send({ barcode: `HARD-${RUN}-H1`, memberCode: other.memberCode })
        .expect(201);
      expect(
        (
          await prisma.reservation.findFirstOrThrow({
            where: { bookId: book.id },
          })
        ).status,
      ).toBe('EXPIRED');
    });
  });

  describe('quyền sửa tài khoản', () => {
    it('a librarian cannot lock an admin or themselves; an admin can lock a librarian', async () => {
      const onAdmin = await http
        .patch(`/api/users/${adminId}`)
        .set(auth(lib))
        .send({ isActive: false })
        .expect(403);
      expect(onAdmin.body.error).toBe('STAFF_ACCOUNT_PROTECTED');
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: adminId } }))
          .isActive,
      ).toBe(true);

      const self = await http
        .patch(`/api/users/${adminId}`)
        .set(auth(admin))
        .send({ isActive: false })
        .expect(409);
      expect(self.body.error).toBe('CANNOT_LOCK_SELF');

      await http
        .patch(`/api/users/${readerId}`)
        .set(auth(lib))
        .send({ isActive: true })
        .expect(200);

      await http
        .patch(`/api/users/${librarianId}`)
        .set(auth(admin))
        .send({ isActive: false })
        .expect(200);
      await http.get('/api/auth/me').set(auth(lib)).expect(401);
      await prisma.user.update({
        where: { id: librarianId },
        data: { isActive: true },
      });
    });

    it('a locked reader can still have a loan returned at the desk', async () => {
      const book = await prisma.book.create({
        data: {
          title: `${TITLE} locked`,
          price: 1000,
          categoryId,
          copies: {
            create: [{ barcode: `HARD-${RUN}-K1`, status: 'BORROWED' }],
          },
        },
        include: { copies: true },
      });
      const loan = await prisma.loan.create({
        data: {
          copyId: book.copies[0].id,
          userId: readerId,
          createdById: librarianId,
          dueAt: new Date(Date.now() + 86_400_000),
        },
      });
      await prisma.user.update({
        where: { id: readerId },
        data: { isActive: false },
      });
      await http
        .post(`/api/loans/${loan.id}/return`)
        .set(auth(lib))
        .send({})
        .expect(200);
      await prisma.user.update({
        where: { id: readerId },
        data: { isActive: true },
      });
    });
  });
});
