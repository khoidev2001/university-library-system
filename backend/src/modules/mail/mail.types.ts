/** Một thư gửi đi. Luôn có cả bản HTML lẫn bản văn bản thuần (máy khách không hiển thị được HTML). */
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Khoá chống gửi trùng phía nhà cung cấp (Resend giữ 24 giờ): gửi lại cùng khoá thì không thêm thư. */
  idempotencyKey?: string;
}

export interface MailSendResult {
  /** Mã thư do nhà cung cấp trả về (nếu có). */
  id?: string;
}

/** Lỗi gửi thư. `retryable` = đáng thử lại (mạng, 5xx, 429); sai khoá / sai địa chỉ thì không. */
export class MailDeliveryError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'MailDeliveryError';
  }
}

/**
 * Cổng gửi thư. Bản thật gọi Resend qua HTTP; bản test là hộp thư trong bộ nhớ.
 * `enabled = false` nghĩa là chưa cấu hình: người gọi bỏ qua việc gửi thay vì coi là lỗi.
 */
export interface MailSender {
  readonly enabled: boolean;
  send(message: MailMessage): Promise<MailSendResult>;
}

export const MAIL_SENDER = Symbol('MAIL_SENDER');

export type MailOutcome =
  | { status: 'SENT'; id?: string }
  | { status: 'SKIPPED' }
  | { status: 'FAILED'; error: string; retryable: boolean };
