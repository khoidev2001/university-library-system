import { Injectable, NotFoundException } from '@nestjs/common';
import { LoanStatus, Prisma } from '@prisma/client';
import { addDays, overdueCutoff } from '../../common/date.util';
import { PrismaService } from '../../prisma/prisma.service';

/** Số ngày trước hạn trả thì nhắc "sắp đến hạn". */
export const DUE_SOON_DAYS = 2;
/** Số phiếu xử lý mỗi lô khi nhắc hạn. */
const REMINDER_BATCH = 500;

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

  /**
   * Tạo thông báo; trùng dedupeKey thì bỏ qua (trả về false).
   * Một câu INSERT … ON CONFLICT DO NOTHING: hai tiến trình / hai instance cùng nhắc một phiếu
   * không còn đụng ràng buộc duy nhất (lỗi đó từng làm hỏng cả lượt nhắc hạn và huỷ transaction chứa nó).
   */
  async notify(
    n: NewNotification,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const res = await tx.notification.createMany({
      data: [n],
      skipDuplicates: true,
    });
    return res.count > 0;
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
   * Duyệt hết mọi phiếu theo từng lô (con trỏ theo id) — trước đây chỉ lấy 500 phiếu đầu nên
   * khi có hơn 500 phiếu cần nhắc, phần còn lại không bao giờ được nhắc.
   */
  async sendLoanReminders(
    at: Date = new Date(),
  ): Promise<{ dueSoon: number; overdue: number }> {
    const soonLimit = addDays(at, DUE_SOON_DAYS);
    const overdueLine = overdueCutoff(at);
    let dueSoon = 0;
    let overdue = 0;
    let cursor: number | undefined;
    for (;;) {
      const loans = await this.prisma.loan.findMany({
        where: {
          status: LoanStatus.ACTIVE,
          dueAt: { lt: soonLimit },
          user: { isActive: true },
        },
        include: { copy: { include: { book: { select: { title: true } } } } },
        orderBy: { id: 'asc' },
        take: REMINDER_BATCH,
        ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
      });
      if (loans.length === 0) break;
      cursor = loans[loans.length - 1].id;

      const candidates = loans.map((loan) => {
        const isLate = loan.dueAt < overdueLine;
        const title = loan.copy.book.title;
        const dueDate = loan.dueAt.toLocaleDateString('vi-VN');
        return {
          isLate,
          data: {
            userId: loan.userId,
            type: isLate ? 'LOAN_OVERDUE' : 'LOAN_DUE_SOON',
            title: isLate ? 'Sách đã quá hạn trả' : 'Sách sắp đến hạn trả',
            body: isLate
              ? `"${title}" đã quá hạn từ ${dueDate}. Vui lòng mang sách tới quầy để tránh phạt tăng thêm.`
              : `"${title}" đến hạn ngày ${dueDate}. Bạn có thể gia hạn trong mục Sách của tôi.`,
            link: '/my/loans',
            dedupeKey: `loan:${loan.id}:${isLate ? 'overdue' : 'due'}`,
          },
        };
      });
      const existing = await this.prisma.notification.findMany({
        where: { dedupeKey: { in: candidates.map((c) => c.data.dedupeKey) } },
        select: { dedupeKey: true },
      });
      const sent = new Set(existing.map((e) => e.dedupeKey));
      for (const isLate of [true, false]) {
        const fresh = candidates
          .filter((c) => c.isLate === isLate && !sent.has(c.data.dedupeKey))
          .map((c) => c.data);
        if (fresh.length === 0) continue;
        const res = await this.prisma.notification.createMany({
          data: fresh,
          skipDuplicates: true,
        });
        if (isLate) overdue += res.count;
        else dueSoon += res.count;
      }
      if (loans.length < REMINDER_BATCH) break;
    }
    return { dueSoon, overdue };
  }
}
