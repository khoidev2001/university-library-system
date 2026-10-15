/**
 * Dựng URL "VNPay gọi về" (return hoặc IPN) đã ký bằng VNPAY_HASH_SECRET, để thử luồng thanh toán
 * cục bộ khi sandbox không gọi được IPN (máy bạn không có địa chỉ công khai).
 *
 *   pnpm vnpay:callback <txnRef> <amountVnd> [responseCode=00] [return|ipn=return] [baseUrl]
 *
 * Ví dụ: pnpm vnpay:callback ULS0123ABCD 100000 00 ipn http://127.0.0.1:3000
 * In URL ra stdout; mở bằng trình duyệt (return) hoặc `curl` (ipn).
 * Đây là công cụ DEV: nó tự ký, nên chỉ có tác dụng khi bạn biết khoá bí mật.
 */
import { signVnpParams } from '../src/modules/payments/vnpay.util';

const [txnRef, amount, code = '00', kind = 'return', base = 'http://localhost:3000'] =
  process.argv.slice(2);
const secret = process.env.VNPAY_HASH_SECRET;
if (!txnRef || !amount || !secret || !['return', 'ipn'].includes(kind)) {
  console.error(
    'Cách dùng: VNPAY_HASH_SECRET=... pnpm vnpay:callback <txnRef> <amountVnd> [responseCode] [return|ipn] [baseUrl]',
  );
  process.exit(1);
}

const params: Record<string, string> = {
  vnp_Amount: String(Number(amount) * 100),
  vnp_BankCode: 'NCB',
  vnp_BankTranNo: 'VNP00000001',
  vnp_CardType: 'ATM',
  vnp_OrderInfo: 'Thanh toan tien phat thu vien ULS',
  vnp_PayDate: '20260101000000',
  vnp_ResponseCode: code,
  vnp_TmnCode: process.env.VNPAY_TMN_CODE ?? 'DEMOTMN1',
  vnp_TransactionNo: '10000001',
  vnp_TransactionStatus: code === '00' ? '00' : '02',
  vnp_TxnRef: txnRef,
};
params.vnp_SecureHash = signVnpParams(params, secret);
console.log(
  `${base.replace(/\/+$/, '')}/api/payments/vnpay/${kind}?${new URLSearchParams(params).toString()}`,
);
