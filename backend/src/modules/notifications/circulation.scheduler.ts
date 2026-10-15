import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ReservationsService } from '../reservations/reservations.service';
import { NotificationsService } from './notifications.service';
import { ReminderEmailService } from './reminder-email.service';

const EVERY_MS = 15 * 60 * 1000;

/**
 * Việc định kỳ: huỷ giữ sách quá hạn nhận, nhắc hạn trả (trong web và qua email).
 * Chạy trong tiến trình API (đủ cho một instance); tắt khi chạy test.
 * Lệnh nào cũng an toàn khi lặp lại (dedupeKey, cập nhật có điều kiện).
 */
@Injectable()
export class CirculationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CirculationScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly reservations: ReservationsService,
    private readonly notifications: NotificationsService,
    private readonly reminderEmails: ReminderEmailService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), EVERY_MS);
    this.timer.unref();
    setTimeout(() => void this.tick(), 30_000).unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(at: Date = new Date()): Promise<void> {
    try {
      const expired = await this.reservations.expireStale(at);
      const reminders = await this.notifications.sendLoanReminders(at);
      if (expired || reminders.dueSoon || reminders.overdue)
        this.logger.log(
          `expired=${expired} dueSoon=${reminders.dueSoon} overdue=${reminders.overdue}`,
        );
    } catch (err) {
      this.logger.error('Việc định kỳ thất bại', err as Error);
    }
    // Email nhắc hạn chạy riêng: nhà cung cấp lỗi không được làm hỏng nhắc hạn trong web
    try {
      const emails = await this.reminderEmails.sendDueEmails(at);
      if (emails.queued || emails.sent || emails.failed || emails.skipped)
        this.logger.log(
          `emailQueued=${emails.queued} emailSent=${emails.sent} emailFailed=${emails.failed} emailSkipped=${emails.skipped}`,
        );
    } catch (err) {
      this.logger.error('Gửi email nhắc hạn thất bại', err as Error);
    }
  }
}
