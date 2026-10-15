import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CirculationScheduler } from '../src/modules/notifications/circulation.scheduler';
import { ReminderEmailService } from '../src/modules/notifications/reminder-email.service';
import { MailService } from '../src/modules/mail/mail.service';
import { InMemoryMailSender } from '../src/modules/mail/memory-mail.sender';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}m`;
const SUFFIX = `${RUN}@remail.local`;
const TITLE = `REMAIL ${RUN}`;
const DAY = 24 * 60 * 60 * 1000;

describeWithDb('Email nhắc hạn trả: gửi một lần, thử lại khi lỗi (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailbox: InMemoryMailSender;
  let mail: MailService;
  let emails: ReminderEmailService;
  let librarianId: number;
  let copySeq = 0;
  let categoryId: number;
  let bookId: number;
  let userSeq = 0;
  /** Chạy trong phạm vi các bạn đọc của file này: spec khác chạy song song trên cùng DB. */
  const ids: number[] = [];
  const run = (at: Date = new Date(), extra: { maxAttempts?: number } = {}) =>
    emails.sendDueEmails(at, {
      paceMs: 0,
      ...extra,
      onlyUserIds: [...ids],
    });

  const newReader = async (
    extra: {
      emailReminders?: boolean;
      isActive?: boolean;
    } = {},
  ) => {
    userSeq += 1;
    const user = await prisma.user.create({
      data: {
        email: `rd${userSeq}${SUFFIX}`,
        passwordHash: 'x',
        fullName: `Bạn đọc ${userSeq}`,
        role: Role.READER,
        memberType: 'STUDENT',
        memberCode: `RM${RUN}${userSeq}`,
        ...extra,
      },
    });
    ids.push(user.id);
    return user;
  };

  /** Mượn một bản sao, hạn trả sau `days` ngày (âm = quá hạn). */
  const newLoan = async (userId: number, days: number) => {
    copySeq += 1;
    const copy = await prisma.bookCopy.create({
      data: {
        bookId,
        barcode: `RM-${RUN}-${copySeq}`,
        status: 'BORROWED',
      },
    });
    return prisma.loan.create({
      data: {
        copyId: copy.id,
        userId,
        createdById: librarianId,
        dueAt: new Date(Date.now() + days * DAY),
      },
    });
  };

  const rowsOf = (userId: number) =>
    prisma.reminderEmail.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
    });

  beforeAll(async () => {
    const e = await createE2eApp();
    ({ app, prisma, mailbox } = e);
    mail = app.get(MailService);
    emails = app.get(ReminderEmailService, { strict: false });
    librarianId = (await e.createUser(`lib${SUFFIX}`, Role.LIBRARIAN)).id;
    const category = await prisma.category.create({
      data: { name: `REMAIL Cat ${RUN}`, slug: `remail-cat-${RUN}` },
    });
    categoryId = category.id;
    bookId = (
      await prisma.book.create({
        data: { title: TITLE, price: 1000, categoryId },
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

  beforeEach(() => mailbox.clear());

  it('sends one grouped mail per kind, never again on later runs, and respects the opt-out and locked accounts', async () => {
    const reader = await newReader();
    const optedOut = await newReader({ emailReminders: false });
    const locked = await newReader({ isActive: false });
    const l1 = await newLoan(reader.id, -10);
    const l2 = await newLoan(reader.id, -3);
    const l3 = await newLoan(reader.id, 1);
    await newLoan(optedOut.id, -5);
    await newLoan(locked.id, -5);
    await newLoan(reader.id, 20); // chưa tới hạn nhắc

    const first = await run();
    expect(first.sent).toBeGreaterThanOrEqual(2);
    const mine = mailbox.to(reader.email);
    expect(mine).toHaveLength(2);
    const overdueMail = mine.find((m) => m.subject.includes('quá hạn'))!;
    const dueMail = mine.find((m) => m.subject.includes('sắp đến hạn'))!;
    expect(overdueMail.subject).toBe('Bạn có 2 cuốn sách đã quá hạn trả');
    expect(overdueMail.text.match(new RegExp(TITLE, 'g'))).toHaveLength(2);
    expect(dueMail.subject).toBe('Sách sắp đến hạn trả');
    expect(overdueMail.text).toContain('/account'); // liên kết tắt nhắc
    expect(mailbox.to(optedOut.email)).toHaveLength(0);
    expect(mailbox.to(locked.email)).toHaveLength(0);

    const rows = await rowsOf(reader.id);
    expect(rows.map((r) => [r.loanId, r.kind, r.status]).sort()).toEqual(
      [
        [l1.id, 'overdue', 'SENT'],
        [l2.id, 'overdue', 'SENT'],
        [l3.id, 'due', 'SENT'],
      ].sort(),
    );
    expect(await rowsOf(optedOut.id)).toHaveLength(0);
    expect(await rowsOf(locked.id)).toHaveLength(0);

    const sentBefore = mailbox.outbox.length;
    const again = await run();
    const thirdRun = await run();
    expect(again.queued + thirdRun.queued).toBe(0);
    expect(mailbox.to(reader.email)).toHaveLength(2);
    expect(mailbox.outbox.length).toBe(sentBefore);
  });

  it('moves a due-soon loan to a second, different mail once it becomes overdue (one per loan+kind)', async () => {
    const reader = await newReader();
    await newLoan(reader.id, 1);
    await run();
    expect(mailbox.to(reader.email)).toHaveLength(1);
    // ba ngày sau: cùng phiếu giờ đã quá hạn
    await run(new Date(Date.now() + 3 * DAY));
    const sent = mailbox.to(reader.email);
    expect(sent).toHaveLength(2);
    expect(sent[1].subject).toContain('quá hạn');
    await run(new Date(Date.now() + 4 * DAY));
    expect(mailbox.to(reader.email)).toHaveLength(2);
  });

  it('keeps the row PENDING when the provider fails, retries on the next run, and never duplicates after success', async () => {
    const reader = await newReader();
    await newLoan(reader.id, -2);
    mailbox.failNext = 1;

    const failed = await run();
    expect(failed.failed).toBeGreaterThanOrEqual(1);
    expect(mailbox.to(reader.email)).toHaveLength(0);
    let [row] = await rowsOf(reader.id);
    expect(row).toMatchObject({
      status: 'PENDING',
      attempts: 1,
      claimedAt: null,
    });
    expect(row.lastError).toContain('Giả lập lỗi');

    await run();
    expect(mailbox.to(reader.email)).toHaveLength(1);
    [row] = await rowsOf(reader.id);
    expect(row).toMatchObject({ status: 'SENT', attempts: 2 });
    expect(row.sentAt).not.toBeNull();

    await run();
    await run();
    expect(mailbox.to(reader.email)).toHaveLength(1);
  });

  it('gives up after maxAttempts and on non-retryable errors (FAILED is never retried)', async () => {
    const flaky = await newReader();
    await newLoan(flaky.id, -2);
    mailbox.failNext = 100;
    mailbox.failRetryable = true;
    const opts = { maxAttempts: 2 };
    await run(new Date(), opts);
    await run(new Date(), opts);
    expect((await rowsOf(flaky.id))[0]).toMatchObject({
      status: 'FAILED',
      attempts: 2,
    });
    mailbox.clear();
    await run(new Date(), opts);
    expect(mailbox.attempts).toBe(0); // không thử lại nữa

    const rejected = await newReader();
    await newLoan(rejected.id, -2);
    mailbox.failNext = 100;
    mailbox.failRetryable = false;
    await run();
    expect((await rowsOf(rejected.id))[0]).toMatchObject({
      status: 'FAILED',
      attempts: 1,
    });
    mailbox.clear();
    mailbox.failRetryable = true;
  });

  it('sends one mail even when two runs race for the same rows', async () => {
    const reader = await newReader();
    await newLoan(reader.id, -4);
    await Promise.all([run(), run(), run()]);
    expect(mailbox.to(reader.email)).toHaveLength(1);
    expect((await rowsOf(reader.id))[0].status).toBe('SENT');
  });

  it('skips rows whose loan was returned meanwhile, and honours an opt-out made after a failure', async () => {
    const returned = await newReader();
    const loan = await newLoan(returned.id, -4);
    await prisma.reminderEmail.create({
      data: { loanId: loan.id, userId: returned.id, kind: 'overdue' },
    });
    await prisma.loan.update({
      where: { id: loan.id },
      data: { status: 'RETURNED', returnedAt: new Date() },
    });
    await run();
    expect(mailbox.to(returned.email)).toHaveLength(0);
    expect((await rowsOf(returned.id))[0].status).toBe('SKIPPED');

    const changedMind = await newReader();
    await newLoan(changedMind.id, -4);
    mailbox.failNext = 1;
    await run();
    expect((await rowsOf(changedMind.id))[0].status).toBe('PENDING');
    await prisma.user.update({
      where: { id: changedMind.id },
      data: { emailReminders: false },
    });
    await run();
    expect(mailbox.to(changedMind.email)).toHaveLength(0);
  });

  it('takes over a claim abandoned by a dead process but leaves a fresh claim alone', async () => {
    const reader = await newReader();
    const l1 = await newLoan(reader.id, -4);
    const l2 = await newLoan(reader.id, -6);
    await prisma.reminderEmail.createMany({
      data: [
        {
          loanId: l1.id,
          userId: reader.id,
          kind: 'overdue',
          attempts: 1,
          claimedAt: new Date(Date.now() - 60 * 60_000),
        },
        {
          loanId: l2.id,
          userId: reader.id,
          kind: 'overdue',
          attempts: 1,
          claimedAt: new Date(Date.now() - 30_000),
        },
      ],
    });
    await run();
    const rows = await rowsOf(reader.id);
    const byLoan = new Map(rows.map((r) => [r.loanId, r]));
    expect(byLoan.get(l1.id)!.status).toBe('SENT');
    expect(byLoan.get(l2.id)!.status).toBe('PENDING'); // đang được tiến trình khác giữ
    expect(mailbox.to(reader.email)).toHaveLength(1);
    expect(mailbox.to(reader.email)[0].text).toContain('quá hạn');
  });

  it('does nothing and records no state when mail is not configured; configuring later catches up', async () => {
    const reader = await newReader();
    await newLoan(reader.id, -4);
    mailbox.enabled = false;
    try {
      const res = await run();
      expect(res).toEqual({ queued: 0, sent: 0, failed: 0, skipped: 0 });
    } finally {
      mailbox.enabled = true;
    }
    expect(await rowsOf(reader.id)).toHaveLength(0);
    await run();
    expect(mailbox.to(reader.email)).toHaveLength(1);
  });

  it('the scheduler tick sends the in-app reminder and the e-mail, and a mail crash does not stop it', async () => {
    const scheduler = app.get(CirculationScheduler, { strict: false });
    const reader = await newReader();
    const loan = await newLoan(reader.id, -4);
    mailbox.failNext = 1;
    // tick() gọi cùng service; thu hẹp vào bạn đọc của bài này (spec khác chạy song song trên DB)
    const real = emails.sendDueEmails.bind(emails);
    const spy = jest
      .spyOn(emails, 'sendDueEmails')
      .mockImplementation((at, o) =>
        real(at, { ...o, paceMs: 0, onlyUserIds: [reader.id] }),
      );
    await scheduler.tick();
    const inApp = await prisma.notification.count({
      where: { userId: reader.id, dedupeKey: `loan:${loan.id}:overdue` },
    });
    expect(inApp).toBe(1); // thông báo trong web vẫn có dù email lỗi
    expect((await rowsOf(reader.id))[0].status).toBe('PENDING');
    await scheduler.tick();
    expect(mailbox.to(reader.email)).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
    await mail.drain();
  });
});
