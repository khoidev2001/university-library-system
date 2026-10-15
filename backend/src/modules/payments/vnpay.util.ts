import { createHmac, timingSafeEqual } from 'crypto';
import { isIP } from 'net';

/**
 * Ký và kiểm chữ ký VNPay (cổng thanh toán v2.1.0), thuần hàm, không chạm DB hay môi trường.
 *
 * Quy tắc ký (tài liệu sandbox.vnpayment.vn/apis/docs/thanh-toan-pay):
 *  - chỉ lấy tham số bắt đầu bằng `vnp_`, bỏ `vnp_SecureHash` và `vnp_SecureHashType`;
 *  - sắp xếp tên tham số tăng dần;
 *  - nối `tên=giá trị` bằng `&`, cả tên lẫn giá trị đều URL-encode kiểu `urlencode` của PHP
 *    (khoảng trắng thành `+`);
 *  - HMAC-SHA512 với khoá bí mật, ra chuỗi hex.
 */

const UTC_PLUS_7_MS = 7 * 60 * 60 * 1000;

/** URL-encode giống `urlencode` của PHP: `encodeURIComponent` + `%20 → +` + mã hoá thêm `!'()*~`. */
export function vnpEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(
      /[!'()*~]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

type VnpParams = Record<string, string>;

function signableEntries(params: VnpParams, skipEmpty: boolean): string[][] {
  return Object.entries(params)
    .filter(
      ([key, value]) =>
        key.startsWith('vnp_') &&
        key !== 'vnp_SecureHash' &&
        key !== 'vnp_SecureHashType' &&
        typeof value === 'string' &&
        (!skipEmpty || value !== ''),
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Chuỗi truy vấn đã sắp xếp và encode; vừa là dữ liệu để ký, vừa là query của URL. */
export function buildQueryString(params: VnpParams, skipEmpty = true): string {
  return signableEntries(params, skipEmpty)
    .map(([key, value]) => `${vnpEncode(key)}=${vnpEncode(value)}`)
    .join('&');
}

export function signVnpParams(params: VnpParams, secret: string): string {
  return createHmac('sha512', secret)
    .update(Buffer.from(buildQueryString(params), 'utf-8'))
    .digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase(), 'utf-8');
  const right = Buffer.from(b.toLowerCase(), 'utf-8');
  // timingSafeEqual đòi cùng độ dài; so sánh với chính nó khi lệch để thời gian không lộ độ dài khớp
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Kiểm `vnp_SecureHash` của tham số VNPay gửi về (return / IPN), so sánh thời gian hằng.
 * VNPay có thể gửi kèm tham số rỗng; các bản mẫu chính thức khác nhau về việc có ký tham số rỗng
 * hay không (PHP/Java bỏ, Node giữ), nên chấp nhận một trong hai cách tính. Cả hai đều cần
 * khoá bí mật nên không làm yếu việc xác thực.
 */
export function verifyVnpParams(params: VnpParams, secret: string): boolean {
  const received = params.vnp_SecureHash;
  if (typeof received !== 'string' || received === '') return false;
  const variants = [true, false].map((skipEmpty) =>
    createHmac('sha512', secret)
      .update(Buffer.from(buildQueryString(params, skipEmpty), 'utf-8'))
      .digest('hex'),
  );
  // Tính cả hai rồi mới so, không thoát sớm theo kết quả đầu
  const matches = variants.map((expected) => safeEqualHex(expected, received));
  return matches.some(Boolean);
}

/** `yyyyMMddHHmmss` theo GMT+7 (múi giờ VNPay yêu cầu), bất kể múi giờ máy chủ. */
export function formatVnpDate(date: Date): string {
  return new Date(date.getTime() + UTC_PLUS_7_MS)
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
}

/** Đọc ngược `yyyyMMddHHmmss` (GMT+7) thành thời điểm; null nếu sai định dạng. */
export function parseVnpDate(value: string | undefined): Date | null {
  if (!value || !/^\d{14}$/.test(value)) return null;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}.000Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t - UTC_PLUS_7_MS);
}

export interface PaymentUrlInput {
  payUrl: string;
  tmnCode: string;
  hashSecret: string;
  returnUrl: string;
  txnRef: string;
  /** VND, số nguyên dương. `vnp_Amount` = amount × 100. */
  amount: number;
  orderInfo: string;
  ipAddr: string;
  createdAt: Date;
  expiresAt: Date;
  locale?: 'vn' | 'en';
  bankCode?: string;
}

export function buildPaymentUrl(input: PaymentUrlInput): string {
  const params: VnpParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: input.tmnCode,
    vnp_Amount: String(input.amount * 100),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: input.locale ?? 'vn',
    vnp_ReturnUrl: input.returnUrl,
    vnp_IpAddr: input.ipAddr,
    vnp_CreateDate: formatVnpDate(input.createdAt),
    vnp_ExpireDate: formatVnpDate(input.expiresAt),
    ...(input.bankCode && { vnp_BankCode: input.bankCode }),
  };
  const hash = signVnpParams(params, input.hashSecret);
  return `${input.payUrl}?${buildQueryString(params)}&vnp_SecureHash=${hash}`;
}

/**
 * `vnp_IpAddr`: lấy IP đầu tiên của X-Forwarded-For nếu đúng định dạng IPv4/IPv6, nếu không dùng
 * địa chỉ socket; luôn rơi về 127.0.0.1. Không bao giờ chuyển chuỗi tuỳ ý vào URL đã ký.
 */
export function resolveClientIp(
  forwardedFor: string | string[] | undefined,
  socketAddress: string | undefined,
): string {
  const first = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
    ?.split(',')[0]
    ?.trim();
  const candidates = [first, socketAddress?.replace(/^::ffff:/, '')];
  for (const c of candidates) {
    if (c && isIP(c) !== 0 && c.length <= 45) return c;
  }
  return '127.0.0.1';
}

/** Chuỗi hiển thị cho vnp_OrderInfo: không dấu, không ký tự đặc biệt (yêu cầu của VNPay). */
export function orderInfoFor(txnRef: string): string {
  return `Thanh toan tien phat thu vien ULS ${txnRef}`;
}
