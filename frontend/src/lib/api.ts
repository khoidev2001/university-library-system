/** Lớp gọi Backend dùng chung cho cả server component và client component. */

/**
 * Trình duyệt luôn gọi đường dẫn TƯƠNG ĐỐI qua gateway cùng origin.
 * Không nhúng host tuyệt đối vì biến NEXT_PUBLIC_* bị cố định lúc build, image sẽ
 * chỉ chạy đúng ở đúng tên miền và cổng đã build.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

/** Phía server gọi thẳng service trong mạng nội bộ, không vòng qua gateway. */
export const SERVER_API_BASE = process.env.API_URL ?? "http://localhost:3000/api";

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Thông báo tiếng Việt thân thiện cho từng mã lỗi nghiệp vụ. */
  get friendlyMessage(): string {
    return BUSINESS_MESSAGES[this.code] ?? this.message;
  }
}

const BUSINESS_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  ACCOUNT_LOCKED: "Thẻ bạn đọc đang bị khoá. Vui lòng liên hệ thủ thư.",
  EMAIL_EXISTS: "Email này đã được đăng ký.",
  MEMBER_CODE_EXISTS: "Mã sinh viên hoặc giảng viên này đã được đăng ký.",
  NOT_A_READER: "Tài khoản này không phải bạn đọc.",
  COPY_NOT_AVAILABLE: "Bản sao này hiện không sẵn sàng để cho mượn.",
  LOAN_LIMIT_REACHED: "Bạn đọc đã mượn tối đa số cuốn cho phép.",
  HAS_OVERDUE_LOAN: "Bạn đọc đang giữ sách quá hạn, cần trả trước khi mượn tiếp.",
  UNPAID_FINE: "Bạn đọc còn tiền phạt chưa thanh toán.",
  LOAN_NOT_ACTIVE: "Phiếu mượn này đã được đóng.",
  RENEW_LIMIT_REACHED: "Phiếu này đã hết lượt gia hạn.",
  LOAN_OVERDUE_CANNOT_RENEW: "Phiếu đã quá hạn nên không gia hạn được, vui lòng trả sách tại quầy.",
  FINE_ALREADY_PAID: "Khoản phạt này đã được thu.",
  NOT_BORROWED: "Bạn chỉ đánh giá được sách đã mượn và trả.",
  BARCODE_EXISTS: "Mã vạch này đã tồn tại.",
  ISBN_EXISTS: "ISBN này đã có trong kho.",
  CATEGORY_IN_USE: "Thể loại đang có sách nên không xoá được.",
  AI_UNAVAILABLE: "Dịch vụ gợi ý tạm thời không phản hồi.",
};

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string | null;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers, ...rest } = options;
  const isServer = typeof window === "undefined";
  const base = isServer ? SERVER_API_BASE : API_BASE;

  const response = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const error = payload as ApiErrorBody | null;
    const message = Array.isArray(error?.message) ? error.message.join(". ") : error?.message;
    throw new ApiError(response.status, error?.error ?? "UNKNOWN", message ?? "Có lỗi xảy ra.");
  }
  return payload as T;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

/** "còn 3 ngày" / "quá hạn 2 ngày" cho thẻ phiếu mượn. */
export function describeDueDate(dueAt: string, isOverdue: boolean, overdueDays: number): string {
  if (isOverdue) return `Quá hạn ${overdueDays} ngày`;
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Đến hạn hôm nay";
  if (days === 1) return "Còn 1 ngày";
  return `Còn ${days} ngày`;
}
