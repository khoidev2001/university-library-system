/**
 * Seed dữ liệu mẫu (docs/PLAN.md mục 6):
 *  - chính sách mượn mặc định, tài khoản demo (admin, 2 thủ thư, 1 SV, 1 GV)
 *  - 1.000 sách goodbooks-10k (+ mô tả Google Books nếu có cache), tác giả, thể loại, 1-3 bản sao/sách
 *  - 2.000 bạn đọc goodbooks + 231k rating (nuôi AI)
 * Lịch sử mượn/trả mô phỏng được sinh ở Sprint 2 (cần LoansService).
 *
 * Chạy: pnpm prisma db seed   (đặt SEED_RESET=1 để xoá dữ liệu cũ trước)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemberType, Prisma, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { readCsv } from './csv';

const prisma = new PrismaClient();
const DATA = join(__dirname, 'data');

export const DEMO_PASSWORD = { staff: 'Admin@123', reader: 'Reader@123' };

const DEFAULT_POLICIES = [
  { memberType: MemberType.STUDENT, maxBooks: 3, loanDays: 14, renewLimit: 1, renewExtraDays: 7, finePerDay: 5000 },
  { memberType: MemberType.LECTURER, maxBooks: 5, loanDays: 30, renewLimit: 1, renewExtraDays: 14, finePerDay: 5000 },
];

interface GoogleInfo {
  description?: string | null;
  publisher?: string | null;
  pageCount?: number | null;
}

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Giá bìa giả định, ổn định theo id: 80.000đ – 250.000đ, bội số 1.000. */
function fakePrice(goodbooksId: number, pageCount?: number | null): number {
  if (pageCount) return Math.max(50_000, Math.round((pageCount * 500) / 1000) * 1000);
  return 80_000 + ((goodbooksId * 7919) % 171) * 1000;
}

async function reset(): Promise<void> {
  await prisma.$transaction([
    prisma.fine.deleteMany(),
    prisma.loan.deleteMany(),
    prisma.rating.deleteMany(),
    prisma.bookCopy.deleteMany(),
    prisma.bookAuthor.deleteMany(),
    prisma.book.deleteMany(),
    prisma.author.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
    prisma.loanPolicy.deleteMany(),
  ]);
}

async function seedPolicies(): Promise<void> {
  for (const p of DEFAULT_POLICIES) {
    await prisma.loanPolicy.upsert({ where: { memberType: p.memberType }, update: {}, create: p });
  }
}

async function seedStaffAndDemo(): Promise<void> {
  const staffHash = await bcrypt.hash(DEMO_PASSWORD.staff, 10);
  const readerHash = await bcrypt.hash(DEMO_PASSWORD.reader, 10);
  const accounts: Prisma.UserCreateInput[] = [
    { email: 'admin@uls.local', passwordHash: staffHash, fullName: 'Quản trị hệ thống', role: Role.ADMIN },
    { email: 'librarian1@uls.local', passwordHash: staffHash, fullName: 'Thủ thư Lan', role: Role.LIBRARIAN },
    { email: 'librarian2@uls.local', passwordHash: staffHash, fullName: 'Thủ thư Minh', role: Role.LIBRARIAN },
    {
      email: 'reader@uls.local',
      passwordHash: readerHash,
      fullName: 'Trần Đình Khôi',
      role: Role.READER,
      memberType: MemberType.STUDENT,
      memberCode: '23Q74802012006',
    },
    {
      email: 'lecturer@uls.local',
      passwordHash: readerHash,
      fullName: 'Lê Tỷ Khánh',
      role: Role.READER,
      memberType: MemberType.LECTURER,
      memberCode: 'GV0001',
    },
  ];
  for (const a of accounts) {
    await prisma.user.upsert({ where: { email: a.email }, update: {}, create: a });
  }
}

async function seedCatalog(): Promise<Map<number, number>> {
  const rows = readCsv(join(DATA, 'books.csv'));
  const googlePath = join(DATA, 'google-books.json');
  const google: Record<string, GoogleInfo | null> = existsSync(googlePath)
    ? (JSON.parse(readFileSync(googlePath, 'utf8')) as Record<string, GoogleInfo | null>)
    : {};

  const categoryIds = new Map<string, number>();
  for (const name of new Set(rows.map((r) => r.genre))) {
    const c = await prisma.category.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) } });
    categoryIds.set(name, c.id);
  }

  const authorIds = new Map<string, number>();
  const authorNames = new Set(rows.flatMap((r) => r.authors.split(',').map((a) => a.trim()).filter(Boolean)));
  await prisma.author.createMany({ data: [...authorNames].map((name) => ({ name })), skipDuplicates: true });
  for (const a of await prisma.author.findMany()) authorIds.set(a.name, a.id);

  const goodbooksToBookId = new Map<number, number>();
  let withDescription = 0;
  for (const [index, r] of rows.entries()) {
    const goodbooksId = Number(r.goodbooks_id);
    const info = google[r.isbn13] ?? null;
    if (info?.description) withDescription++;
    const year = Number(r.year) > 0 ? Number(r.year) : null;
    const book = await prisma.book.create({
      data: {
        goodbooksId,
        isbn: r.isbn13,
        title: r.title,
        description: info?.description ?? null,
        publisher: info?.publisher ?? null,
        publishedYear: year,
        price: fakePrice(goodbooksId, info?.pageCount),
        coverUrl: r.image_url || null,
        categoryId: categoryIds.get(r.genre)!,
        authors: {
          // Set: cùng một tác giả có thể xuất hiện hai lần trong chuỗi goodbooks
          create: [...new Set(r.authors.split(',').map((a) => a.trim()))]
            .filter((a) => authorIds.has(a))
            .map((a) => ({ authorId: authorIds.get(a)! })),
        },
      },
    });
    goodbooksToBookId.set(goodbooksId, book.id);

    // Sách được đọc nhiều có nhiều bản: top 300 → 3 bản, 300-700 → 2, còn lại 1
    const copies = index < 300 ? 3 : index < 700 ? 2 : 1;
    await prisma.bookCopy.createMany({
      data: Array.from({ length: copies }, (_, n) => ({
        bookId: book.id,
        barcode: `LIB-${String(book.id).padStart(6, '0')}-${n + 1}`,
        shelfLocation: `${String.fromCharCode(65 + (book.id % 6))}${(book.id % 12) + 1}-${String((book.id % 30) + 1).padStart(2, '0')}`,
      })),
    });
    if ((index + 1) % 200 === 0) console.log(`  books ${index + 1}/${rows.length}`);
  }
  console.log(`  ${withDescription}/${rows.length} sách có mô tả từ Google Books`);
  return goodbooksToBookId;
}

async function seedReadersAndRatings(goodbooksToBookId: Map<number, number>): Promise<void> {
  const ratings = readCsv(join(DATA, 'ratings.csv'));
  const userIds = [...new Set(ratings.map((r) => Number(r.user_id)))].sort((a, b) => a - b);
  const readerHash = await bcrypt.hash(DEMO_PASSWORD.reader, 10); // một hash chung cho dữ liệu mẫu

  await prisma.user.createMany({
    skipDuplicates: true,
    data: userIds.map((uid) => {
      const lecturer = uid % 10 === 0;
      return {
        email: lecturer ? `gv${uid}@uls.local` : `sv${uid}@student.uls.local`,
        passwordHash: readerHash,
        fullName: lecturer ? `Giảng viên ${uid}` : `Sinh viên ${uid}`,
        role: Role.READER,
        memberType: lecturer ? MemberType.LECTURER : MemberType.STUDENT,
        memberCode: lecturer ? `GV${String(uid).padStart(5, '0')}` : `SV${String(uid).padStart(6, '0')}`,
      };
    }),
  });
  const dbUsers = await prisma.user.findMany({ where: { role: Role.READER }, select: { id: true, memberCode: true } });
  const codeToId = new Map(dbUsers.map((u) => [u.memberCode, u.id]));
  const uidToId = (uid: number) =>
    codeToId.get(uid % 10 === 0 ? `GV${String(uid).padStart(5, '0')}` : `SV${String(uid).padStart(6, '0')}`);

  const data = ratings
    .map((r) => ({
      userId: uidToId(Number(r.user_id)),
      bookId: goodbooksToBookId.get(Number(r.book_id)),
      score: Number(r.rating),
    }))
    .filter((r): r is { userId: number; bookId: number; score: number } => !!r.userId && !!r.bookId);
  for (let i = 0; i < data.length; i += 5000) {
    await prisma.rating.createMany({ data: data.slice(i, i + 5000), skipDuplicates: true });
  }
  console.log(`  ${userIds.length} bạn đọc, ${data.length} rating`);
}

async function main(): Promise<void> {
  const existing = await prisma.book.count();
  if (existing > 0 && process.env.SEED_RESET !== '1') {
    console.log(`Đã có ${existing} sách. Đặt SEED_RESET=1 để xoá và seed lại.`);
    return;
  }
  if (existing > 0) {
    console.log('Xoá dữ liệu cũ...');
    await reset();
  }
  console.log('Chính sách mượn + tài khoản demo');
  await seedPolicies();
  await seedStaffAndDemo();
  console.log('Sách, tác giả, thể loại, bản sao');
  const map = await seedCatalog();
  console.log('Bạn đọc + rating');
  await seedReadersAndRatings(map);
  console.log('Xong. Tài khoản demo: admin@uls.local / Admin@123 · librarian1@uls.local / Admin@123 · reader@uls.local / Reader@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
