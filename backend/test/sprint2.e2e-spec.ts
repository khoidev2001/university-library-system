import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CopyStatus, LoanStatus, MemberType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = Date.now().toString().slice(-7);
const DAY = 24 * 60 * 60 * 1000;

describeWithDb('Sprint 2 — mượn, trả, phạt, đánh giá (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let librarianToken: string;
  let readerToken: string;
  let readerId: number;
  let bookId: number;
  let barcodes: string[];
  const memberCode = `E2E${RUN}`;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'e2e-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());

    await prisma.loanPolicy.upsert({
      where: { memberType: MemberType.STUDENT },
      update: { maxBooks: 3, loanDays: 14, renewLimit: 1, renewExtraDays: 7, finePerDay: 5000 },
      create: { memberType: MemberType.STUDENT, maxBooks: 3, loanDays: 14, renewLimit: 1, renewExtraDays: 7, finePerDay: 5000 },
    });

    const hash = await bcrypt.hash('Secret123', 4);
    const librarian = await prisma.user.create({
      data: { email: `lib${RUN}@e2e.local`, passwordHash: hash, fullName: 'Lib', role: Role.LIBRARIAN },
    });
    const reader = await prisma.user.create({
      data: {
        email: `sv${RUN}@e2e.local`,
        passwordHash: hash,
        fullName: 'SV',
        role: Role.READER,
        memberType: MemberType.STUDENT,
        memberCode,
      },
    });
    readerId = reader.id;

    const category = await prisma.category.create({ data: { name: `E2E Cat ${RUN}`, slug: `e2e-cat-${RUN}` } });
    const author = await prisma.author.create({ data: { name: `E2E Author ${RUN}` } });
    const book = await prisma.book.create({
      data: {
        title: `E2E Book ${RUN}`,
        price: 150000,
        categoryId: category.id,
        authors: { create: [{ authorId: author.id }] },
        copies: { create: [1, 2, 3, 4].map((n) => ({ barcode: `E2E-${RUN}-${n}` })) },
      },
      include: { copies: true },
    });
    bookId = book.id;
    barcodes = book.copies.map((c) => c.barcode);

    const login = async (email: string) =>
      (await http.post('/api/auth/login').send({ email, password: 'Secret123' }).expect(200)).body.accessToken as string;
    librarianToken = await login(librarian.email);
    readerToken = await login(reader.email);
  });

  afterAll(async () => {
    await prisma.fine.deleteMany({ where: { loan: { userId: readerId } } });
    await prisma.loan.deleteMany({ where: { userId: readerId } });
    await prisma.rating.deleteMany({ where: { userId: readerId } });
    await prisma.bookCopy.deleteMany({ where: { bookId } });
    await prisma.book.delete({ where: { id: bookId } });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.local' } } });
    await app.close();
  });

  let loanId: number;

  it('lends a copy: ACTIVE loan, due date from the policy, copy BORROWED', async () => {
    const res = await http
      .post('/api/loans')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ barcode: barcodes[0], memberCode })
      .expect(201);

    loanId = res.body.loan.id;
    expect(res.body.loan.status).toBe(LoanStatus.ACTIVE);
    expect(res.body.overdueRisk).toBeNull(); // AI chưa chạy trong CI → fallback

    const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId } });
    expect(Math.round((loan.dueAt.getTime() - loan.borrowedAt.getTime()) / DAY)).toBe(14);
    const copy = await prisma.bookCopy.findUniqueOrThrow({ where: { barcode: barcodes[0] } });
    expect(copy.status).toBe(CopyStatus.BORROWED);
  });

  it('refuses the same copy twice and the 4th concurrent loan', async () => {
    await http.post('/api/loans').set('Authorization', `Bearer ${librarianToken}`).send({ barcode: barcodes[0], memberCode })
      .expect(409)
      .expect((r) => expect(r.body.error).toBe('COPY_NOT_AVAILABLE'));

    for (const barcode of [barcodes[1], barcodes[2]]) {
      await http.post('/api/loans').set('Authorization', `Bearer ${librarianToken}`).send({ barcode, memberCode }).expect(201);
    }
    await http.post('/api/loans').set('Authorization', `Bearer ${librarianToken}`).send({ barcode: barcodes[3], memberCode })
      .expect(409)
      .expect((r) => expect(r.body.error).toBe('LOAN_LIMIT_REACHED'));
  });

  it('renews once, then refuses a second renewal', async () => {
    const before = await prisma.loan.findUniqueOrThrow({ where: { id: loanId } });
    const res = await http.post(`/api/loans/${loanId}/renew`).set('Authorization', `Bearer ${readerToken}`).expect(200);
    expect(res.body.renewedCount).toBe(1);
    const after = await prisma.loan.findUniqueOrThrow({ where: { id: loanId } });
    expect(Math.round((after.dueAt.getTime() - before.dueAt.getTime()) / DAY)).toBe(7);

    await http.post(`/api/loans/${loanId}/renew`).set('Authorization', `Bearer ${readerToken}`)
      .expect(409)
      .expect((r) => expect(r.body.error).toBe('RENEW_LIMIT_REACHED'));
  });

  it('marks a backdated loan overdue and blocks renewal and new loans', async () => {
    await prisma.loan.update({ where: { id: loanId }, data: { dueAt: new Date(Date.now() - 3 * DAY) } });

    const mine = await http.get('/api/loans/me?status=ACTIVE').set('Authorization', `Bearer ${readerToken}`).expect(200);
    const row = mine.body.items.find((l: { id: number }) => l.id === loanId);
    expect(row).toMatchObject({ isOverdue: true, overdueDays: 3 });

    await http.post(`/api/loans/${loanId}/renew`).set('Authorization', `Bearer ${readerToken}`)
      .expect(409)
      .expect((r) => expect(r.body.error).toBe('LOAN_OVERDUE_CANNOT_RENEW'));

    // Trả đúng hạn một cuốn để còn chỗ trống: lúc này lý do bị chặn phải là quá hạn, không phải hết hạn mức.
    const onTime = await prisma.loan.findFirstOrThrow({
      where: { userId: readerId, status: LoanStatus.ACTIVE, id: { not: loanId } },
    });
    await http.post(`/api/loans/${onTime.id}/return`).set('Authorization', `Bearer ${librarianToken}`).expect(200);

    await http.post('/api/loans').set('Authorization', `Bearer ${librarianToken}`).send({ barcode: barcodes[3], memberCode })
      .expect(409)
      .expect((r) => expect(r.body.error).toBe('HAS_OVERDUE_LOAN'));
  });

  it('returns late: creates a 3-day fine, frees the copy, then blocks on the unpaid fine', async () => {
    const res = await http.post(`/api/loans/${loanId}/return`).set('Authorization', `Bearer ${librarianToken}`).expect(200);
    expect(res.body.overdueDays).toBe(3);
    expect(res.body.fine).toMatchObject({ type: 'OVERDUE', amount: 15000 });

    const copy = await prisma.bookCopy.findUniqueOrThrow({ where: { barcode: barcodes[0] } });
    expect(copy.status).toBe(CopyStatus.AVAILABLE);

    await http.post('/api/loans').set('Authorization', `Bearer ${librarianToken}`).send({ barcode: barcodes[3], memberCode })
      .expect(409)
      .expect((r) => expect(r.body.error).toBe('UNPAID_FINE'));

    const fines = await http.get('/api/fines/me').set('Authorization', `Bearer ${readerToken}`).expect(200);
    expect(fines.body.unpaidTotal).toBe(15000);
  });

  it('collects the fine once, and lending works again', async () => {
    const fine = await prisma.fine.findFirstOrThrow({ where: { loan: { userId: readerId }, paidAt: null } });
    const paid = await http.post(`/api/fines/${fine.id}/pay`).set('Authorization', `Bearer ${librarianToken}`).expect(200);
    expect(paid.body.paidAt).not.toBeNull();

    await http.post(`/api/fines/${fine.id}/pay`).set('Authorization', `Bearer ${librarianToken}`)
      .expect(409)
      .expect((r) => expect(r.body.error).toBe('FINE_ALREADY_PAID'));

    await http.post('/api/loans').set('Authorization', `Bearer ${librarianToken}`).send({ barcode: barcodes[3], memberCode }).expect(201);
  });

  it('rates only a returned book, and reports stay librarian-only', async () => {
    await http.post(`/api/books/${bookId}/ratings`).set('Authorization', `Bearer ${readerToken}`).send({ score: 5 }).expect(200);
    const summary = await http.get(`/api/books/${bookId}/ratings/summary`).expect(200);
    expect(summary.body).toMatchObject({ avg: 5, count: 1 });

    await http.get('/api/reports/overdue').set('Authorization', `Bearer ${readerToken}`).expect(403);
    const inventory = await http.get('/api/reports/inventory').set('Authorization', `Bearer ${librarianToken}`).expect(200);
    expect(inventory.body.length).toBeGreaterThan(0);
  });

  it('reports a lost copy: fine = cover price + days late', async () => {
    const active = await prisma.loan.findFirstOrThrow({ where: { userId: readerId, status: LoanStatus.ACTIVE } });
    await prisma.loan.update({ where: { id: active.id }, data: { dueAt: new Date(Date.now() - 2 * DAY) } });

    const res = await http.post(`/api/loans/${active.id}/report-lost`).set('Authorization', `Bearer ${librarianToken}`).expect(200);
    expect(res.body.fine).toMatchObject({ type: 'LOST', amount: 150000 + 2 * 5000 });

    const copy = await prisma.bookCopy.findUniqueOrThrow({ where: { id: active.copyId } });
    expect(copy.status).toBe(CopyStatus.LOST);
  });
});
