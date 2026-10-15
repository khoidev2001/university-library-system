import { INestApplication } from '@nestjs/common';
import { CopyStatus } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
// Tìm kiếm chữ chạy bằng SQL thô (UNION ba chỉ mục trigram), nên cần kiểm trên DB thật.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}s`;
const TITLE = `SRCH ${RUN}`;

describeWithDb('Tìm kiếm sách theo chữ (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let cat1: number;
  let cat2: number;
  let authorA: number;
  let authorB: number;
  const ids: Record<string, number> = {};

  const search = async (qs: string) =>
    (await http.get(`/api/books?${qs}`).expect(200)).body as {
      items: { id: number; title: string; copiesAvailable: number }[];
      total: number;
      page: number;
      limit: number;
    };
  const q = (text: string, extra = '') =>
    search(`q=${encodeURIComponent(text)}${extra}`);

  beforeAll(async () => {
    const e = await createE2eApp();
    ({ app, prisma, http } = e);
    cat1 = (
      await prisma.category.create({
        data: { name: `SRCH C1 ${RUN}`, slug: `srch-c1-${RUN}` },
      })
    ).id;
    cat2 = (
      await prisma.category.create({
        data: { name: `SRCH C2 ${RUN}`, slug: `srch-c2-${RUN}` },
      })
    ).id;
    authorA = (
      await prisma.author.create({ data: { name: `Zorbaxia Alpha ${RUN}` } })
    ).id;
    authorB = (
      await prisma.author.create({ data: { name: `Quillon Beta ${RUN}` } })
    ).id;
    const mk = async (
      key: string,
      data: {
        title: string;
        isbn?: string;
        categoryId: number;
        authorId: number;
        copies: CopyStatus[];
      },
    ) => {
      const b = await prisma.book.create({
        data: {
          title: data.title,
          isbn: data.isbn,
          price: 1000,
          categoryId: data.categoryId,
          authors: { create: [{ authorId: data.authorId }] },
          copies: {
            create: data.copies.map((status, i) => ({
              barcode: `SRCH-${RUN}-${key}-${i}`,
              status,
            })),
          },
        },
      });
      ids[key] = b.id;
    };
    await mk('a', {
      title: `${TITLE} Gamma Rays`,
      isbn: `978${RUN.replace(/\D/g, '')}0001`,
      categoryId: cat1,
      authorId: authorA,
      copies: [CopyStatus.AVAILABLE],
    });
    await mk('b', {
      title: `${TITLE} Delta Waves`,
      categoryId: cat1,
      authorId: authorB,
      copies: [CopyStatus.BORROWED],
    });
    await mk('c', {
      title: `${TITLE} 100% Pure`,
      categoryId: cat2,
      authorId: authorA,
      copies: [CopyStatus.HELD, CopyStatus.AVAILABLE],
    });
    await mk('d', {
      title: `${TITLE} 100X Pure`,
      categoryId: cat2,
      authorId: authorB,
      copies: [CopyStatus.HELD],
    });
  });

  afterAll(async () => {
    await cleanupE2eData(prisma, {
      emailSuffix: `${RUN}@none.local`,
      bookTitlePrefix: TITLE,
    });
    await prisma.author.deleteMany({
      where: { id: { in: [authorA, authorB] } },
    });
    await prisma.category.deleteMany({ where: { id: { in: [cat1, cat2] } } });
    await app.close();
  });

  it('matches the title case-insensitively and reports a consistent total', async () => {
    const res = await q(`${TITLE.toLowerCase()} gamma`);
    expect(res.items.map((b) => b.id)).toEqual([ids.a]);
    expect(res.total).toBe(1);

    const all = await q(TITLE);
    expect(all.total).toBe(4);
    expect(all.items.map((b) => b.id)).toEqual([ids.a, ids.b, ids.c, ids.d]);
  });

  it('matches by author name and by ISBN', async () => {
    const byAuthor = await q(`zorbaxia alpha ${RUN}`);
    expect(byAuthor.items.map((b) => b.id)).toEqual([ids.a, ids.c]);

    const book = await prisma.book.findUniqueOrThrow({ where: { id: ids.a } });
    const byIsbn = await q(book.isbn!.slice(2, 9));
    expect(byIsbn.items.map((b) => b.id)).toContain(ids.a);
    const dashed = await q(`${book.isbn!.slice(0, 3)}-${book.isbn!.slice(3)}`);
    expect(dashed.items.map((b) => b.id)).toContain(ids.a);
  });

  it('applies categoryId, authorId and available together with the text', async () => {
    expect(
      (await q(TITLE, `&categoryId=${cat2}`)).items.map((b) => b.id),
    ).toEqual([ids.c, ids.d]);
    expect(
      (await q(TITLE, `&authorId=${authorB}`)).items.map((b) => b.id),
    ).toEqual([ids.b, ids.d]);
    // HELD không tính là còn sách: d chỉ có bản HELD nên bị loại, c còn một bản AVAILABLE
    const available = await q(TITLE, '&available=true');
    expect(available.items.map((b) => b.id)).toEqual([ids.a, ids.c]);
    expect(available.total).toBe(2);
    expect(available.items.find((b) => b.id === ids.c)!.copiesAvailable).toBe(
      1,
    );
    const none = await q(
      TITLE,
      `&available=true&categoryId=${cat1}&authorId=${authorB}`,
    );
    expect(none).toMatchObject({ items: [], total: 0 });
  });

  it('paginates with stable order and an exact total', async () => {
    const p1 = await q(TITLE, '&limit=3&page=1');
    const p2 = await q(TITLE, '&limit=3&page=2');
    const p3 = await q(TITLE, '&limit=3&page=3');
    expect(p1.items.map((b) => b.id)).toEqual([ids.a, ids.b, ids.c]);
    expect(p2.items.map((b) => b.id)).toEqual([ids.d]);
    expect(p3.items).toEqual([]);
    for (const p of [p1, p2, p3]) expect(p.total).toBe(4);
  });

  it('treats %, _ and \\ literally and survives quotes / unicode', async () => {
    expect((await q(`${TITLE} 100%`)).items.map((b) => b.id)).toEqual([ids.c]);
    expect((await q(`${TITLE} 100_`)).total).toBe(0);
    expect((await q(`${TITLE} 1\\`)).total).toBe(0);
    for (const odd of ["'; DROP TABLE books;--", 'ᛖ日本😀', '"quoted"'])
      expect((await q(odd)).total).toBeGreaterThanOrEqual(0);
    expect((await q('   ')).total).toBeGreaterThan(0); // chuỗi trống = không lọc chữ
  });
});
