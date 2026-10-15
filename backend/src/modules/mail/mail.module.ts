import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MAIL_SENDER } from './mail.types';
import { ResendMailSender } from './resend-mail.sender';

export const DEFAULT_MAIL_FROM = 'Thư viện MUCE <onboarding@resend.dev>';

/**
 * Gửi email qua Resend (HTTP). Không có RESEND_API_KEY thì cổng gửi ở trạng thái tắt:
 * mọi lời gọi bị bỏ qua có log, ứng dụng chạy bình thường.
 */
@Global()
@Module({
  providers: [
    {
      provide: MAIL_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new ResendMailSender({
          apiKey: config.get<string>('RESEND_API_KEY'),
          endpoint: config.get<string>('RESEND_API_URL'),
          from: config.get<string>('MAIL_FROM')?.trim() || DEFAULT_MAIL_FROM,
        }),
    },
    MailService,
  ],
  exports: [MailService, MAIL_SENDER],
})
export class MailModule {}
