/**
 * Sinh lịch sử mượn/trả mô phỏng từ rating goodbooks (docs/PLAN.md mục 6).
 *
 * QUAN TRỌNG — dữ liệu này là MÔ PHỎNG, không phải số liệu thật của thư viện:
 * nhãn "trả trễ" được sinh theo xác suất có nhiễu (không theo luật cứng), nên mô hình
 * dự báo ở Sprint 3 học quy luật mô phỏng này. Báo cáo phải ghi rõ điều đó.
 *
 * Quy ước: rating >= 4 ⇒ bạn đọc đó đã từng mượn cuốn sách đó.
 * Chạy: pnpm seed:loans   (đặt SEED_LOANS_RESET=1 để xoá lịch sử cũ)
 */
import { CopyStatus, FineType, LoanStatus, MemberType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HISTORY_MONTHS = 12;
const MAX_LOANS = Number(process.env.SEED_LOANS_MAX ?? 12000);
const EXAM_MONTHS = new Set([1, 6]); // tháng thi: trễ nhiều hơn

/** Bộ sinh số giả ngẫu nhiên có hạt giống — chạy lại cho ra cùng dữ liệu. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const random = createRandom(20261005);

/** Xác suất trả trễ: nền 15%, cộng thêm theo số sách đang giữ, mùa thi, tiền sử trễ, có nhiễu. */
function overdueProbability(concurrent: number, month: number, priorOverdue: number): number {
  let p = 0.15 + 0.08 * concurrent + (EXAM_MONTHS.has(month) ? 0.15 : 0) + Math.min(0.2, 0.1 * priorOverdue);
  p += (random() - 0.5) * 0.1; // nhiễu ±5%
  return Math.min(0.9, Math.max(0.02, p));
}

interface PlannedLoan {
  copyId: number;
  userId: number;
  createdById: number;
  borrowedAt: Date;
  dueAt: Date;
  returnedAt: Date | null;
  status: LoanStatus;
  renewedCount: number;
}

async function main(): Promise<void> {
  const existing = await prisma.loan.count();
  if (existing > 0 && process.env.SEED_LOANS_RESET !== '1') {
    console.log(`Đã có ${existing} phiếu mượn. Đặt SEED_LOANS_RESET=1 để sinh lại.`);
    return;
  }
  if (existing > 0) {
    console.log('Xoá lịch sử mượn/trả cũ...');
    await prisma.$transaction([
      prisma.fine.deleteMany(),
      prisma.loan.deleteMany(),
      prisma.bookCopy.updateMany({ where: { status: CopyStatus.BORROWED }, data: { status: CopyStatus.AVAILABLE } }),
    ]);
  }

  const librarians = await prisma.user.findMany({ where: { role: 'LIBRARIAN' }, select: { id: true } });
  if (librarians.length === 0) throw new Error('Chưa có tài khoản thủ thư — chạy `pnpm prisma db seed` trước.');

  const policies = await prisma.loanPolicy.findMany();
  const loanDaysOf = new Map(policies.map((p) => [p.memberType, p.loanDays]));

  const readers = await prisma.user.findMany({
    where: { role: 'READER' },
    select: { id: true, memberType: true },
  });
  const readerType = new Map(readers.map((r) => [r.id, r.memberType ?? MemberType.STUDENT]));

  const copiesByBook = new Map<number, number[]>();
  for (const copy of await prisma.bookCopy.findMany({ select: { id: true, bookId: true } })) {
    const list = copiesByBook.get(copy.bookId) ?? [];
    list.push(copy.id);
    copiesByBook.set(copy.bookId, list);
  }

  const ratings = await prisma.rating.findMany({
    where: { score: { gte: 4 } },
    select: { userId: true, bookId: true },
    take: MAX_LOANS,
  });
  console.log(`${ratings.length} lượt mượn dự kiến từ rating >= 4`);

  const now = Date.now();
  const windowMs = HISTORY_MONTHS * 30 * MS_PER_DAY;
  const planned: PlannedLoan[] = [];
  const activeCopy = new Set<number>(); // mỗi bản sao chỉ 1 phiếu ACTIVE
  const priorOverdueOf = new Map<number, number>();
  const concurrentOf = new Map<number, number>();

  for (const [index, rating] of ratings.entries()) {
    const copies = copiesByBook.get(rating.bookId);
    if (!copies?.length) continue;
    const copyId = copies[index % copies.length];

    const loanDays = loanDaysOf.get(readerType.get(rating.userId) ?? MemberType.STUDENT) ?? 14;
    const borrowedAt = new Date(now - windowMs + random() * windowMs);
    const dueAt = new Date(borrowedAt.getTime() + loanDays * MS_PER_DAY);

    const concurrent = concurrentOf.get(rating.userId) ?? 0;
    const priorOverdue = priorOverdueOf.get(rating.userId) ?? 0;
    const late = random() < overdueProbability(concurrent, borrowedAt.getMonth() + 1, priorOverdue);

    // Chưa trả: phiếu còn hạn, hoặc một phần phiếu trễ mà bạn đọc vẫn đang giữ sách
    // (cần có để báo cáo "bạn đọc quá hạn" và quy tắc BR-03 có dữ liệu thật).
    const notYetDue = dueAt.getTime() > now;
    const stillOutAndLate = !notYetDue && late && random() < 0.08;
    const stillOut = (notYetDue || stillOutAndLate) && !activeCopy.has(copyId);
    if (stillOut) {
      if (stillOutAndLate) priorOverdueOf.set(rating.userId, priorOverdue + 1);
      activeCopy.add(copyId);
      concurrentOf.set(rating.userId, concurrent + 1);
      planned.push({
        copyId,
        userId: rating.userId,
        createdById: librarians[index % librarians.length].id,
        borrowedAt,
        dueAt,
        returnedAt: null,
        status: LoanStatus.ACTIVE,
        renewedCount: random() < 0.15 ? 1 : 0,
      });
      continue;
    }

    const lateDays = late ? 1 + Math.floor(random() * 20) : 0;
    const returnedAt = new Date(dueAt.getTime() + (late ? lateDays * MS_PER_DAY : -random() * loanDays * MS_PER_DAY));
    if (returnedAt.getTime() > now) continue; // chưa tới ngày trả thật thì bỏ qua
    if (late) priorOverdueOf.set(rating.userId, priorOverdue + 1);

    planned.push({
      copyId,
      userId: rating.userId,
      createdById: librarians[index % librarians.length].id,
      borrowedAt,
      dueAt,
      returnedAt,
      status: LoanStatus.RETURNED,
      renewedCount: 0,
    });
  }

  console.log(`Ghi ${planned.length} phiếu mượn...`);
  for (let i = 0; i < planned.length; i += 2000) {
    await prisma.loan.createMany({ data: planned.slice(i, i + 2000) });
  }
  const activeCopyIds = [...activeCopy];
  for (let i = 0; i < activeCopyIds.length; i += 2000) {
    await prisma.bookCopy.updateMany({
      where: { id: { in: activeCopyIds.slice(i, i + 2000) } },
      data: { status: CopyStatus.BORROWED },
    });
  }

  // Phạt cho các phiếu đã trả trễ; đa số đã thu, một phần còn nợ để demo chặn mượn (BR-04)
  const lateLoans = await prisma.loan.findMany({
    where: { status: LoanStatus.RETURNED },
    select: { id: true, dueAt: true, returnedAt: true, user: { select: { memberType: true } } },
  });
  const finePerDay = new Map(policies.map((p) => [p.memberType, p.finePerDay]));
  const librarianId = librarians[0].id;
  const fines = lateLoans
    .filter((l) => l.returnedAt && l.returnedAt > l.dueAt)
    .map((l) => {
      const days = Math.ceil((l.returnedAt!.getTime() - l.dueAt.getTime()) / MS_PER_DAY);
      const paid = random() < 0.8;
      return {
        loanId: l.id,
        type: FineType.OVERDUE,
        amount: days * (finePerDay.get(l.user.memberType ?? MemberType.STUDENT) ?? 5000),
        createdAt: l.returnedAt!,
        paidAt: paid ? new Date(l.returnedAt!.getTime() + MS_PER_DAY) : null,
        paidToId: paid ? librarianId : null,
      };
    });
  for (let i = 0; i < fines.length; i += 2000) {
    await prisma.fine.createMany({ data: fines.slice(i, i + 2000) });
  }

  const [active, overdue, unpaid] = await Promise.all([
    prisma.loan.count({ where: { status: LoanStatus.ACTIVE } }),
    prisma.loan.count({ where: { status: LoanStatus.ACTIVE, dueAt: { lt: new Date() } } }),
    prisma.fine.count({ where: { paidAt: null } }),
  ]);
  console.log(
    `Xong: ${planned.length} phiếu (${active} đang mượn, ${overdue} quá hạn), ${fines.length} khoản phạt (${unpaid} chưa thu).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
