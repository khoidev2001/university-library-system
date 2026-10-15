import { INestApplication } from '@nestjs/common';
import { PaymentStatus, Role } from '@prisma/client';
import request from 'supertest';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { verifyVnpParams } from '../src/modules/payments/vnpay.util';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';
import {
  createFineFixture,
  setVnpayEnv,
  VNPAY_TEST_ENV,
  vnpayCallback,
} from './support/vnpay-fixtures';

// Chạy trên Postgres thật (DATABASE_URL). Giới hạn chung 100 yêu cầu/phút/IP và POST /payments 10/phút,
// nên các bước dựng dữ liệu đi thẳng qua service; chỉ hợp đồng HTTP mới đi qua supertest.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}p`;
const SUFFIX = `${RUN}@pay.local`;
const TITLE = `PAY ${RUN}`;

describeWithDb('Thanh toán phạt VNPay (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let auth: (t: string) => Record<string, string>;
  let payments: PaymentsService;
  let restoreEnv: () => void;
  let makeFine: Awaited<ReturnType<typeof createFineFixture>>['makeFine'];
  let tokens: { a: string; b: string; lib: string; admin: string };
  let ids: { a: number; b: number; lib: number };

  const create = (userId: number, fineIds?: number[]) =>
    payments.create(userId, { fineIds }, '203.0.113.7');
  const ipn = (query: Record<string, string>) =>
    http.get('/api/payments/vnpay/ipn').query(query);
  const statusOf = async (paymentId: number) =>
    (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }))
      .status;

  beforeAll(async () => {
    restoreEnv = setVnpayEnv();
    const e = await createE2eApp();
    ({ app, prisma, http, auth } = e);
    payments = app.get(PaymentsService);
    const lib = await e.createUser(`lib${SUFFIX}`, Role.LIBRARIAN);
    const adm = await e.createUser(`adm${SUFFIX}`, Role.ADMIN);
    const a = await e.createUser(`a${SUFFIX}`, Role.READER, {
      memberCode: `PAYA${RUN}`,
    });
    const b = await e.createUser(`b${SUFFIX}`, Role.READER, {
      memberCode: `PAYB${RUN}`,
    });
    ids = { a: a.id, b: b.id, lib: lib.id };
    tokens = {
      a: e.tokenFor(a),
      b: e.tokenFor(b),
      lib: e.tokenFor(lib),
      admin: e.tokenFor(adm),
    };
    const category = await prisma.category.create({
      data: { name: `PAY Cat ${RUN}`, slug: `pay-cat-${RUN}` },
    });
    ({ makeFine } = await createFineFixture(prisma, {
      categoryId: category.id,
      title: TITLE,
      librarianId: lib.id,
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

  /** Mỗi bài bắt đầu từ trạng thái sạch của hai bạn đọc. */
  beforeEach(async () => {
    const userIds = [ids.a, ids.b];
    await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.fine.deleteMany({
      where: { loan: { userId: { in: userIds } } },
    });
  });

  describe('POST /payments', () => {
    it('computes the amount from the DB (own unpaid fines only) and signs a VNPay URL', async () => {
      const f1 = await makeFine(ids.a, 20_000);
      const f2 = await makeFine(ids.a, 35_000);
      const paid = await makeFine(ids.a, 99_000); // đã trả: không tính
      await prisma.fine.update({
        where: { id: paid.id },
        data: { paidAt: new Date() },
      });
      await makeFine(ids.b, 70_000); // của người khác: không tính

      const res = await http
        .post('/api/payments')
        .set(auth(tokens.a))
        .send({})
        .expect(201);
      expect(res.body.amount).toBe(55_000);
      const url = new URL(res.body.paymentUrl as string);
      expect(url.origin + url.pathname).toBe(
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      );
      const q = Object.fromEntries(url.searchParams.entries());
      expect(q).toMatchObject({
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: VNPAY_TEST_ENV.VNPAY_TMN_CODE,
        vnp_Amount: '5500000',
        vnp_CurrCode: 'VND',
        vnp_TxnRef: res.body.txnRef,
        vnp_ReturnUrl: 'https://uls.e2e.test/api/payments/vnpay/return',
      });
      expect(q.vnp_CreateDate).toMatch(/^\d{14}$/);
      expect(q.vnp_ExpireDate > q.vnp_CreateDate).toBe(true);
      expect(verifyVnpParams(q, VNPAY_TEST_ENV.VNPAY_HASH_SECRET)).toBe(true);

      const row = await prisma.payment.findUniqueOrThrow({
        where: { id: res.body.paymentId },
        include: { fines: true },
      });
      expect(row).toMatchObject({
        userId: ids.a,
        amount: 55_000,
        status: PaymentStatus.PENDING,
      });
      expect(row.fines.map((l) => l.fineId).sort()).toEqual(
        [f1.id, f2.id].sort(),
      );
      expect(row.fines.every((l) => l.active)).toBe(true);
    });

    it("rejects a client-supplied amount, other readers' fines, paid fines and bad roles", async () => {
      const own = await makeFine(ids.a, 20_000);
      const other = await makeFine(ids.b, 20_000);
      const paid = await makeFine(ids.a, 20_000);
      await prisma.fine.update({
        where: { id: paid.id },
        data: { paidAt: new Date() },
      });

      await http
        .post('/api/payments')
        .set(auth(tokens.a))
        .send({ amount: 1 })
        .expect(400);
      // Khoản phạt của người khác: 404, và không có giao dịch nào được tạo
      await http
        .post('/api/payments')
        .set(auth(tokens.a))
        .send({ fineIds: [own.id, other.id] })
        .expect(404);
      const paidRes = await http
        .post('/api/payments')
        .set(auth(tokens.a))
        .send({ fineIds: [paid.id] })
        .expect(409);
      expect(paidRes.body.error).toBe('FINE_ALREADY_PAID');
      await http
        .post('/api/payments')
        .set(auth(tokens.lib))
        .send({})
        .expect(403);
      await http.post('/api/payments').send({}).expect(401);
      expect(await prisma.payment.count({ where: { userId: ids.a } })).toBe(0);
    });

    it('refuses a second payment for fines already in a pending one, tiny totals and empty lists', async () => {
      const f = await makeFine(ids.a, 20_000);
      await create(ids.a, [f.id]);
      const again = await http
        .post('/api/payments')
        .set(auth(tokens.a))
        .send({ fineIds: [f.id] })
        .expect(409);
      expect(again.body.error).toBe('FINE_PAYMENT_PENDING');
      const all = await http
        .post('/api/payments')
        .set(auth(tokens.a))
        .send({})
        .expect(409);
      expect(all.body.error).toBe('FINE_PAYMENT_PENDING');

      const tiny = await makeFine(ids.b, 1_000);
      const small = await http
        .post('/api/payments')
        .set(auth(tokens.b))
        .send({ fineIds: [tiny.id] })
        .expect(409);
      expect(small.body.error).toBe('PAYMENT_AMOUNT_TOO_SMALL');

      await prisma.fine.deleteMany({ where: { loan: { userId: ids.b } } });
      const none = await http
        .post('/api/payments')
        .set(auth(tokens.b))
        .send({})
        .expect(409);
      expect(none.body.error).toBe('NO_UNPAID_FINES');
    });

    it('answers 503 PAYMENT_NOT_CONFIGURED without credentials, leaving no payment behind', async () => {
      const f = await makeFine(ids.a, 20_000);
      const restore = setVnpayEnv({});
      try {
        const res = await http
          .post('/api/payments')
          .set(auth(tokens.a))
          .send({ fineIds: [f.id] })
          .expect(503);
        expect(res.body.error).toBe('PAYMENT_NOT_CONFIGURED');
        const off = await http
          .get('/api/payments/config')
          .set(auth(tokens.a))
          .expect(200);
        expect(off.body).toMatchObject({ online: false });
      } finally {
        restore();
      }
      expect(await prisma.payment.count({ where: { userId: ids.a } })).toBe(0);
      const on = await http
        .get('/api/payments/config')
        .set(auth(tokens.a))
        .expect(200);
      expect(on.body).toEqual({
        online: true,
        minAmount: 5000,
        maxAmount: 999_999_999,
        ttlMinutes: 15,
      });
      await http.get('/api/payments/config').expect(401);
    });

    it('honours VNPAY_URL and VNPAY_RETURN_URL overrides', async () => {
      const f = await makeFine(ids.a, 20_000);
      const restore = setVnpayEnv({
        ...VNPAY_TEST_ENV,
        VNPAY_URL: 'https://pay.example.test/vpc',
        VNPAY_RETURN_URL: 'https://ret.example.test/r',
      });
      try {
        const res = await create(ids.a, [f.id]);
        const url = new URL(res.paymentUrl);
        expect(url.origin + url.pathname).toBe('https://pay.example.test/vpc');
        expect(url.searchParams.get('vnp_ReturnUrl')).toBe(
          'https://ret.example.test/r',
        );
      } finally {
        restore();
      }
    });
  });

  describe('IPN', () => {
    it('confirms once: fines paid online (paidTo null) and payment PAID together; a replay is 02', async () => {
      const f1 = await makeFine(ids.a, 20_000);
      const f2 = await makeFine(ids.a, 35_000);
      const p = await create(ids.a);

      const ok = await ipn(vnpayCallback(p)).expect(200);
      expect(ok.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });

      const row = await prisma.payment.findUniqueOrThrow({
        where: { id: p.paymentId },
      });
      expect(row).toMatchObject({
        status: PaymentStatus.PAID,
        vnpTransactionNo: '14000001',
        bankCode: 'NCB',
        responseCode: '00',
      });
      expect(row.paidAt).toBeInstanceOf(Date);
      const fines = await prisma.fine.findMany({
        where: { id: { in: [f1.id, f2.id] } },
      });
      expect(fines.every((f) => f.paidAt && f.paidToId === null)).toBe(true);

      const replay = await ipn(vnpayCallback(p)).expect(200);
      expect(replay.body.RspCode).toBe('02');
      // Sau khi trả online, thủ thư không thu lại được
      const cash = await http
        .post(`/api/fines/${f1.id}/pay`)
        .set(auth(tokens.lib))
        .expect(409);
      expect(cash.body.error).toBe('FINE_ALREADY_PAID');
    });

    it('rejects a bad signature (97), unknown order (01) and wrong amount (04) without changing anything', async () => {
      await makeFine(ids.a, 20_000);
      const p = await create(ids.a);

      const forged = vnpayCallback(p, {}, 'not-the-secret');
      expect((await ipn(forged).expect(200)).body.RspCode).toBe('97');
      const tampered = { ...vnpayCallback(p), vnp_Amount: '100' };
      expect((await ipn(tampered).expect(200)).body.RspCode).toBe('97');
      const noHash: Record<string, string> = vnpayCallback(p);
      delete noHash.vnp_SecureHash;
      expect((await ipn(noHash).expect(200)).body.RspCode).toBe('97');

      const ghost = vnpayCallback({
        txnRef: 'ULSDOESNOTEXIST',
        amount: 20_000,
      });
      expect((await ipn(ghost).expect(200)).body.RspCode).toBe('01');

      // Chữ ký đúng nhưng số tiền khác số đã lưu
      const wrongAmount = vnpayCallback(p, { vnp_Amount: '1000000' });
      expect((await ipn(wrongAmount).expect(200)).body.RspCode).toBe('04');

      expect(await statusOf(p.paymentId)).toBe(PaymentStatus.PENDING);
      expect(
        await prisma.fine.count({
          where: { loan: { userId: ids.a }, paidAt: { not: null } },
        }),
      ).toBe(0);
    });

    it('treats a duplicated vnp_ parameter as an invalid signature', async () => {
      await makeFine(ids.a, 20_000);
      const p = await create(ids.a);
      const qs = new URLSearchParams(vnpayCallback(p));
      qs.append('vnp_Amount', '1');
      const res = await http.get(`/api/payments/vnpay/ipn?${qs.toString()}`);
      expect(res.body.RspCode).toBe('97');
      expect(await statusOf(p.paymentId)).toBe(PaymentStatus.PENDING);
    });

    it('records a failure and releases the fines so they can be paid again; 24 means cancelled', async () => {
      const f = await makeFine(ids.a, 20_000);
      const p1 = await create(ids.a);
      const failed = await ipn(
        vnpayCallback(p1, {
          vnp_ResponseCode: '51',
          vnp_TransactionStatus: '02',
        }),
      ).expect(200);
      expect(failed.body.RspCode).toBe('00');
      expect(await statusOf(p1.paymentId)).toBe(PaymentStatus.FAILED);
      expect(
        (await prisma.fine.findUniqueOrThrow({ where: { id: f.id } })).paidAt,
      ).toBeNull();

      const p2 = await create(ids.a);
      await ipn(
        vnpayCallback(p2, {
          vnp_ResponseCode: '24',
          vnp_TransactionStatus: '02',
        }),
      ).expect(200);
      expect(await statusOf(p2.paymentId)).toBe(PaymentStatus.CANCELLED);

      // Sau khi nhả, trả lại được và lần này thành công
      const p3 = await create(ids.a);
      expect((await ipn(vnpayCallback(p3)).expect(200)).body.RspCode).toBe(
        '00',
      );
    });

    it('does not trust ResponseCode 00 when the gateway TransactionStatus says otherwise', async () => {
      await makeFine(ids.a, 20_000);
      const p = await create(ids.a);
      await ipn(vnpayCallback(p, { vnp_TransactionStatus: '02' })).expect(200);
      expect(await statusOf(p.paymentId)).toBe(PaymentStatus.FAILED);
    });

    it('is public (no JWT) and ignores unknown params', async () => {
      await makeFine(ids.a, 20_000);
      const p = await create(ids.a);
      const res = await ipn({ ...vnpayCallback(p), junk: '1' }).expect(200);
      expect(res.body.RspCode).toBe('00');
    });
  });

  describe('expiry and cancel', () => {
    it('releases fines of an expired payment lazily (GET) and via the scheduler hook', async () => {
      const f = await makeFine(ids.a, 20_000);
      const p = await create(ids.a);
      await prisma.payment.update({
        where: { id: p.paymentId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await http
        .get(`/api/payments/${p.paymentId}`)
        .set(auth(tokens.a))
        .expect(200);
      expect(res.body.status).toBe('EXPIRED');
      const link = await prisma.paymentFine.findFirstOrThrow({
        where: { fineId: f.id },
      });
      expect(link.active).toBe(false);
      await create(ids.a); // nhả rồi nên tạo lại được

      // Đường scheduler
      const f2 = await makeFine(ids.b, 20_000);
      const p2 = await create(ids.b);
      await prisma.payment.update({
        where: { id: p2.paymentId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect(await payments.expireStale()).toBeGreaterThanOrEqual(1);
      expect(
        (
          await prisma.paymentFine.findFirstOrThrow({
            where: { fineId: f2.id },
          })
        ).active,
      ).toBe(false);
    });

    it('blocks cash while the pending payment is live, allows it once it expired', async () => {
      const f = await makeFine(ids.a, 20_000);
      const p = await create(ids.a);
      const blocked = await http
        .post(`/api/fines/${f.id}/pay`)
        .set(auth(tokens.lib))
        .expect(409);
      expect(blocked.body.error).toBe('FINE_PAYMENT_PENDING');
      await prisma.payment.update({
        where: { id: p.paymentId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await http
        .post(`/api/fines/${f.id}/pay`)
        .set(auth(tokens.lib))
        .expect(200);
      expect(
        (await prisma.fine.findUniqueOrThrow({ where: { id: f.id } })).paidToId,
      ).toBe(ids.lib);
    });

    it('cancel: owner or librarian, only while pending; a stranger gets 404', async () => {
      const f = await makeFine(ids.a, 20_000);
      const p = await create(ids.a);
      await http
        .post(`/api/payments/${p.paymentId}/cancel`)
        .set(auth(tokens.b))
        .expect(404);
      const res = await http
        .post(`/api/payments/${p.paymentId}/cancel`)
        .set(auth(tokens.a))
        .expect(200);
      expect(res.body.status).toBe('CANCELLED');
      const again = await http
        .post(`/api/payments/${p.paymentId}/cancel`)
        .set(auth(tokens.a))
        .expect(409);
      expect(again.body.error).toBe('PAYMENT_NOT_PENDING');
      // Thủ thư huỷ giao dịch chờ của bạn đọc rồi thu tiền mặt
      const p2 = await create(ids.a, [f.id]);
      await http
        .post(`/api/payments/${p2.paymentId}/cancel`)
        .set(auth(tokens.lib))
        .expect(200);
      await http
        .post(`/api/fines/${f.id}/pay`)
        .set(auth(tokens.lib))
        .expect(200);
    });

    it('late success after expiry still takes the money when the fines are free', async () => {
      const f = await makeFine(ids.a, 20_000);
      const p = await create(ids.a);
      await prisma.payment.update({
        where: { id: p.paymentId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await payments.expireStale();
      expect(await statusOf(p.paymentId)).toBe(PaymentStatus.EXPIRED);
      expect((await ipn(vnpayCallback(p)).expect(200)).body.RspCode).toBe('00');
      expect(await statusOf(p.paymentId)).toBe(PaymentStatus.PAID);
      expect(
        (await prisma.fine.findUniqueOrThrow({ where: { id: f.id } })).paidAt,
      ).not.toBeNull();
    });

    it('late success after the fine was collected in cash flags a refund instead of paying twice', async () => {
      const f = await makeFine(ids.a, 20_000);
      const p = await create(ids.a);
      await http
        .post(`/api/payments/${p.paymentId}/cancel`)
        .set(auth(tokens.lib))
        .expect(200);
      await http
        .post(`/api/fines/${f.id}/pay`)
        .set(auth(tokens.lib))
        .expect(200);
      const cashPaidAt = (
        await prisma.fine.findUniqueOrThrow({ where: { id: f.id } })
      ).paidAt;

      expect((await ipn(vnpayCallback(p)).expect(200)).body.RspCode).toBe('00');
      const row = await prisma.payment.findUniqueOrThrow({
        where: { id: p.paymentId },
      });
      expect(row.status).toBe(PaymentStatus.CANCELLED); // không thành PAID
      expect(row.vnpTransactionNo).toBe('14000001');
      const view = await http
        .get(`/api/payments/${p.paymentId}`)
        .set(auth(tokens.lib))
        .expect(200);
      expect(view.body.needsRefund).toBe(true);
      const fine = await prisma.fine.findUniqueOrThrow({ where: { id: f.id } });
      expect(fine.paidToId).toBe(ids.lib);
      expect(fine.paidAt).toEqual(cashPaidAt);
    });
  });

  describe('return URL', () => {
    const returnTo = (query: Record<string, string>) =>
      http.get('/api/payments/vnpay/return').query(query).redirects(0);

    it('verifies, settles idempotently and redirects only under APP_PUBLIC_URL', async () => {
      const f = await makeFine(ids.a, 20_000);
      const p = await create(ids.a);
      const res = await returnTo(vnpayCallback(p)).expect(302);
      expect(res.headers.location).toBe(
        `https://uls.e2e.test/my/payments/result?paymentId=${p.paymentId}`,
      );
      expect(
        (await prisma.fine.findUniqueOrThrow({ where: { id: f.id } })).paidAt,
      ).not.toBeNull();
      // Gọi lại (F5 / IPN tới sau): không đổi gì, vẫn về cùng trang
      const paidAt = (
        await prisma.payment.findUniqueOrThrow({ where: { id: p.paymentId } })
      ).paidAt;
      const again = await returnTo(vnpayCallback(p)).expect(302);
      expect(again.headers.location).toBe(res.headers.location);
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: p.paymentId } }))
          .paidAt,
      ).toEqual(paidAt);
      expect((await ipn(vnpayCallback(p)).expect(200)).body.RspCode).toBe('02');
    });

    it('a bad signature or amount settles nothing and never redirects off-site', async () => {
      await makeFine(ids.a, 20_000);
      const p = await create(ids.a);
      const forged = await returnTo(
        vnpayCallback(p, { vnp_ReturnUrl: 'https://evil.example' }, 'wrong'),
      ).expect(302);
      expect(forged.headers.location).toBe(
        'https://uls.e2e.test/my/payments/result?error=invalid_signature',
      );
      const badAmount = await returnTo(
        vnpayCallback(p, { vnp_Amount: '100' }),
      ).expect(302);
      expect(badAmount.headers.location).toBe(
        'https://uls.e2e.test/my/payments/result?error=invalid_amount',
      );
      const ghost = await returnTo(
        vnpayCallback({ txnRef: 'ULSNOPE', amount: 20_000 }),
      ).expect(302);
      expect(ghost.headers.location).toBe(
        'https://uls.e2e.test/my/payments/result?error=not_found',
      );
      expect(await statusOf(p.paymentId)).toBe(PaymentStatus.PENDING);
    });

    it('a payment cancelled at the bank comes back as CANCELLED', async () => {
      await makeFine(ids.a, 20_000);
      const p = await create(ids.a);
      await returnTo(
        vnpayCallback(p, {
          vnp_ResponseCode: '24',
          vnp_TransactionStatus: '02',
        }),
      ).expect(302);
      expect(await statusOf(p.paymentId)).toBe(PaymentStatus.CANCELLED);
    });
  });

  describe('history and visibility', () => {
    it("GET /payments/me lists only the caller's payments; GET /payments/:id is owner or staff", async () => {
      await makeFine(ids.a, 20_000);
      await makeFine(ids.b, 30_000);
      const pa = await create(ids.a);
      const pb = await create(ids.b);
      await ipn(vnpayCallback(pa)).expect(200);

      const mine = await http
        .get('/api/payments/me')
        .set(auth(tokens.a))
        .expect(200);
      expect(mine.body.total).toBe(1);
      expect(mine.body.items[0]).toMatchObject({
        id: pa.paymentId,
        status: 'PAID',
        amount: 20_000,
        vnpTransactionNo: '14000001',
      });
      expect(mine.body.items[0].fines).toHaveLength(1);

      await http
        .get(`/api/payments/${pb.paymentId}`)
        .set(auth(tokens.a))
        .expect(404);
      const asLib = await http
        .get(`/api/payments/${pb.paymentId}`)
        .set(auth(tokens.lib))
        .expect(200);
      expect(asLib.body.user.id).toBe(ids.b);
      await http
        .get(`/api/payments/${pb.paymentId}`)
        .set(auth(tokens.admin))
        .expect(200);
      await http.get('/api/payments/me').expect(401);
      await http.get('/api/payments/me').set(auth(tokens.lib)).expect(403);
      await http.get(`/api/payments/${pa.paymentId}`).expect(401);
      await http.get('/api/payments/abc').set(auth(tokens.a)).expect(400);
      await http
        .get('/api/payments/99999999999')
        .set(auth(tokens.a))
        .expect(404);
    });

    it('fines endpoints show the online payment, and totals follow', async () => {
      const f = await makeFine(ids.a, 20_000);
      const other = await makeFine(ids.a, 40_000);
      const p = await create(ids.a, [f.id]);

      const pending = await http
        .get('/api/fines/me')
        .set(auth(tokens.a))
        .expect(200);
      expect(pending.body.unpaidTotal).toBe(60_000);
      const pendingRow = pending.body.items.find(
        (x: { id: number }) => x.id === f.id,
      );
      expect(pendingRow.onlinePayment).toMatchObject({
        id: p.paymentId,
        status: 'PENDING',
      });

      await ipn(vnpayCallback(p)).expect(200);
      const paid = await http
        .get('/api/fines/me')
        .set(auth(tokens.a))
        .expect(200);
      expect(paid.body.unpaidTotal).toBe(40_000);
      expect(
        paid.body.items.find((x: { id: number }) => x.id === f.id)
          .onlinePayment,
      ).toMatchObject({ status: 'PAID', vnpTransactionNo: '14000001' });
      expect(
        paid.body.items.find((x: { id: number }) => x.id === other.id)
          .onlinePayment,
      ).toBeNull();

      const staff = await http
        .get(`/api/fines?paid=true&userId=${ids.a}`)
        .set(auth(tokens.lib))
        .expect(200);
      expect(staff.body.items).toHaveLength(1);
      expect(staff.body.items[0]).toMatchObject({
        id: f.id,
        paidToId: null,
        onlinePayment: { status: 'PAID' },
      });
      const detail = await http
        .get(`/api/users/${ids.a}`)
        .set(auth(tokens.lib))
        .expect(200);
      expect(detail.body.unpaidFines).toBe(40_000);
    });
  });
});
