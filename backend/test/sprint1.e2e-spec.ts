import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container. Bỏ qua khi không có.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = Date.now().toString().slice(-7);

describeWithDb('Sprint 1 — auth, catalog, users, policies (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let librarianToken: string;
  let readerToken: string;
  let categoryId: number;
  let authorId: number;
  let bookId: number;

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

    const hash = await bcrypt.hash('Secret123', 4);
    await prisma.user.createMany({
      data: [
        {
          email: `admin${RUN}@e2e.local`,
          passwordHash: hash,
          fullName: 'Admin',
          role: Role.ADMIN,
        },
        {
          email: `lib${RUN}@e2e.local`,
          passwordHash: hash,
          fullName: 'Lib',
          role: Role.LIBRARIAN,
        },
      ],
    });
    await prisma.loanPolicy.upsert({
      where: { memberType: 'STUDENT' },
      update: {},
      create: {
        memberType: 'STUDENT',
        maxBooks: 3,
        loanDays: 14,
        renewLimit: 1,
        renewExtraDays: 7,
        finePerDay: 5000,
      },
    });
    const login = async (email: string) =>
      (
        await http
          .post('/api/auth/login')
          .send({ email, password: 'Secret123' })
          .expect(200)
      ).body.accessToken as string;
    adminToken = await login(`admin${RUN}@e2e.local`);
    librarianToken = await login(`lib${RUN}@e2e.local`);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@e2e.local' } },
    });
    await app.close();
  });

  it('registers a reader, logs in, and hides the password hash', async () => {
    const res = await http
      .post('/api/auth/register')
      .send({
        email: `sv${RUN}@e2e.local`,
        password: 'Secret123',
        fullName: 'SV',
        memberType: 'STUDENT',
        memberCode: `E2E${RUN}`,
      })
      .expect(201);
    expect(res.body).toMatchObject({ role: 'READER', memberCode: `E2E${RUN}` });
    expect(res.body).not.toHaveProperty('passwordHash');

    await http
      .post('/api/auth/register')
      .send({
        email: `sv${RUN}@e2e.local`,
        password: 'Secret123',
        fullName: 'SV',
        memberType: 'STUDENT',
        memberCode: 'XYZ1',
      })
      .expect(409)
      .expect((r) => expect(r.body.error).toBe('EMAIL_EXISTS'));

    const login = await http
      .post('/api/auth/login')
      .send({ email: `sv${RUN}@e2e.local`, password: 'Secret123' })
      .expect(200);
    readerToken = login.body.accessToken;
    const me = await http
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(200);
    expect(me.body.email).toBe(`sv${RUN}@e2e.local`);
  });

  it('enforces RBAC: reader 403, anonymous 401, librarian ok', async () => {
    await http.post('/api/categories').send({ name: 'x' }).expect(401);
    await http
      .post('/api/categories')
      .set('Authorization', `Bearer ${readerToken}`)
      .send({ name: 'x' })
      .expect(403);
    const cat = await http
      .post('/api/categories')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ name: `E2E Cat ${RUN}` })
      .expect(201);
    categoryId = cat.body.id;
    expect(cat.body.slug).toBe(`e2e-cat-${RUN}`);
    const author = await http
      .post('/api/authors')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ name: `E2E Author ${RUN}` })
      .expect(201);
    authorId = author.body.id;
  });

  it('creates a book with copies and searches it publicly with real copy counts', async () => {
    const book = await http
      .post('/api/books')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({
        title: `E2E Book ${RUN}`,
        isbn: `979${RUN}000`,
        price: 100000,
        categoryId,
        authorIds: [authorId],
      })
      .expect(201);
    bookId = book.body.id;
    await http
      .post(`/api/books/${bookId}/copies`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ barcode: `E2E-${RUN}-1` })
      .expect(201);
    await http
      .post(`/api/books/${bookId}/copies`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ barcode: `E2E-${RUN}-1` })
      .expect(409)
      .expect((r) => expect(r.body.error).toBe('BARCODE_EXISTS'));

    const search = await http.get(`/api/books?q=E2E Author ${RUN}`).expect(200);
    expect(search.body.total).toBe(1);
    expect(search.body.items[0]).toMatchObject({
      id: bookId,
      copiesTotal: 1,
      copiesAvailable: 1,
    });

    const detail = await http.get(`/api/books/${bookId}`).expect(200);
    expect(detail.body.authors[0].name).toBe(`E2E Author ${RUN}`);
  });

  it('blocks deleting a category in use and lets admin edit policies', async () => {
    await http
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .expect(409)
      .expect((r) => expect(r.body.error).toBe('CATEGORY_IN_USE'));

    await http
      .patch('/api/policies/STUDENT')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ maxBooks: 4 })
      .expect(403);
    const updated = await http
      .patch('/api/policies/STUDENT')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ maxBooks: 4 })
      .expect(200);
    expect(updated.body.maxBooks).toBe(4);
    await http
      .patch('/api/policies/STUDENT')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ maxBooks: 3 })
      .expect(200);
  });

  it('librarian can lock a reader card, which blocks login with ACCOUNT_LOCKED', async () => {
    const me = await http
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(200);
    await http
      .patch(`/api/users/${me.body.id}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ isActive: false })
      .expect(200);
    await http
      .post('/api/auth/login')
      .send({ email: `sv${RUN}@e2e.local`, password: 'Secret123' })
      .expect(403)
      .expect((r) => expect(r.body.error).toBe('ACCOUNT_LOCKED'));
  });

  it('cleans up: delete book, category, author', async () => {
    await http
      .delete(`/api/books/${bookId}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .expect(204);
    await http
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .expect(204);
    await http
      .delete(`/api/authors/${authorId}`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .expect(204);
  });
});
