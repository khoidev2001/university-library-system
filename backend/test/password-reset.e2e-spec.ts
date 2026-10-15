import { INestApplication, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { PasswordResetService } from '../src/modules/auth/password-reset.service';
import { hashResetToken } from '../src/modules/auth/reset-token.util';
import { MailService } from '../src/modules/mail/mail.service';
import { InMemoryMailSender } from '../src/modules/mail/memory-mail.sender';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp, PASSWORD } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}r`;
const SUFFIX = `${RUN}@reset.local`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GENERIC_MESSAGE_PREFIX = 'Nếu email này đã đăng ký';

describeWithDb('Quên mật khẩu và đặt lại bằng token (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let mailbox: InMemoryMailSender;
  let mail: MailService;
  let resets: PasswordResetService;

  /** Mỗi bài có người dùng riêng để giới hạn "60 giây giữa hai yêu cầu" không ảnh hưởng nhau. */
  let counter = 0;
  const newUser = async (opts: { active?: boolean } = {}) => {
    counter += 1;
    const email = `u${counter}${SUFFIX}`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        fullName: `Người ${counter}`,
        role: Role.READER,
        memberType: 'STUDENT',
        memberCode: `RS${RUN}${counter}`,
        isActive: opts.active ?? true,
      },
    });
    return user;
  };

  /** Lấy token từ liên kết trong thư gửi tới `email`. */
  const tokenFromMail = (email: string): string => {
    const sent = mailbox.to(email);
    expect(sent.length).toBeGreaterThan(0);
    const match = /reset-password\?token=([A-Za-z0-9_-]+)/.exec(
      sent[sent.length - 1].text,
    );
    expect(match).not.toBeNull();
    return match![1];
  };

  /** Xin thư đặt lại qua service (bỏ giới hạn tần suất HTTP) rồi trả token trong thư. */
  const requestToken = async (email: string): Promise<string> => {
    await resets.requestReset(email);
    await mail.drain();
    return tokenFromMail(email);
  };

  beforeAll(async () => {
    process.env.FORGOT_PASSWORD_MIN_MS = '0';
    const e = await createE2eApp();
    ({ app, prisma, http, mailbox } = e);
    mail = app.get(MailService);
    resets = app.get(PasswordResetService);
  });

  afterAll(async () => {
    await mail.drain();
    await cleanupE2eData(prisma, { emailSuffix: SUFFIX });
    await app.close();
    delete process.env.FORGOT_PASSWORD_MIN_MS;
  });

  beforeEach(() => mailbox.clear());

  describe('POST /auth/forgot-password', () => {
    // Giới hạn 5 lần/phút/IP: nhóm này dùng đúng 5 lần gọi HTTP.
    it('answers 200 with an identical body for a registered and an unknown e-mail, mailing only the former', async () => {
      const user = await newUser();
      const known = await http
        .post('/api/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);
      const unknown = await http
        .post('/api/auth/forgot-password')
        .send({ email: `nobody${SUFFIX}` })
        .expect(200);
      expect(known.body).toEqual(unknown.body);
      expect(known.body.message).toContain(GENERIC_MESSAGE_PREFIX);
      expect(known.headers['cache-control']).toBe('no-store');
      await mail.drain();
      expect(mailbox.outbox).toHaveLength(1);
      expect(mailbox.outbox[0].to).toBe(user.email);
    });

    it('is not an e-mail oracle through response time: both paths cost about the same', async () => {
      // service dựng sẵn đọc ngưỡng lúc khởi tạo; dựng một bản mới với ngưỡng thật để đo
      const timed = new PasswordResetService(prisma, mail, {
        get: () => '300',
      } as never);
      const user = await newUser();
      const t = async (email: string) => {
        const start = Date.now();
        await timed.requestReset(email);
        return Date.now() - start;
      };
      const known = await t(user.email);
      const unknown = await t(`ghost${SUFFIX}`);
      const locked = await t((await newUser({ active: false })).email);
      for (const ms of [known, unknown, locked]) {
        expect(ms).toBeGreaterThanOrEqual(290);
        expect(ms).toBeLessThan(900);
      }
      expect(Math.abs(known - unknown)).toBeLessThan(400);
    });

    it('stores only the SHA-256 of a 32-byte token, valid for one hour, and the mailed link carries the raw token', async () => {
      const user = await newUser();
      await http
        .post('/api/auth/forgot-password')
        .send({ email: user.email.toUpperCase() }) // không phân biệt hoa thường
        .expect(200);
      await mail.drain();
      const token = tokenFromMail(user.email);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
      const link = mailbox.to(user.email)[0].text;
      expect(link).toContain(`${mail.appUrl}/reset-password?token=${token}`);

      const rows = await prisma.passwordResetToken.findMany({
        where: { userId: user.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).toBe(hashResetToken(token));
      expect(rows[0].tokenHash).not.toBe(token);
      expect(JSON.stringify(rows[0])).not.toContain(token);
      const ttl = rows[0].expiresAt.getTime() - rows[0].createdAt.getTime();
      expect(ttl).toBeGreaterThan(59 * 60_000);
      expect(ttl).toBeLessThanOrEqual(60 * 60_000 + 1000);
      expect(rows[0].usedAt).toBeNull();
    });

    it('sends no mail and creates no token for a locked account, yet answers the same 200', async () => {
      const locked = await newUser({ active: false });
      const res = await http
        .post('/api/auth/forgot-password')
        .send({ email: locked.email })
        .expect(200);
      expect(res.body.message).toContain(GENERIC_MESSAGE_PREFIX);
      await mail.drain();
      expect(mailbox.outbox).toHaveLength(0);
      expect(
        await prisma.passwordResetToken.count({ where: { userId: locked.id } }),
      ).toBe(0);
    });

    it('rejects a malformed e-mail with 400 (format only, reveals nothing about accounts)', async () => {
      await http
        .post('/api/auth/forgot-password')
        .send({ email: 'khong-phai-email' })
        .expect(400);
    });
  });

  describe('request cooldown and token replacement', () => {
    it('ignores a second request within 60 s (no second mail, same token still valid)', async () => {
      const user = await newUser();
      const first = await requestToken(user.email);
      await resets.requestReset(user.email);
      await mail.drain();
      expect(mailbox.to(user.email)).toHaveLength(1);
      expect(
        await prisma.passwordResetToken.count({ where: { userId: user.id } }),
      ).toBe(1);
      await resets.resetPassword(first, 'BrandNew123');
    });

    it('invalidates the previous token when a new one is issued; only the newest works', async () => {
      const user = await newUser();
      const first = await requestToken(user.email);
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id },
        data: { createdAt: new Date(Date.now() - 5 * 60_000) },
      });
      const second = await requestToken(user.email);
      expect(second).not.toBe(first);
      expect(mailbox.to(user.email)).toHaveLength(2);

      await expect(
        resets.resetPassword(first, 'BrandNew123'),
      ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
      await resets.resetPassword(second, 'BrandNew123');
      const login = await http
        .post('/api/auth/login')
        .send({ email: user.email, password: 'BrandNew123' })
        .expect(200);
      expect(login.body.user.id).toBe(user.id);
    });
  });

  describe('POST /auth/reset-password', () => {
    // Giới hạn 10 lần/phút/IP: nhóm này dùng 7 lần gọi HTTP.
    it('sets the new password, single use: the token cannot be replayed, the old password stops working', async () => {
      const user = await newUser();
      const token = await requestToken(user.email);
      const ok = await http
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'FreshPass123' })
        .expect(200);
      expect(ok.body).toEqual({ ok: true });
      expect(ok.headers['cache-control']).toBe('no-store');

      await http
        .post('/api/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(401);
      await http
        .post('/api/auth/login')
        .send({ email: user.email, password: 'FreshPass123' })
        .expect(200);

      const replay = await http
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'Hijacked1234' })
        .expect(400);
      expect(replay.body.error).toBe('INVALID_RESET_TOKEN');
      await http
        .post('/api/auth/login')
        .send({ email: user.email, password: 'Hijacked1234' })
        .expect(401);
    });

    it('rejects an expired token and leaves the password alone', async () => {
      const user = await newUser();
      const token = await requestToken(user.email);
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await http
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'FreshPass123' })
        .expect(400);
      expect(res.body.error).toBe('INVALID_RESET_TOKEN');
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(await bcrypt.compare(PASSWORD, row.passwordHash)).toBe(true);
    });

    it('answers a never-issued token with the very same error as an expired or used one', async () => {
      const fake = 'A'.repeat(43);
      const res = await http
        .post('/api/auth/reset-password')
        .send({ token: fake, newPassword: 'FreshPass123' })
        .expect(400);
      expect(res.body.error).toBe('INVALID_RESET_TOKEN');
    });

    it('does not consume the token when the new password fails validation', async () => {
      const user = await newUser();
      const token = await requestToken(user.email);
      await http
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'short' })
        .expect(400);
      await http
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'ValidPass123' })
        .expect(200);
    });

    it("changes only the token owner's password (wrong-user safety)", async () => {
      const owner = await newUser();
      const bystander = await newUser();
      const token = await requestToken(owner.email);
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: bystander.id },
      });
      await resets.resetPassword(token, 'OwnerNew1234');
      const after = await prisma.user.findUniqueOrThrow({
        where: { id: bystander.id },
      });
      expect(after.passwordHash).toBe(before.passwordHash);
      expect(after.sessionsRevokedAt).toBeNull();
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: owner.id },
      });
      expect(await bcrypt.compare('OwnerNew1234', row.passwordHash)).toBe(true);
    });

    it('refuses a token whose account was locked after it was issued, and keeps it unconsumed', async () => {
      const user = await newUser();
      const token = await requestToken(user.email);
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });
      await expect(
        resets.resetPassword(token, 'LockedNew123'),
      ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
      const row = await prisma.passwordResetToken.findUniqueOrThrow({
        where: { tokenHash: hashResetToken(token) },
      });
      expect(row.usedAt).toBeNull(); // giao dịch bị huỷ nguyên vẹn
      const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(await bcrypt.compare(PASSWORD, u.passwordHash)).toBe(true);
    });

    it('revokes sessions issued before the reset and clears a pending forced-change flag', async () => {
      const user = await newUser();
      await prisma.user.update({
        where: { id: user.id },
        data: { mustChangePassword: true },
      });
      const login = await http
        .post('/api/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(200);
      const old = { Authorization: `Bearer ${login.body.accessToken}` };
      await http.get('/api/auth/me').set(old).expect(200);
      const token = await requestToken(user.email);
      await sleep(1100); // iat tính theo giây
      await http
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'AfterReset123' })
        .expect(200);
      await http.get('/api/auth/me').set(old).expect(401);
      const fresh = await http
        .post('/api/auth/login')
        .send({ email: user.email, password: 'AfterReset123' })
        .expect(200);
      expect(fresh.body.user.mustChangePassword).toBe(false);
    });
  });

  describe('concurrency', () => {
    it('lets exactly one of several simultaneous resets with the same token succeed', async () => {
      const user = await newUser();
      const token = await requestToken(user.email);
      const passwords = Array.from({ length: 8 }, (_, i) => `Racer${i}Pass123`);
      const outcomes = await Promise.allSettled(
        passwords.map((p) => resets.resetPassword(token, p)),
      );
      const won = outcomes.flatMap((o, i) =>
        o.status === 'fulfilled' ? [i] : [],
      );
      expect(won).toHaveLength(1);
      for (const o of outcomes) {
        if (o.status === 'rejected')
          expect(o.reason).toMatchObject({ code: 'INVALID_RESET_TOKEN' });
      }
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      // mật khẩu cuối cùng chính là mật khẩu của người thắng, không phải của kẻ thua
      expect(await bcrypt.compare(passwords[won[0]], row.passwordHash)).toBe(
        true,
      );
      for (const [i, p] of passwords.entries()) {
        if (i !== won[0])
          expect(await bcrypt.compare(p, row.passwordHash)).toBe(false);
      }
    });

    it('keeps one live token when two requests for the same account arrive together', async () => {
      const user = await newUser();
      await Promise.all([
        resets.requestReset(user.email),
        resets.requestReset(user.email),
        resets.requestReset(user.email),
      ]);
      await mail.drain();
      const live = await prisma.passwordResetToken.count({
        where: { userId: user.id, usedAt: null },
      });
      expect(live).toBe(1);
      expect(mailbox.to(user.email)).toHaveLength(1);
    });
  });

  describe('mail provider problems and secrecy', () => {
    it('answers 200 and records nothing about the provider when mail is not configured', async () => {
      const user = await newUser();
      mailbox.enabled = false;
      try {
        await resets.requestReset(user.email);
        await mail.drain();
      } finally {
        mailbox.enabled = true;
      }
      expect(mailbox.outbox).toHaveLength(0);
      expect(
        await prisma.passwordResetToken.count({ where: { userId: user.id } }),
      ).toBe(0);
    });

    it('does not leak tokens, e-mails or passwords into logs, even when the provider fails', async () => {
      const lines: string[] = [];
      const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map(
        (level) =>
          jest
            .spyOn(Logger.prototype, level)
            .mockImplementation((...args: unknown[]) => {
              lines.push(args.map(String).join(' '));
            }),
      );
      try {
        const user = await newUser();
        mailbox.failNext = 1;
        await resets.requestReset(user.email);
        await mail.drain(); // lỗi gửi được ghi log nhưng không ném ra
        const row = await prisma.passwordResetToken.findFirstOrThrow({
          where: { userId: user.id },
        });
        expect(row).toBeTruthy(); // token vẫn có, người dùng xin lại sau 60 giây
        const token = await requestTokenAfterCooldown(user.id, user.email);
        await resets.resetPassword(token, 'LoggedNew1234');
        const blob = lines.join('\n');
        expect(blob).not.toContain(token);
        expect(blob).not.toContain(user.email);
        expect(blob).not.toContain('LoggedNew1234');
        expect(blob).not.toContain(PASSWORD);
      } finally {
        spies.forEach((s) => s.mockRestore());
      }
    });
  });

  async function requestTokenAfterCooldown(userId: number, email: string) {
    await prisma.passwordResetToken.updateMany({
      where: { userId },
      data: { createdAt: new Date(Date.now() - 5 * 60_000) },
    });
    return requestToken(email);
  }
});
