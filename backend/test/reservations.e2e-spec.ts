import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CopyStatus,
  MemberType,
  ReservationStatus,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}r`;
const DAY = 24 * 60 * 60 * 1000;

type Who = 'a' | 'b' | 'c';

describeWithDb('Đặt trước sách và thông báo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let lib: string;
  let librarianId: number;
  const readers = {} as Record<Who, { id: number; token: string; code: string }>;
  let bookId: number;
  let copyId: number;
  const barcode = `RES-${RUN}-1`;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const lend = (to: Who) =>
    http
      .post('/api/loans')
      .set(auth(lib))
      .send({ barcode, memberCode: readers[to].code });
  const loanOf = async (who: Who) =>
    (
      await prisma.loan.findFirstOrThrow({
        where: { userId: readers[who].id, returnedAt: null },
      })
    ).id;
  const giveBack = (loanId: number) =>
    http
      .post(`/api/loans/${loanId}/return`)
      .set(auth(lib))
      .send({})
      .expect(200);
  const copyStatus = async () =>
    (await prisma.bookCopy.findUniqueOrThrow({ where: { id: copyId } }))
      .status;
  const reserve = (who: Who) =>
    http.post('/api/reservations').set(auth(readers[who].token)).send({ bookId });
  const reservationOf = (who: Who) =>
    prisma.reservation.findFirstOrThrow({
      where: { bookId, userId: readers[who].id },
      orderBy: { id: 'desc' },
    });

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'e2e-secret';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());

    const policy = {
      maxBooks: 3,
      loanDays: 14,
      renewLimit: 1,
      renewExtraDays: 7,
      finePerDay: 5000,
    };
    await prisma.loanPolicy.upsert({
      where: { memberType: MemberType.STUDENT },
      update: policy,
      create: { memberType: MemberType.STUDENT, ...policy },
    });
    const hash = await bcrypt.hash('Secret123', 4);
    const librarian = await prisma.user.create({
      data: {
        email: `lib${RUN}@e2e.local`,
        passwordHash: hash,
        fullName: 'Lib',
        role: Role.LIBRARIAN,
      },
    });
    librarianId = librarian.id;
    for (const k of ['a', 'b', 'c'] as const) {
      const code = `RES${k.toUpperCase()}${RUN}`;
      const u = await prisma.user.create({
        data: {
          email: `${k}${RUN}@e2e.local`,
          passwordHash: hash,
          fullName: `Reader ${k}`,
          role: Role.READER,
          memberType: MemberType.STUDENT,
          memberCode: code,
        },
      });
      readers[k] = { id: u.id, token: '', code };
    }
    const category = await prisma.category.create({
      data: { name: `RES Cat ${RUN}`, slug: `res-cat-${RUN}` },
    });
    const book = await prisma.book.create({
      data: {
        title: `RES Book ${RUN}`,
        price: 100000,
        categoryId: category.id,
        copies: { create: [{ barcode }] },
      },
      include: { copies: true },
    });
    bookId = book.id;
    copyId = book.copies[0].id;
    const login = async (email: string) =>
      (
        await http
          .post('/api/auth/login')
          .send({ email, password: 'Secret123' })
          .expect(200)
      ).body.accessToken as string;
    lib = await login(librarian.email);
    for (const k of ['a', 'b', 'c'] as const)
      readers[k].token = await login(`${k}${RUN}@e2e.local`);
  });

  afterAll(async () => {
    const ids = Object.values(readers).map((r) => r.id);
    await prisma.reservation.deleteMany({ where: { bookId } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.fine.deleteMany({ where: { loan: { userId: { in: ids } } } });
    await prisma.loan.deleteMany({ where: { userId: { in: ids } } });
    await prisma.bookCopy.deleteMany({ where: { bookId } });
    await prisma.book.delete({ where: { id: bookId } });
    await prisma.user.deleteMany({
      where: { email: { endsWith: `${RUN}@e2e.local` } },
    });
    await app.close();
  });

  it('refuses to reserve a book that is still on the shelf', async () => {
    const res = await reserve('b').expect(409);
    expect(res.body.error).toBe('BOOK_AVAILABLE');
  });

  it('queues readers once every copy is out, and rejects bad reservations', async () => {
    await lend('a').expect(201);
    expect(await copyStatus()).toBe(CopyStatus.BORROWED);

    await reserve('b').expect(201);
    expect((await reserve('b').expect(409)).body.error).toBe(
      'ALREADY_RESERVED',
    );
    expect((await reserve('a').expect(409)).body.error).toBe(
      'ALREADY_BORROWING',
    );
    await reserve('c').expect(201);

    const mine = await http
      .get('/api/reservations/me')
      .set(auth(readers.c.token))
      .expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({ status: 'WAITING', queuePosition: 2 });
  });

  it('holds the returned copy for the first in line and notifies them', async () => {
    await giveBack(await loanOf('a'));

    expect(await copyStatus()).toBe(CopyStatus.HELD);
    const b = await reservationOf('b');
    expect(b).toMatchObject({ status: ReservationStatus.READY, copyId });
    expect(b.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 2 * DAY);

    const n = await http
      .get('/api/notifications/me')
      .set(auth(readers.b.token))
      .expect(200);
    expect(n.body.unread).toBe(1);
    expect(n.body.items[0].type).toBe('RESERVATION_READY');

    const id = n.body.items[0].id;
    await http
      .post(`/api/notifications/${id}/read`)
      .set(auth(readers.b.token))
      .expect(201);
    const after = await http
      .get('/api/notifications/me')
      .set(auth(readers.b.token))
      .expect(200);
    expect(after.body.unread).toBe(0);
    // Người khác không đọc được thông báo của b.
    await http
      .post(`/api/notifications/${id}/read`)
      .set(auth(readers.c.token))
      .expect(404);
  });

  it('only the reservation holder can borrow the held copy', async () => {
    const res = await lend('c').expect(409);
    expect(res.body.error).toBe('COPY_HELD');
    expect(await copyStatus()).toBe(CopyStatus.HELD);

    await lend('b').expect(201);
    expect(await copyStatus()).toBe(CopyStatus.BORROWED);
    expect((await reservationOf('b')).status).toBe(
      ReservationStatus.FULFILLED,
    );
  });

  it('cancelling a READY reservation frees the copy when nobody else waits', async () => {
    await giveBack(await loanOf('b'));
    const c = await reservationOf('c');
    expect(c.status).toBe(ReservationStatus.READY);

    await http
      .delete(`/api/reservations/${c.id}`)
      .set(auth(readers.a.token))
      .expect(404);
    await http
      .delete(`/api/reservations/${c.id}`)
      .set(auth(readers.c.token))
      .expect(200);

    expect(await copyStatus()).toBe(CopyStatus.AVAILABLE);
    expect((await reservationOf('c')).status).toBe(
      ReservationStatus.CANCELLED,
    );
  });

  it('expires a hold that was not collected and passes the copy on', async () => {
    await lend('a').expect(201);
    await reserve('b').expect(201);
    await reserve('c').expect(201);
    await giveBack(await loanOf('a'));
    const b = await reservationOf('b');
    expect(b.status).toBe(ReservationStatus.READY);
    await prisma.reservation.update({
      where: { id: b.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    // Bất kỳ lần đọc hàng đợi nào cũng kích hoạt kiểm hết hạn.
    await http
      .get('/api/reservations/me')
      .set(auth(readers.c.token))
      .expect(200);

    expect((await reservationOf('b')).status).toBe(ReservationStatus.EXPIRED);
    const c = await reservationOf('c');
    expect(c).toMatchObject({ status: ReservationStatus.READY, copyId });
    expect(await copyStatus()).toBe(CopyStatus.HELD);
    const types = (
      await prisma.notification.findMany({ where: { userId: readers.b.id } })
    ).map((n) => n.type);
    expect(types).toContain('RESERVATION_EXPIRED');
  });

  it('sends each due-soon reminder only once', async () => {
    const notifications = app.get(NotificationsService);
    const loan = await prisma.loan.create({
      data: {
        copyId,
        userId: readers.a.id,
        createdById: librarianId,
        dueAt: new Date(Date.now() + DAY),
      },
    });
    await notifications.sendLoanReminders();
    await notifications.sendLoanReminders();
    const rows = await prisma.notification.findMany({
      where: { dedupeKey: `loan:${loan.id}:due` },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: readers.a.id,
      type: 'LOAN_DUE_SOON',
    });
  });
});
