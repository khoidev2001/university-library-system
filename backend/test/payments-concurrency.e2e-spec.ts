import { INestApplication } from '@nestjs/common';
import { PaymentStatus, Role } from '@prisma/client';
import request from 'supertest';
import { FinesService } from '../src/modules/fines/fines.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';
import {
  createFineFixture,
  setVnpayEnv,
  vnpayCallback,
} from './support/vnpay-fixtures';

// Postgres thật; các lời gọi song song bắn đồng thời để kiểm khoá dòng và chỉ mục duy nhất từng phần.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}q`;
const SUFFIX = `${RUN}@payc.local`;
const TITLE = `PAYC ${RUN}`;
const ROUNDS = 6;
/** Lệch ngẫu nhiên 0-9ms để các vòng lặp rơi vào cả hai thứ tự thắng, không chỉ một. */
const jitter = (maxMs = 10) =>
  new Promise<void>((resolve) => setTimeout(resolve, Math.random() * maxMs));

// Các bài đua chạy nhiều vòng song song; mặc định 5 giây của jest quá chặt khi máy (hoặc CI) đang bận.
jest.setTimeout(60_000);

describeWithDb('Thanh toán phạt VNPay: đua nhau (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let payments: PaymentsService;
  let fines: FinesService;
  let restoreEnv: () => void;
  let makeFine: Awaited<ReturnType<typeof createFineFixture>>['makeFine'];
  let readerId: number;
  let libId: number;

  const create = (fineIds?: number[]) =>
    payments.create(readerId, { fineIds }, '203.0.113.7');
  const ipn = (q: Record<string, string>) =>
    http.get('/api/payments/vnpay/ipn').query(q);
  const reader = () => ({ id: readerId, role: Role.READER, memberType: null });

  beforeAll(async () => {
    restoreEnv = setVnpayEnv();
    const e = await createE2eApp();
    ({ app, prisma, http } = e);
    payments = app.get(PaymentsService);
    fines = app.get(FinesService);
    const lib = await e.createUser(`lib${SUFFIX}`, Role.LIBRARIAN);
    const rd = await e.createUser(`r${SUFFIX}`, Role.READER, {
      memberCode: `PAYC${RUN}`,
    });
    libId = lib.id;
    readerId = rd.id;
    const category = await prisma.category.create({
      data: { name: `PAYC Cat ${RUN}`, slug: `payc-cat-${RUN}` },
    });
    ({ makeFine } = await createFineFixture(prisma, {
      categoryId: category.id,
      title: TITLE,
      librarianId: libId,
    }));
  });

  afterAll(async () => {
    await cleanupE2eData(prisma, {
      emailSuffix: SUFFIX,
      bookTitlePrefix: TITLE,
    });
    await prisma.category.deleteMany({ where: { slug: { contains: RUN } } });
    await app.close();
    restoreEnv();
  });

  beforeEach(async () => {
    await prisma.payment.deleteMany({ where: { userId: readerId } });
    await prisma.fine.deleteMany({ where: { loan: { userId: readerId } } });
  });

  it('parallel IPNs: exactly one confirms (00), the rest see 02, the fine is paid once', async () => {
    for (let i = 0; i < ROUNDS; i++) {
      const f = await makeFine(readerId, 20_000);
      const p = await create([f.id]);
      const cb = vnpayCallback(p);
      const rs = await Promise.all(Array.from({ length: 8 }, () => ipn(cb)));
      const codes = rs.map((r) => r.body.RspCode as string);
      expect(codes.filter((c) => c === '00')).toHaveLength(1);
      expect(codes.filter((c) => c === '02')).toHaveLength(7);
      expect(
        (await prisma.fine.findUniqueOrThrow({ where: { id: f.id } })).paidAt,
      ).not.toBeNull();
      expect(
        await prisma.paymentFine.count({
          where: { fineId: f.id, active: true },
        }),
      ).toBe(1);
    }
  });

  it('parallel creates for the same fine: one wins, the others get FINE_PAYMENT_PENDING', async () => {
    for (let i = 0; i < ROUNDS; i++) {
      const f = await makeFine(readerId, 20_000);
      const rs = await Promise.allSettled(
        Array.from({ length: 6 }, () => create([f.id])),
      );
      const bad = rs.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(rs.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(bad.every((r) => r.reason.code === 'FINE_PAYMENT_PENDING')).toBe(
        true,
      );
      expect(
        await prisma.paymentFine.count({
          where: { fineId: f.id, active: true },
        }),
      ).toBe(1);
    }
  });

  it('cash vs create: never both. A fine is collected in cash OR held by a pending payment', async () => {
    let cashWins = 0;
    let onlineWins = 0;
    for (let i = 0; i < ROUNDS * 4; i++) {
      const f = await makeFine(readerId, 20_000);
      const [cash, online] = await Promise.allSettled([
        fines.pay(f.id, libId),
        jitter().then(() => create([f.id])),
      ]);
      const fine = await prisma.fine.findUniqueOrThrow({ where: { id: f.id } });
      const held = await prisma.paymentFine.count({
        where: { fineId: f.id, active: true },
      });
      if (cash.status === 'fulfilled') {
        cashWins++;
        expect(online.status).toBe('rejected');
        expect(fine.paidToId).toBe(libId);
        expect(held).toBe(0);
      } else {
        onlineWins++;
        expect(cash.reason.code).toBe('FINE_PAYMENT_PENDING');
        expect(online.status).toBe('fulfilled');
        expect(fine.paidAt).toBeNull();
        expect(held).toBe(1);
      }
    }
    console.log(`cash-vs-create: cash ${cashWins}, online ${onlineWins}`);
  });

  it('cash vs a late IPN success on a cancelled payment: the fine is settled exactly once', async () => {
    let cashWins = 0;
    let ipnWins = 0;
    for (let i = 0; i < ROUNDS * 4; i++) {
      const f = await makeFine(readerId, 20_000);
      const p = await create([f.id]);
      await payments.cancel(p.paymentId, reader());
      const [cash, ipnRes] = await Promise.all([
        jitter(40).then(() =>
          Promise.allSettled([fines.pay(f.id, libId)]).then((r) => r[0]),
        ),
        ipn(vnpayCallback(p)),
      ]);
      // 00 cả khi nhận tiền lẫn khi cần hoàn tiền: dừng VNPay gọi lại
      expect(ipnRes.body.RspCode).toBe('00');
      const fine = await prisma.fine.findUniqueOrThrow({ where: { id: f.id } });
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: p.paymentId },
      });
      expect(fine.paidAt).not.toBeNull();
      if (cash.status === 'fulfilled') {
        cashWins++;
        expect(fine.paidToId).toBe(libId);
        expect(payment.status).toBe(PaymentStatus.CANCELLED);
        expect(payment.note).toBe('REFUND_REQUIRED');
      } else {
        ipnWins++;
        expect(cash.reason.code).toBe('FINE_ALREADY_PAID');
        expect(fine.paidToId).toBeNull();
        expect(payment.status).toBe(PaymentStatus.PAID);
      }
    }
    console.log(`cash-vs-late-ipn: cash ${cashWins}, ipn ${ipnWins}`);
  });

  it('IPN vs the expiry sweep: money that arrived is always recorded as PAID', async () => {
    for (let i = 0; i < ROUNDS; i++) {
      const f = await makeFine(readerId, 20_000);
      const p = await create([f.id]);
      await prisma.payment.update({
        where: { id: p.paymentId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await Promise.all([ipn(vnpayCallback(p)), payments.expireStale()]);
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: p.paymentId },
      });
      const fine = await prisma.fine.findUniqueOrThrow({ where: { id: f.id } });
      expect(payment.status).toBe(PaymentStatus.PAID);
      expect(fine.paidAt).not.toBeNull();
    }
  });
});
