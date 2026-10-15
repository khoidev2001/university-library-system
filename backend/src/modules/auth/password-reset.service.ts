import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { passwordResetEmail } from '../mail/mail.templates';
import { MailService } from '../mail/mail.service';
import { BCRYPT_ROUNDS, normalizeEmail } from './auth.service';
import {
  generateResetToken,
  hashResetToken,
  RESET_TOKEN_TTL_MINUTES,
} from './reset-token.util';

/** Yêu cầu mới trong khoảng này sau yêu cầu trước bị bỏ qua âm thầm (chống dội thư vào hộp của nạn nhân). */
export const RESET_REQUEST_COOLDOWN_MS = 60_000;
/** Mặc định mỗi lần gọi forgot-password mất tối thiểu ngần này, dù email có tồn tại hay không. */
const DEFAULT_MIN_RESPONSE_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly minResponseMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    const configured = Number(config.get('FORGOT_PASSWORD_MIN_MS'));
    this.minResponseMs = Number.isFinite(configured)
      ? configured
      : DEFAULT_MIN_RESPONSE_MS;
  }

  /**
   * Luôn trả như nhau dù email có tồn tại, bị khoá hay chưa cấu hình gửi thư: người ngoài không dò
   * được email nào đã đăng ký. Thời gian cũng được san phẳng: thư gửi nền (không chờ), các nhánh
   * ngắn được chờ bù tới `minResponseMs`.
   */
  async requestReset(rawEmail: string): Promise<void> {
    const started = Date.now();
    try {
      await this.issueToken(normalizeEmail(rawEmail));
    } catch (err) {
      // Không để lỗi nội bộ lộ ra (lỗi chỉ xảy ra với email có thật sẽ thành "dấu vết"); chỉ ghi log.
      this.logger.error(
        'Tạo token đặt lại mật khẩu thất bại',
        err instanceof Error ? err.stack : undefined,
      );
    }
    const remaining = this.minResponseMs - (Date.now() - started);
    if (remaining > 0) await sleep(remaining);
  }

  private async issueToken(email: string): Promise<void> {
    const user =
      (await this.prisma.user.findUnique({ where: { email } })) ??
      (await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      }));
    const { token, hash } = generateResetToken();
    // Tài khoản bị khoá không nhận thư (cũng không tạo token). Chưa cấu hình gửi thư thì tạo token
    // cũng vô ích (không ai nhận được liên kết): bỏ qua, thủ thư dùng chức năng cấp mật khẩu tạm.
    if (!user || !user.isActive || !this.mail.enabled) return;

    const now = new Date();
    const created = await this.prisma.$transaction(async (tx) => {
      // Khoá hàng người dùng: hai yêu cầu đồng thời xếp hàng, nên "token cũ bị vô hiệu" và
      // "thời gian chờ giữa hai yêu cầu" luôn nhất quán.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
      const last = await tx.passwordResetToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (
        last &&
        now.getTime() - last.createdAt.getTime() < RESET_REQUEST_COOLDOWN_MS
      )
        return false;
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hash,
          expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000),
        },
      });
      return true;
    });
    if (!created) return;

    const link = `${this.mail.appUrl}/reset-password?token=${token}`;
    this.mail.sendDetached({
      to: user.email,
      ...passwordResetEmail({
        fullName: user.fullName,
        link,
        validMinutes: RESET_TOKEN_TTL_MINUTES,
      }),
    });
  }

  /**
   * Đổi mật khẩu bằng token. Dùng một lần và chống đua: câu `UPDATE … WHERE used_at IS NULL
   * AND expires_at > now` chỉ một giao dịch thắng khi nhiều yêu cầu cùng token đến đồng thời.
   * Token sai / hết hạn / đã dùng / của tài khoản đã khoá đều trả CÙNG một lỗi.
   * Tra token bằng băm SHA-256 qua chỉ mục duy nhất của DB (không so sánh chuỗi bí mật trong mã),
   * nên không có phép so sánh nào để đo thời gian.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Băm trước khi mở giao dịch: giữ giao dịch ngắn, và thời gian không tiết lộ token có hợp lệ
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const tokenHash = hashResetToken(token);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw invalidToken();
      const row = await tx.passwordResetToken.findUniqueOrThrow({
        where: { tokenHash },
        select: { userId: true, user: { select: { isActive: true } } },
      });
      // Ném lỗi ở đây thì cả giao dịch (kể cả việc đánh dấu đã dùng) bị huỷ
      if (!row.user.isActive) throw invalidToken();
      await tx.user.update({
        where: { id: row.userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: now,
          sessionsRevokedAt: now,
        },
      });
      // Các token còn lại của người này (nếu có) cũng hết hiệu lực
      await tx.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: now },
      });
    });
  }
}

function invalidToken(): BusinessException {
  return new BusinessException(
    'INVALID_RESET_TOKEN',
    'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
    HttpStatus.BAD_REQUEST,
  );
}
