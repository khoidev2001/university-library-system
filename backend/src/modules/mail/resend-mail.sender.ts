import {
  MailDeliveryError,
  MailMessage,
  MailSender,
  MailSendResult,
} from './mail.types';

export const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_TIMEOUT_MS = 10_000;

export interface ResendOptions {
  /** Trống = chưa cấu hình: `enabled` là false và không bao giờ gọi mạng. */
  apiKey?: string;
  /** Địa chỉ người gửi, ví dụ `Thư viện MUCE <no-reply@ten-mien.vn>`. */
  from: string;
  /** Tiêm `fetch` giả khi test. */
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/** Gửi thư qua Resend bằng HTTPS (Render gói miễn phí chặn SMTP nên không dùng SMTP). */
export class ResendMailSender implements MailSender {
  readonly enabled: boolean;
  private readonly apiKey?: string;
  private readonly from: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ResendOptions) {
    this.apiKey = options.apiKey?.trim() || undefined;
    this.enabled = !!this.apiKey;
    this.from = options.from;
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    if (!this.apiKey) {
      throw new MailDeliveryError('Chưa cấu hình RESEND_API_KEY', false);
    }
    let response: Response;
    try {
      response = await this.fetchFn(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(message.idempotencyKey && {
            'Idempotency-Key': message.idempotencyKey,
          }),
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      // Lỗi mạng / quá thời gian: đáng thử lại. Không đưa nguyên lỗi gốc vào thông báo.
      const reason = err instanceof Error ? err.name : 'unknown';
      throw new MailDeliveryError(`Không gọi được Resend (${reason})`, true);
    }
    const bodyText = await response.text().catch(() => '');
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new MailDeliveryError(
        `Resend trả ${response.status}: ${bodyText.slice(0, 200)}`,
        retryable,
        response.status,
      );
    }
    try {
      const parsed = JSON.parse(bodyText) as { id?: unknown };
      return { id: typeof parsed.id === 'string' ? parsed.id : undefined };
    } catch {
      return {};
    }
  }
}
