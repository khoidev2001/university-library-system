import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { LoanStatus, ReminderEmailStatus } from '@prisma/client';
import { addDays, overdueCutoff } from '../../common/date.util';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { loanReminderEmail } from '../mail/mail.templates';
import { DUE_SOON_DAYS } from './notifications.service';

type ReminderKind = 'due' | 'overdue';

export interface ReminderEmailOptions {
  /** Số phiếu duyệt mỗi lô khi tạo bản ghi chờ gửi. */
  batchSize?: number;
  /** Nghỉ giữa hai thư (ms) để không vượt hạn mức tốc độ của Resend (mặc định 2 thư/giây). */
  paceMs?: number;
  /** Số lần thử tối đa cho một phiếu trước khi bỏ cuộc (FAILED). */
  maxAttempts?: number;
  /** Bản ghi đang được "giữ" lâu hơn mức này coi như tiến trình giữ nó đã chết, cho phép gửi lại. */
  claimTimeoutMs?: number;
  /** Trần số thư gửi mỗi lượt chạy. */
  maxEmails?: number;
  /** Chỉ xử lý các bạn đọc này (gửi lại cho một người, hoặc chạy thử có phạm vi); bỏ trống = tất cả. */
  onlyUserIds?: number[];
}

export interface ReminderEmailResult {
  /** Bản ghi chờ gửi mới tạo ở lượt này. */
  queued: number;
  /** Thư đã gửi thành công (mỗi thư có thể gộp nhiều phiếu). */
  sent: number;
  failed: number;
  skipped: number;
}

type ResolvedOptions = typeof DEFAULTS &
  Pick<ReminderEmailOptions, 'onlyUserIds'>;

const DEFAULTS = {
  batchSize: 500,
  paceMs: Number(process.env.MAIL_SEND_INTERVAL_MS ?? 600),
  maxAttempts: 5,
  claimTimeoutMs: 10 * 60_000,
  maxEmails: 200,
};

/** Ngừng lượt chạy sau ngần này thư lỗi liên tiếp (nhà cung cấp sập / hết hạn mức) để khỏi dội lỗi. */
const MAX_CONSECUTIVE_FAILURES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Email nhắc hạn trả, đi kèm thông báo trong web. Trạng thái nằm ở bảng reminder_emails,
 * duy nhất theo (phiếu, loại) nên MỖI PHIẾU + LOẠI chỉ được gửi tối đa một lần thành công:
 *  1. tạo bản ghi PENDING (INSERT … ON CONFLICT DO NOTHING) cho phiếu đủ điều kiện;
 *  2. "giữ" từng bản ghi bằng UPDATE có điều kiện (hai tiến trình không cùng giữ được một bản ghi);
 *  3. gửi một thư cho mỗi (bạn đọc, loại) gộp các phiếu đã giữ;
 *  4. thành công → SENT; lỗi → nhả giữ để lượt sau thử lại (tối đa maxAttempts), không bao giờ gửi lại cái đã SENT.
 * Cửa sổ trùng duy nhất: tiến trình chết đúng giữa lúc nhà cung cấp đã nhận thư và lúc ghi SENT;
 * khi đó lượt sau gửi lại với cùng Idempotency-Key nên Resend vẫn chỉ phát một thư trong 24 giờ.
 * Chưa cấu hình Resend thì không làm gì và không ghi trạng thái (cấu hình sau là nhắc được ngay).
 */
@Injectable()
export class ReminderEmailService {
  private readonly logger = new Logger(ReminderEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async sendDueEmails(
    at: Date = new Date(),
    options: ReminderEmailOptions = {},
  ): Promise<ReminderEmailResult> {
    const opts: ResolvedOptions = { ...DEFAULTS, ...options };
    const result: ReminderEmailResult = {
      queued: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };
    if (!this.mail.enabled) return result;

    result.queued = await this.queueEligible(
      at,
      opts.batchSize,
      opts.onlyUserIds,
    );
    await this.deliverPending(at, opts, result);
    return result;
  }

  /** Bước 1: tạo bản ghi chờ gửi cho phiếu sắp hạn / quá hạn của bạn đọc còn bật nhắc email. */
  private async queueEligible(
    at: Date,
    batchSize: number,
    onlyUserIds?: number[],
  ): Promise<number> {
    const soonLimit = addDays(at, DUE_SOON_DAYS);
    const lateLine = overdueCutoff(at);
    let queued = 0;
    let cursor: number | undefined;
    for (;;) {
      const loans = await this.prisma.loan.findMany({
        where: {
          status: LoanStatus.ACTIVE,
          dueAt: { lt: soonLimit },
          user: {
            isActive: true,
            emailReminders: true,
            ...(onlyUserIds && { id: { in: onlyUserIds } }),
          },
        },
        select: { id: true, userId: true, dueAt: true },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
      });
      if (loans.length === 0) break;
      cursor = loans[loans.length - 1].id;
      const res = await this.prisma.reminderEmail.createMany({
        data: loans.map((l) => ({
          loanId: l.id,
          userId: l.userId,
          kind: l.dueAt < lateLine ? 'overdue' : 'due',
        })),
        skipDuplicates: true,
      });
      queued += res.count;
      if (loans.length < batchSize) break;
    }
    return queued;
  }

  /** Bước 2-4: giữ, gửi, ghi kết quả. */
  private async deliverPending(
    at: Date,
    opts: ResolvedOptions,
    result: ReminderEmailResult,
  ): Promise<void> {
    const lateLine = overdueCutoff(at);
    const staleBefore = new Date(at.getTime() - opts.claimTimeoutMs);
    let mailsSent = 0;
    let consecutiveFailures = 0;
    let cursor = 0;

    for (;;) {
      const rows = await this.prisma.reminderEmail.findMany({
        where: {
          id: { gt: cursor },
          status: ReminderEmailStatus.PENDING,
          attempts: { lt: opts.maxAttempts },
          OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
          user: {
            isActive: true,
            emailReminders: true,
            ...(opts.onlyUserIds && { id: { in: opts.onlyUserIds } }),
          },
        },
        include: { user: { select: { email: true, fullName: true } } },
        orderBy: { id: 'asc' },
        take: opts.batchSize,
      });
      if (rows.length === 0) return;
      cursor = rows[rows.length - 1].id;

      const loans = await this.prisma.loan.findMany({
        where: { id: { in: rows.map((r) => r.loanId) } },
        select: {
          id: true,
          status: true,
          dueAt: true,
          copy: { select: { book: { select: { title: true } } } },
        },
      });
      const loanById = new Map(loans.map((l) => [l.id, l]));

      // Gộp theo (bạn đọc, loại); bản ghi không còn đúng (đã trả sách, đã chuyển sang quá hạn) thì bỏ.
      const groups = new Map<
        string,
        {
          rowIds: number[];
          items: { title: string; dueAt: Date }[];
          row: (typeof rows)[number];
          kind: ReminderKind;
        }
      >();
      const stale: number[] = [];
      for (const row of rows) {
        const loan = loanById.get(row.loanId);
        const kind: ReminderKind | null = !loan
          ? null
          : loan.status !== LoanStatus.ACTIVE
            ? null
            : loan.dueAt < lateLine
              ? 'overdue'
              : 'due';
        if (!loan || kind === null || kind !== row.kind) {
          stale.push(row.id);
          continue;
        }
        const key = `${row.userId}:${kind}`;
        const group = groups.get(key) ?? {
          rowIds: [],
          items: [],
          row,
          kind,
        };
        group.rowIds.push(row.id);
        group.items.push({
          title: loan.copy.book.title,
          dueAt: loan.dueAt,
        });
        groups.set(key, group);
      }
      if (stale.length > 0) {
        await this.prisma.reminderEmail.updateMany({
          where: { id: { in: stale }, status: ReminderEmailStatus.PENDING },
          data: { status: ReminderEmailStatus.SKIPPED },
        });
        result.skipped += stale.length;
      }

      for (const group of groups.values()) {
        if (mailsSent >= opts.maxEmails) return;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.logger.warn(
            `Dừng gửi email nhắc hạn sau ${MAX_CONSECUTIVE_FAILURES} lần lỗi liên tiếp, lượt sau thử lại`,
          );
          return;
        }
        const claimed = await this.claim(group.rowIds, at, staleBefore);
        if (claimed.length === 0) continue; // tiến trình khác đang gửi
        const items = group.items.filter((_, i) =>
          claimed.includes(group.rowIds[i]),
        );
        const outcome = await this.mail.send({
          to: group.row.user.email,
          ...loanReminderEmail({
            fullName: group.row.user.fullName,
            kind: group.kind,
            loans: items,
            loansUrl: `${this.mail.appUrl}/my/loans`,
            accountUrl: `${this.mail.appUrl}/account`,
          }),
          idempotencyKey: idempotencyKey(group.kind, claimed),
        });
        mailsSent += 1;
        if (outcome.status === 'SENT') {
          consecutiveFailures = 0;
          result.sent += 1;
          await this.prisma.reminderEmail.updateMany({
            where: { id: { in: claimed } },
            data: {
              status: ReminderEmailStatus.SENT,
              sentAt: new Date(),
              claimedAt: null,
              lastError: null,
            },
          });
        } else if (outcome.status === 'FAILED') {
          consecutiveFailures += 1;
          result.failed += 1;
          await this.releaseAfterFailure(
            claimed,
            outcome.error,
            outcome.retryable,
            opts.maxAttempts,
          );
        } else {
          // SKIPPED: cấu hình bị tắt giữa chừng; trả lại như chưa động tới
          await this.prisma.reminderEmail.updateMany({
            where: { id: { in: claimed } },
            data: { claimedAt: null, attempts: { decrement: 1 } },
          });
          return;
        }
        if (opts.paceMs > 0) await sleep(opts.paceMs);
      }
      if (rows.length < opts.batchSize) return;
    }
  }

  /** Giữ từng bản ghi; trả về id những bản ghi mà CHÍNH lượt này giữ được. */
  private async claim(
    ids: number[],
    at: Date,
    staleBefore: Date,
  ): Promise<number[]> {
    const claimed: number[] = [];
    for (const id of ids) {
      const res = await this.prisma.reminderEmail.updateMany({
        where: {
          id,
          status: ReminderEmailStatus.PENDING,
          OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
        },
        data: { claimedAt: at, attempts: { increment: 1 } },
      });
      if (res.count === 1) claimed.push(id);
    }
    return claimed;
  }

  private async releaseAfterFailure(
    ids: number[],
    error: string,
    retryable: boolean,
    maxAttempts: number,
  ): Promise<void> {
    const lastError = error.slice(0, 300);
    // Lỗi không đáng thử lại (sai khoá, sai địa chỉ) → bỏ cuộc ngay; còn lại thử tới maxAttempts
    await this.prisma.reminderEmail.updateMany({
      where: {
        id: { in: ids },
        ...(retryable && { attempts: { gte: maxAttempts } }),
      },
      data: { status: ReminderEmailStatus.FAILED, claimedAt: null, lastError },
    });
    if (retryable) {
      await this.prisma.reminderEmail.updateMany({
        where: {
          id: { in: ids },
          status: ReminderEmailStatus.PENDING,
        },
        data: { claimedAt: null, lastError },
      });
    }
  }
}

/** Cùng tập bản ghi + loại thì cùng khoá: gửi lại sau sự cố không tạo thêm thư ở Resend. */
function idempotencyKey(kind: ReminderKind, ids: number[]): string {
  const digest = createHash('sha256')
    .update([...ids].sort((a, b) => a - b).join(','))
    .digest('hex')
    .slice(0, 32);
  return `reminder-${kind}-${digest}`;
}
