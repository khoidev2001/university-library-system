import { FineType, LoanStatus } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { signVnpParams } from '../../src/modules/payments/vnpay.util';

export const VNPAY_TEST_ENV = {
  VNPAY_TMN_CODE: 'E2ETMN01',
  VNPAY_HASH_SECRET: 'e2e-vnpay-hash-secret',
  APP_PUBLIC_URL: 'https://uls.e2e.test',
};

/** Đặt biến môi trường VNPay cho test; trả hàm khôi phục. */
export function setVnpayEnv(
  env: Record<string, string | undefined> = VNPAY_TEST_ENV,
): () => void {
  const keys = [
    'VNPAY_TMN_CODE',
    'VNPAY_HASH_SECRET',
    'VNPAY_URL',
    'VNPAY_RETURN_URL',
    'APP_PUBLIC_URL',
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  for (const [k, v] of Object.entries(env))
    if (v !== undefined) process.env[k] = v;
  return () => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };
}

/** Tham số VNPay gửi về (IPN / return) đã ký đúng bằng khoá thử nghiệm. */
export function vnpayCallback(
  payment: { txnRef: string; amount: number },
  overrides: Record<string, string> = {},
  secret = VNPAY_TEST_ENV.VNPAY_HASH_SECRET,
): Record<string, string> {
  const params: Record<string, string> = {
    vnp_Amount: String(payment.amount * 100),
    vnp_BankCode: 'NCB',
    vnp_BankTranNo: 'VNP14000001',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: `Thanh toan ${payment.txnRef}`,
    vnp_PayDate: '20261016101500',
    vnp_ResponseCode: '00',
    vnp_TmnCode: VNPAY_TEST_ENV.VNPAY_TMN_CODE,
    vnp_TransactionNo: '14000001',
    vnp_TransactionStatus: '00',
    vnp_TxnRef: payment.txnRef,
    ...overrides,
  };
  return { ...params, vnp_SecureHash: signVnpParams(params, secret) };
}

/** Một sách + một bản sao dùng chung, để gắn phiếu mượn (và khoản phạt) cho từng bạn đọc. */
export async function createFineFixture(
  prisma: PrismaService,
  opts: { categoryId: number; title: string; librarianId: number },
) {
  const book = await prisma.book.create({
    data: {
      title: opts.title,
      categoryId: opts.categoryId,
      copies: {
        create: [{ barcode: `${opts.title}-copy`.replace(/\s+/g, '-') }],
      },
    },
    include: { copies: true },
  });
  const copyId = book.copies[0].id;
  /** Khoản phạt mới (phiếu đã trả, trễ) cho bạn đọc `userId`. */
  const makeFine = async (userId: number, amount: number) => {
    const loan = await prisma.loan.create({
      data: {
        copyId,
        userId,
        createdById: opts.librarianId,
        borrowedAt: new Date(Date.now() - 30 * 86_400_000),
        dueAt: new Date(Date.now() - 16 * 86_400_000),
        returnedAt: new Date(),
        status: LoanStatus.RETURNED,
      },
    });
    return prisma.fine.create({
      data: { loanId: loan.id, type: FineType.OVERDUE, amount },
    });
  };
  return { book, makeFine };
}
