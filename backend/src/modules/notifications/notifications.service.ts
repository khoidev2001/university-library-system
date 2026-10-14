import { Injectable, NotFoundException } from '@nestjs/common';
import { LoanStatus, Prisma } from '@prisma/client';
import { addDays, overdueCutoff } from '../../common/date.util';
import { PrismaService } from '../../prisma/prisma.service';

/** Số ngày trước hạn trả thì nhắc "sắp đến hạn". */
export const DUE_SOON_DAYS = 2;

export interface NewNotification {
  userId: number;
  type: string;
  title: string;
  body: string;
  link?: string;
  /** Có dedupeKey thì mỗi khoá chỉ tạo được một thông báo. */
  dedupeKey?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tạo thông báo; trùng dedupeKey thì bỏ qua (trả về false). */
  async notify(
    n: NewNotification,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    if (n.dedupeKey) {
      const existed = await tx.notification.findUnique({
        where: { dedupeKey: n.dedupeKey },
        select: { id: true },
      });
      if (existed) return false;
    }
    await tx.notification.create({ data: n });
    return true;
  }

  async listMine(userId: number, limit = 30) {
    const [items, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { id: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(userId: number, id: number) {
    const res = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (res.count === 0) {
      const own = await this.prisma.notification.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!own) throw new NotFoundException('Không tìm thấy thông báo');
    }
    return { ok: true };
  }

  async markAllRead(userId: number) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  /**
   * Nhắc hạn trả: "sắp đến hạn" (trong DUE_SOON_DAYS ngày) và "quá hạn".
   * Mỗi phiếu chỉ nhắc một lần mỗi loại nhờ dedupeKey, nên chạy lặp an toàn.
   */
  async sendLoanReminders(
    at: Date = new Date(),
  ): Promise<{ dueSoon: number; overdue: number }> {
    const soonLimit = addDays(at, DUE_SOON_DAYS);
    const loans = await this.prisma.loan.findMany({
      where: {
        status: LoanStatus.ACTIVE,
        dueAt: { lt: soonLimit },
        user: { isActive: true },
      },
      include: { copy: { include: { book: { select: { title: true } } } } },
      take: 500,
    });
    const overdueLine = overdueCutoff(at);
    let dueSoon = 0;
    let overdue = 0;
    for (const loan of loans) {
      const title = loan.copy.book.title;
      const isLate = loan.dueAt < overdueLine;
      const created = await this.notify({
        userId: loan.userId,
        type: isLate ? 'LOAN_OVERDUE' : 'LOAN_DUE_SOON',
        title: isLate ? 'Sách đã quá hạn trả' : 'Sách sắp đến hạn trả',
        body: isLate
          ? `"${title}" đã quá hạn từ ${loan.dueAt.toLocaleDateString('vi-VN')}. Vui lòng mang sách tới quầy để tránh phạt tăng thêm.`
          : `"${title}" đến hạn ngày ${loan.dueAt.toLocaleDateString('vi-VN')}. Bạn có thể gia hạn trong mục Sách của tôi.`,
        link: '/my/loans',
        dedupeKey: `loan:${loan.id}:${isLate ? 'overdue' : 'due'}`,
      });
      if (created) isLate ? overdue++ : dueSoon++;
    }
    return { dueSoon, overdue };
  }
}
