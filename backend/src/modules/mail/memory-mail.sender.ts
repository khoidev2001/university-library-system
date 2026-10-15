import { MailDeliveryError, MailMessage, MailSender } from './mail.types';

/**
 * Hộp thư trong bộ nhớ cho test: ghi lại mọi thư "đã gửi", có thể bật cờ để giả lập lỗi.
 * Không dùng ở môi trường chạy thật.
 */
export class InMemoryMailSender implements MailSender {
  enabled = true;
  readonly outbox: MailMessage[] = [];
  /** Số lần gửi tới sẽ bị lỗi (giảm dần mỗi lần gửi). */
  failNext = 0;
  failRetryable = true;
  /** Số lần `send` được gọi (kể cả lần lỗi). */
  attempts = 0;

  send(message: MailMessage): Promise<{ id: string }> {
    this.attempts += 1;
    if (this.failNext > 0) {
      this.failNext -= 1;
      return Promise.reject(
        new MailDeliveryError('Giả lập lỗi gửi thư', this.failRetryable, 500),
      );
    }
    this.outbox.push(message);
    return Promise.resolve({ id: `mem-${this.outbox.length}` });
  }

  to(address: string): MailMessage[] {
    return this.outbox.filter((m) => m.to === address);
  }

  clear(): void {
    this.outbox.length = 0;
    this.failNext = 0;
    this.attempts = 0;
  }
}
