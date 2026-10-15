import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL).
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}l`;
const SUFFIX = `${RUN}@lbl.local`;
const TITLE = `LBL ${RUN}`;

describeWithDb('Dữ liệu in nhãn bản sao (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let api: ReturnType<typeof request>;
  let auth: (t: string) => Record<string, string>;
  let lib: string;
  let reader: string;
  let bookA: number;
  let bookB: number;
  const copyIds: number[] = [];

  beforeAll(async () => {
    const e = await createE2eApp();
    ({ app, prisma, auth } = e);
    api = e.http;
    lib = e.tokenFor(await e.createUser(`lib${SUFFIX}`, Role.LIBRARIAN));
    reader = e.tokenFor(
      await e.createUser(`rd${SUFFIX}`, Role.READER, {
        memberCode: `LBL${RUN}`,
      }),
    );
    const cat = await prisma.category.create({
      data: { name: `LBL Cat ${RUN}`, slug: `lbl-cat-${RUN}` },
    });
    const mk = async (suffix: string, n: number) => {
      const b = await prisma.book.create({
        data: {
          title: `${TITLE} ${suffix}`,
          isbn: null,
          price: 1,
          categoryId: cat.id,
          copies: {
            create: Array.from({ length: n }, (_, i) => ({
              barcode: `LBL-${RUN}-${suffix}-${i}`,
              shelfLocation: i === 0 ? 'Kệ A1' : null,
            })),
          },
        },
        include: { copies: { orderBy: { id: 'asc' } } },
      });
      copyIds.push(...b.copies.map((c) => c.id));
      return b;
    };
    bookA = (await mk('A', 3)).id;
    bookB = (await mk('B', 2)).id;
  });

  afterAll(async () => {
    await cleanupE2eData(prisma, {
      emailSuffix: SUFFIX,
      bookTitlePrefix: TITLE,
    });
    await prisma.category.deleteMany({ where: { slug: { contains: RUN } } });
    await app.close();
  });

  it('chỉ thủ thư xem được: không token 401, bạn đọc 403', async () => {
    expect((await api.get(`/api/copies/labels?bookIds=${bookA}`)).status).toBe(
      401,
    );
    expect(
      (await api.get(`/api/copies/labels?bookIds=${bookA}`).set(auth(reader)))
        .status,
    ).toBe(403);
  });

  it('theo bookIds: đủ bản sao, kèm tiêu đề sách, xếp theo sách rồi mã', async () => {
    const res = await api
      .get(`/api/copies/labels?bookIds=${bookB},${bookA}`)
      .set(auth(lib));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    expect(res.body[0]).toMatchObject({
      barcode: `LBL-${RUN}-A-0`,
      shelfLocation: 'Kệ A1',
      status: 'AVAILABLE',
      book: { id: bookA, title: `${TITLE} A`, isbn: null },
    });
    expect(res.body.map((c: { book: { id: number } }) => c.book.id)).toEqual([
      bookA,
      bookA,
      bookA,
      bookB,
      bookB,
    ]);
  });

  it('theo copyIds: đúng các bản sao chọn; gộp được cả hai tiêu chí không trùng lặp', async () => {
    const one = await api
      .get(`/api/copies/labels?copyIds=${copyIds[1]},${copyIds[4]}`)
      .set(auth(lib));
    expect(one.body.map((c: { id: number }) => c.id)).toEqual([
      copyIds[1],
      copyIds[4],
    ]);
    const both = await api
      .get(
        `/api/copies/labels?bookIds=${bookB}&copyIds=${copyIds[0]},${copyIds[3]}`,
      )
      .set(auth(lib));
    expect(both.body.map((c: { id: number }) => c.id)).toEqual([
      copyIds[0],
      copyIds[3],
      copyIds[4],
    ]);
  });

  it.each([
    ['', 'không truyền gì'],
    ['?bookIds=abc', 'không phải số'],
    ['?bookIds=1,,x', 'có phần tử rác'],
    ['?bookIds=99999999999', 'tràn INT4'],
    ['?copyIds=0', 'id 0'],
    ['?foo=1', 'tham số lạ'],
  ])('đầu vào sai %s (%s) → 400', async (qs) => {
    expect(
      (await api.get(`/api/copies/labels${qs}`).set(auth(lib))).status,
    ).toBe(400);
  });

  it('quá 200 đầu sách trong một lần → 400', async () => {
    const ids = Array.from({ length: 201 }, (_, i) => i + 1).join(',');
    expect(
      (await api.get(`/api/copies/labels?bookIds=${ids}`).set(auth(lib)))
        .status,
    ).toBe(400);
  });
});
