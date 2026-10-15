import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { isValidPassword } from '../src/common/password.util';
import { InMemoryMailSender } from '../src/modules/mail/memory-mail.sender';
import { MailService } from '../src/modules/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}t`;
const SUFFIX = `${RUN}@temp.local`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describeWithDb('Bạn đọc tạo tại quầy và mật khẩu tạm (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let mailbox: InMemoryMailSender;
  let mail: MailService;
  let tokenFor: Awaited<ReturnType<typeof createE2eApp>>['tokenFor'];
  let librarian: { id: number; email: string };
  let librarian2: { id: number; email: string };
  let admin: { id: number; email: string };
  let plainReader: { id: number; email: string };
  let libToken: string;
  let adminToken: string;
  let readerToken: string;

  const asLib = () => ({ Authorization: `Bearer ${libToken}` });
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  beforeAll(async () => {
    const e = await createE2eApp();
    ({ app, prisma, http, mailbox, tokenFor } = e);
    mail = app.get(MailService);
    librarian = await e.createUser(`lib${SUFFIX}`, Role.LIBRARIAN);
    librarian2 = await e.createUser(`lib2${SUFFIX}`, Role.LIBRARIAN);
    admin = await e.createUser(`adm${SUFFIX}`, Role.ADMIN);
    plainReader = await e.createUser(`rd${SUFFIX}`, Role.READER, {
      memberCode: `TMP${RUN}`,
    });
    libToken = tokenFor({
      ...librarian,
      role: Role.LIBRARIAN,
      memberType: null,
    });
    adminToken = tokenFor({ ...admin, role: Role.ADMIN, memberType: null });
    readerToken = tokenFor({
      ...plainReader,
      role: Role.READER,
      memberType: 'STUDENT',
    });
  });

  afterAll(async () => {
    await mail.drain();
    await cleanupE2eData(prisma, { emailSuffix: SUFFIX });
    await app.close();
  });

  beforeEach(() => mailbox.clear());

  describe('POST /users/readers', () => {
    it('creates a reader with a generated member code and a one-time temporary password', async () => {
      const res = await http
        .post('/api/users/readers')
        .set(asLib())
        .send({
          email: `New.Reader${SUFFIX}`,
          fullName: '  Trần Thị B ',
          memberType: 'STUDENT',
        })
        .expect(201);
      expect(res.headers['cache-control']).toBe('no-store');
      const { user, temporaryPassword } = res.body;
      expect(user).toMatchObject({
        email: `new.reader${SUFFIX}`,
        fullName: 'Trần Thị B',
        role: 'READER',
        memberType: 'STUDENT',
        isActive: true,
        mustChangePassword: true,
      });
      expect(user.memberCode).toMatch(/^DG\d{8}$/);
      expect(user).not.toHaveProperty('passwordHash');
      expect(isValidPassword(temporaryPassword)).toBe(true);

      const row = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.passwordHash).not.toContain(temporaryPassword);
      expect(await bcrypt.compare(temporaryPassword, row.passwordHash)).toBe(
        true,
      );
      expect(row.mustChangePassword).toBe(true);
    });

    it('accepts an explicit member code and keeps it', async () => {
      const res = await http
        .post('/api/users/readers')
        .set(asLib())
        .send({
          email: `explicit${SUFFIX}`,
          fullName: 'Có Mã Sẵn',
          memberType: 'LECTURER',
          memberCode: `GV-${RUN}`,
        })
        .expect(201);
      expect(res.body.user).toMatchObject({
        memberCode: `GV-${RUN}`,
        memberType: 'LECTURER',
      });
    });

    it('rejects duplicate e-mail (any case) and duplicate member code with 409', async () => {
      const dup = await http
        .post('/api/users/readers')
        .set(asLib())
        .send({
          email: plainReader.email.toUpperCase(),
          fullName: 'Trùng Email',
          memberType: 'STUDENT',
        })
        .expect(409);
      expect(dup.body.error).toBe('EMAIL_EXISTS');
      const code = await http
        .post('/api/users/readers')
        .set(asLib())
        .send({
          email: `dupcode${SUFFIX}`,
          fullName: 'Trùng Mã',
          memberType: 'STUDENT',
          memberCode: `tmp${RUN}`.toLowerCase(),
        })
        .expect(409);
      expect(code.body.error).toBe('MEMBER_CODE_EXISTS');
    });

    it('validates the input (bad e-mail, bad member code, extra fields such as a password or role)', async () => {
      const base = { fullName: 'Hợp Lệ', memberType: 'STUDENT' };
      await http
        .post('/api/users/readers')
        .set(asLib())
        .send({ ...base, email: 'not-an-email' })
        .expect(400);
      await http
        .post('/api/users/readers')
        .set(asLib())
        .send({ ...base, email: `v1${SUFFIX}`, memberCode: 'a b' })
        .expect(400);
      await http
        .post('/api/users/readers')
        .set(asLib())
        .send({ ...base, email: `v2${SUFFIX}`, password: 'Secret123' })
        .expect(400);
      await http
        .post('/api/users/readers')
        .set(asLib())
        .send({ ...base, email: `v3${SUFFIX}`, role: 'ADMIN' })
        .expect(400);
    });

    it('is allowed for ADMIN and denied for READER and anonymous callers', async () => {
      await http
        .post('/api/users/readers')
        .set(asAdmin())
        .send({
          email: `byadmin${SUFFIX}`,
          fullName: 'Do Admin Tạo',
          memberType: 'STUDENT',
        })
        .expect(201);
      const body = {
        email: `denied${SUFFIX}`,
        fullName: 'Bị Chặn',
        memberType: 'STUDENT',
      };
      await http
        .post('/api/users/readers')
        .set({ Authorization: `Bearer ${readerToken}` })
        .send(body)
        .expect(403);
      await http.post('/api/users/readers').send(body).expect(401);
      expect(
        await prisma.user.count({ where: { email: `denied${SUFFIX}` } }),
      ).toBe(0);
    });

    it('sends a welcome e-mail without the password when mail is configured', async () => {
      const res = await http
        .post('/api/users/readers')
        .set(asLib())
        .send({
          email: `welcome${SUFFIX}`,
          fullName: 'Có Thư Chào',
          memberType: 'STUDENT',
        })
        .expect(201);
      expect(res.body.welcomeEmailQueued).toBe(true);
      await mail.drain();
      const sent = mailbox.to(`welcome${SUFFIX}`);
      expect(sent).toHaveLength(1);
      expect(sent[0].text).toContain(res.body.user.memberCode);
      expect(sent[0].text).not.toContain(res.body.temporaryPassword);
      expect(sent[0].html).not.toContain(res.body.temporaryPassword);
    });

    it('still creates the reader when mail is not configured (nothing sent, no error)', async () => {
      mailbox.enabled = false;
      try {
        const res = await http
          .post('/api/users/readers')
          .set(asLib())
          .send({
            email: `nomail${SUFFIX}`,
            fullName: 'Không Thư',
            memberType: 'STUDENT',
          })
          .expect(201);
        expect(res.body.welcomeEmailQueued).toBe(false);
        await mail.drain();
        expect(mailbox.outbox).toHaveLength(0);
      } finally {
        mailbox.enabled = true;
      }
    });

    it('lets exactly one of several concurrent creations with the same e-mail win', async () => {
      const send = () =>
        http
          .post('/api/users/readers')
          .set(asLib())
          .send({
            email: `race${SUFFIX}`,
            fullName: 'Đua Email',
            memberType: 'STUDENT',
          });
      const results = await Promise.all([send(), send(), send(), send()]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(3);
      expect(
        await prisma.user.count({ where: { email: `race${SUFFIX}` } }),
      ).toBe(1);
    });

    it('lets exactly one of several concurrent creations with the same member code win', async () => {
      const send = (i: number) =>
        http
          .post('/api/users/readers')
          .set(asLib())
          .send({
            email: `racecode${i}${SUFFIX}`,
            fullName: 'Đua Mã',
            memberType: 'STUDENT',
            memberCode: `RC-${RUN}`,
          });
      const results = await Promise.all([send(1), send(2), send(3)]);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(
        results.filter(
          (r) => r.status === 409 && r.body.error === 'MEMBER_CODE_EXISTS',
        ),
      ).toHaveLength(2);
    });
  });

  describe('forced password change (mustChangePassword)', () => {
    // Dùng tối đa 5 lần change-password / 10 lần login trong cả file.
    it('limits a temporary-password session to /auth/me and /auth/change-password until the password is changed', async () => {
      const created = await http
        .post('/api/users/readers')
        .set(asLib())
        .send({
          email: `forced${SUFFIX}`,
          fullName: 'Đổi Mật Khẩu Lần Đầu',
          memberType: 'STUDENT',
        })
        .expect(201);
      const temp: string = created.body.temporaryPassword;

      const login = await http
        .post('/api/auth/login')
        .send({ email: `forced${SUFFIX}`, password: temp })
        .expect(200);
      expect(login.body.user.mustChangePassword).toBe(true);
      const auth = { Authorization: `Bearer ${login.body.accessToken}` };

      await http.get('/api/auth/me').set(auth).expect(200);
      for (const path of ['/api/notifications/me', '/api/loans/me']) {
        const blocked = await http.get(path).set(auth).expect(403);
        expect(blocked.body.error).toBe('PASSWORD_CHANGE_REQUIRED');
      }
      await http
        .patch('/api/auth/me')
        .set(auth)
        .send({ fullName: 'Vẫn Bị Chặn' })
        .expect(403);

      // đổi sang đúng mật khẩu tạm bị từ chối
      await http
        .post('/api/auth/change-password')
        .set(auth)
        .send({ currentPassword: temp, newPassword: temp })
        .expect(400);
      const changed = await http
        .post('/api/auth/change-password')
        .set(auth)
        .send({ currentPassword: temp, newPassword: 'MyOwnPass789' })
        .expect(200);
      expect(changed.body.mustChangePassword).toBe(false);

      // cùng token, giờ đã được dùng bình thường
      await http.get('/api/notifications/me').set(auth).expect(200);
      await http
        .post('/api/auth/login')
        .send({ email: `forced${SUFFIX}`, password: temp })
        .expect(401);
    });
  });

  describe('POST /users/:id/reset-password', () => {
    it('lets a librarian re-issue a reader password: one-time temp password, old password and old sessions die', async () => {
      const oldLogin = await http
        .post('/api/auth/login')
        .send({ email: plainReader.email, password: 'Secret123' })
        .expect(200);
      const oldAuth = { Authorization: `Bearer ${oldLogin.body.accessToken}` };
      await http.get('/api/auth/me').set(oldAuth).expect(200);

      // dòng chờ: một token quên mật khẩu còn hiệu lực cũng phải bị vô hiệu
      await prisma.passwordResetToken.create({
        data: {
          userId: plainReader.id,
          tokenHash: `h-${RUN}-staff`,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      await sleep(1100); // iat tính theo giây

      const res = await http
        .post(`/api/users/${plainReader.id}/reset-password`)
        .set(asLib())
        .expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.user).toMatchObject({
        id: plainReader.id,
        mustChangePassword: true,
      });
      expect(isValidPassword(res.body.temporaryPassword)).toBe(true);

      await http.get('/api/auth/me').set(oldAuth).expect(401); // phiên cũ bị thu hồi
      await http
        .post('/api/auth/login')
        .send({ email: plainReader.email, password: 'Secret123' })
        .expect(401);
      const fresh = await http
        .post('/api/auth/login')
        .send({
          email: plainReader.email,
          password: res.body.temporaryPassword,
        })
        .expect(200);
      expect(fresh.body.user.mustChangePassword).toBe(true);
      // token mới đăng nhập ngay sau khi cấp lại vẫn dùng được (không bị thu hồi nhầm)
      await http
        .get('/api/auth/me')
        .set({ Authorization: `Bearer ${fresh.body.accessToken}` })
        .expect(200);
      const token = await prisma.passwordResetToken.findUniqueOrThrow({
        where: { tokenHash: `h-${RUN}-staff` },
      });
      expect(token.usedAt).not.toBeNull();
    });

    it('keeps staff accounts for admins: a librarian gets 403, an admin may re-issue them', async () => {
      const denied = await http
        .post(`/api/users/${librarian2.id}/reset-password`)
        .set(asLib())
        .expect(403);
      expect(denied.body.error).toBe('STAFF_ACCOUNT_PROTECTED');
      await http
        .post(`/api/users/${admin.id}/reset-password`)
        .set(asLib())
        .expect(403);
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: librarian2.id },
      });
      expect(before.mustChangePassword).toBe(false);

      const ok = await http
        .post(`/api/users/${librarian2.id}/reset-password`)
        .set(asAdmin())
        .expect(200);
      expect(ok.body.user.mustChangePassword).toBe(true);
    });

    it('refuses self re-issue, unknown ids, readers and anonymous callers', async () => {
      const self = await http
        .post(`/api/users/${admin.id}/reset-password`)
        .set(asAdmin())
        .expect(409);
      expect(self.body.error).toBe('CANNOT_RESET_SELF');
      await http
        .post('/api/users/2147483000/reset-password')
        .set(asAdmin())
        .expect(404);
      await http
        .post(`/api/users/${plainReader.id}/reset-password`)
        // token mới cấp: token cũ của bạn đọc này đã bị thu hồi ở bài trước
        .set({
          Authorization: `Bearer ${tokenFor({ id: plainReader.id, role: Role.READER, memberType: 'STUDENT' })}`,
        })
        .expect(403);
      await http
        .post(`/api/users/${plainReader.id}/reset-password`)
        .expect(401);
    });
  });

  describe('lock / unlock a reader card', () => {
    it('lets a librarian lock a reader (login then answers 403 ACCOUNT_LOCKED) and unlock again', async () => {
      const created = await http
        .post('/api/users/readers')
        .set(asLib())
        .send({
          email: `lock${SUFFIX}`,
          fullName: 'Khoá Thử',
          memberType: 'STUDENT',
        })
        .expect(201);
      const { id } = created.body.user;
      const temp = created.body.temporaryPassword;
      await http
        .patch(`/api/users/${id}`)
        .set(asLib())
        .send({ isActive: false })
        .expect(200);
      const locked = await http
        .post('/api/auth/login')
        .send({ email: `lock${SUFFIX}`, password: temp })
        .expect(403);
      expect(locked.body.error).toBe('ACCOUNT_LOCKED');
      await http
        .patch(`/api/users/${id}`)
        .set(asLib())
        .send({ isActive: true })
        .expect(200);
      await http
        .post('/api/auth/login')
        .send({ email: `lock${SUFFIX}`, password: temp })
        .expect(200);
    });
  });
});
