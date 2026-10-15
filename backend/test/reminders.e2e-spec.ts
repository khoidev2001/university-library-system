import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}n`;
const SUFFIX = `${RUN}@rem.local`;
const TITLE = `REM ${RUN}`;
const DAY = 24 * 60 * 60 * 1000;

describeWithDb('Nhắc hạn trả và thông báo trùng (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notifications: NotificationsService;
  const loanIds: number[] = [];
  let userId: number;

  beforeAll(async () => {
    const e = await createE2eApp();
    ({ app, prisma } = e);
    notifications = app.get(NotificationsService, { strict: false });
    const librarian = await e.createUser(`lib${SUFFIX}`, Role.LIBRARIAN);
    const reader = await e.createUser(`rd${SUFFIX}`, Role.READER, {
      memberCode: `REM${RUN}`,
    });
    userId = reader.id;
    const category = await prisma.category.create({
      data: { name: `REM Cat ${RUN}`, slug: `rem-cat-${RUN}` },
    });
    const book = await prisma.book.create({
      data: {
        title: TITLE,
        price: 1000,
        categoryId: category.id,
        copies: {
          create: Array.from({ length: 5 }, (_, i) => ({
            barcode: `REM-${RUN}-${i}`,
            status: 'BORROWED' as const,
          })),
        },
      },
      include: { copies: true },
    });
    // 3 phiếu quá hạn + 2 phiếu sắp đến hạn
    const dues = [-10, -5, -3, 1, 2].map((d) => new Date(Date.now() + d * DAY));
    for (const [i, copy] of book.copies.entries()) {
      const loan = await prisma.loan.create({
        data: {
          copyId: copy.id,
          userId: reader.id,
          createdById: librarian.id,
          dueAt: dues[i],
        },
      });
      loanIds.push(loan.id);
    }
  });

  afterAll(async () => {
    await cleanupE2eData(prisma, {
      emailSuffix: SUFFIX,
      bookTitlePrefix: TITLE,
    });
    await prisma.category.deleteMany({ where: { slug: { contains: RUN } } });
    await app.close();
  });

  const mine = () =>
    prisma.notification.findMany({
      where: { userId, type: { in: ['LOAN_OVERDUE', 'LOAN_DUE_SOON'] } },
      orderBy: { id: 'asc' },
    });

  it('walks every batch: with batch size 2, all five loans are reminded (not only the first batch)', async () => {
    await notifications.sendLoanReminders(new Date(), 2);
    const sent = await mine();
    expect(sent).toHaveLength(5);
    expect(sent.filter((n) => n.type === 'LOAN_OVERDUE')).toHaveLength(3);
    expect(sent.filter((n) => n.type === 'LOAN_DUE_SOON')).toHaveLength(2);
    expect(new Set(sent.map((n) => n.dedupeKey)).size).toBe(5);
  });

  it('is idempotent and survives two reminder runs racing each other (no unique-violation, no duplicates)', async () => {
    const runs = await Promise.all([
      notifications.sendLoanReminders(new Date(), 2),
      notifications.sendLoanReminders(new Date(), 3),
      notifications.sendLoanReminders(),
    ]);
    // lần nhắc thứ nhất đã gửi đủ: ba lượt này không tạo thêm thông báo nào cho phiếu của test
    expect(runs.every((r) => r.dueSoon >= 0 && r.overdue >= 0)).toBe(true);
    expect(await mine()).toHaveLength(5);
  });

  it('notify() with a taken dedupeKey returns false instead of throwing', async () => {
    const key = `rem:${RUN}:x`;
    const first = await notifications.notify({
      userId,
      type: 'TEST',
      title: 't',
      body: 'b',
      dedupeKey: key,
    });
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        notifications.notify({
          userId,
          type: 'TEST',
          title: 't',
          body: 'b',
          dedupeKey: key,
        }),
      ),
    );
    expect(first).toBe(true);
    expect(results).toEqual([false, false, false]);
    expect(await prisma.notification.count({ where: { dedupeKey: key } })).toBe(
      1,
    );
  });
});
