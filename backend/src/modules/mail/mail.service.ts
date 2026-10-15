import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MAIL_SENDER,
  MailDeliveryError,
  MailMessage,
  MailOutcome,
  MailSender,
} from './mail.types';

/** Địa chỉ công khai của web (dùng dựng liên kết trong thư), không có dấu `/` cuối. */
export function resolveAppUrl(
  appPublicUrl: string | undefined,
  corsOrigins: string | undefined,
): string {
  const fromCors = corsOrigins
    ?.split(',')
    .map((s) => s.trim())
    .find((s) => /^https?:\/\//.test(s));
  return (appPublicUrl?.trim() || fromCors || 'http://localhost:3001').replace(
    /\/+$/,
    '',
  );
}

/**
 * Cửa gửi thư cho toàn ứng dụng. KHÔNG BAO GIỜ ném lỗi: chưa cấu hình thì ghi log rồi bỏ qua,
 * nhà cung cấp lỗi thì trả FAILED để người gọi quyết định thử lại hay không.
 * Không ghi nội dung thư / liên kết / địa chỉ người nhận vào log (có thể chứa token).
 */
@Injectable()
export class MailService implements OnApplicationShutdown {
  private readonly logger = new Logger(MailService.name);
  private readonly inflight = new Set<Promise<unknown>>();
  readonly appUrl: string;
  private warnedDisabled = false;

  constructor(
    @Inject(MAIL_SENDER) private readonly sender: MailSender,
    config: ConfigService,
  ) {
    this.appUrl = resolveAppUrl(
      config.get<string>('APP_PUBLIC_URL'),
      config.get<string>('CORS_ORIGINS'),
    );
  }

  get enabled(): boolean {
    return this.sender.enabled;
  }

  async send(message: MailMessage): Promise<MailOutcome> {
    if (!this.sender.enabled) {
      if (!this.warnedDisabled) {
        this.warnedDisabled = true;
        this.logger.warn(
          'Chưa cấu hình RESEND_API_KEY: bỏ qua mọi việc gửi email (ứng dụng vẫn chạy bình thường)',
        );
      }
      return { status: 'SKIPPED' };
    }
    try {
      const res = await this.sender.send(message);
      return { status: 'SENT', id: res.id };
    } catch (err) {
      const retryable = err instanceof MailDeliveryError ? err.retryable : true;
      const reason = err instanceof Error ? err.message : 'lỗi không rõ';
      this.logger.error(`Gửi email thất bại: ${reason}`);
      return { status: 'FAILED', error: reason, retryable };
    }
  }

  /**
   * Gửi nền, không chờ: dùng cho luồng cần thời gian phản hồi như nhau dù có gửi thư hay không
   * (quên mật khẩu). Lỗi đã được ghi log trong `send`.
   */
  sendDetached(message: MailMessage): void {
    const p: Promise<unknown> = this.send(message).finally(() =>
      this.inflight.delete(p),
    );
    this.inflight.add(p);
  }

  /** Chờ các thư gửi nền đang bay xong (tắt ứng dụng, test). */
  async drain(): Promise<void> {
    await Promise.all([...this.inflight]);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.drain();
  }
}
