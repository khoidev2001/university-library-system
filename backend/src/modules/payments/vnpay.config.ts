export const DEFAULT_VNPAY_URL =
  'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  payUrl: string;
  returnUrl: string;
  /** Gốc địa chỉ web công khai, chỉ dùng để chuyển hướng về trang kết quả; rỗng = đường dẫn tương đối. */
  appPublicUrl: string;
}

/**
 * Đọc cấu hình VNPay từ môi trường mỗi lần gọi (không cache để đổi biến là có hiệu lực, test đặt
 * được). Thiếu mã đơn vị, khoá bí mật hoặc địa chỉ return thì coi như chưa cấu hình: null.
 * Không bao giờ ghi giá trị khoá ra log.
 */
export function readVnpayConfig(
  env: NodeJS.ProcessEnv = process.env,
): VnpayConfig | null {
  const trim = (v: string | undefined) => (v ?? '').trim();
  const appPublicUrl = trim(env.APP_PUBLIC_URL).replace(/\/+$/, '');
  const tmnCode = trim(env.VNPAY_TMN_CODE);
  const hashSecret = trim(env.VNPAY_HASH_SECRET);
  const returnUrl =
    trim(env.VNPAY_RETURN_URL) ||
    (appPublicUrl ? `${appPublicUrl}/api/payments/vnpay/return` : '');
  if (!tmnCode || !hashSecret || !returnUrl) return null;
  return {
    tmnCode,
    hashSecret,
    payUrl: trim(env.VNPAY_URL) || DEFAULT_VNPAY_URL,
    returnUrl,
    appPublicUrl,
  };
}
