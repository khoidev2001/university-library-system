import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp, PASSWORD } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}p`;
const SUFFIX = `${RUN}@prof.local`;
const NEW_PASSWORD = 'Another456';

describeWithDb('Hồ sơ cá nhân và đổi mật khẩu (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let tokenFor: Awaited<ReturnType<typeof createE2eApp>>['tokenFor'];
  let reader: { id: number; email: string };
  let readerToken: string;

  beforeAll(async () => {
    const e = await createE2eApp();
    ({ app, prisma, http, tokenFor } = e);
    const created = await e.createUser(`rd${SUFFIX}`, Role.READER, {
      memberCode: `PRF${RUN}`,
      fullName: 'Người Dùng Thử',
    });
    reader = created;
    readerToken = tokenFor(created);
  });

  afterAll(async () => {
    await cleanupE2eData(prisma, { emailSuffix: SUFFIX });
    await app.close();
  });

  const bearer = () => ({ Authorization: `Bearer ${readerToken}` });

  describe('GET/PATCH /auth/me', () => {
    it('exposes the account fields, never the hash or the revocation timestamp', async () => {
      const res = await http.get('/api/auth/me').set(bearer()).expect(200);
      expect(res.body).toMatchObject({
        id: reader.id,
        email: reader.email,
        role: 'READER',
        emailReminders: true,
        mustChangePassword: false,
      });
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('sessionsRevokedAt');
    });

    it('lets the user change fullName and the e-mail reminder switch', async () => {
      const res = await http
        .patch('/api/auth/me')
        .set(bearer())
        .send({ fullName: '  Tên Mới  ', emailReminders: false })
        .expect(200);
      expect(res.body).toMatchObject({
        fullName: 'Tên Mới',
        emailReminders: false,
      });
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: reader.id },
      });
      expect(row.fullName).toBe('Tên Mới');
      expect(row.emailReminders).toBe(false);
    });

    it.each([
      ['role', { role: 'ADMIN' }],
      ['email', { email: 'hacker@x.vn' }],
      ['memberCode', { memberCode: 'HACK1' }],
      ['isActive', { isActive: false }],
      ['mustChangePassword', { mustChangePassword: false }],
    ])(
      'rejects a self-edit of %s with 400 and changes nothing',
      async (_n, body) => {
        await http.patch('/api/auth/me').set(bearer()).send(body).expect(400);
        const row = await prisma.user.findUniqueOrThrow({
          where: { id: reader.id },
        });
        expect(row.role).toBe(Role.READER);
        expect(row.email).toBe(reader.email);
        expect(row.isActive).toBe(true);
      },
    );

    it('rejects an empty update and a too-short name', async () => {
      await http.patch('/api/auth/me').set(bearer()).send({}).expect(400);
      await http
        .patch('/api/auth/me')
        .set(bearer())
        .send({ fullName: 'A' })
        .expect(400);
    });

    it('requires a login', async () => {
      await http.patch('/api/auth/me').send({ fullName: 'Ai Đó' }).expect(401);
    });
  });

  describe('POST /auth/change-password', () => {
    // Giới hạn 5 lần/phút/IP: bài này dùng đúng 5 lần gọi.
    it('rejects a wrong current password with 400 (not 401, so the UI keeps the session)', async () => {
      const res = await http
        .post('/api/auth/change-password')
        .set(bearer())
        .send({ currentPassword: 'WrongPass1', newPassword: NEW_PASSWORD })
        .expect(400);
      expect(res.body.error).toBe('WRONG_CURRENT_PASSWORD');
    });

    it('rejects a new password equal to the current one', async () => {
      const res = await http
        .post('/api/auth/change-password')
        .set(bearer())
        .send({ currentPassword: PASSWORD, newPassword: PASSWORD })
        .expect(400);
      expect(res.body.error).toBe('PASSWORD_UNCHANGED');
    });

    it('applies the register policy to the new password (too short / over 72 bytes)', async () => {
      await http
        .post('/api/auth/change-password')
        .set(bearer())
        .send({ currentPassword: PASSWORD, newPassword: 'short' })
        .expect(400);
      await http
        .post('/api/auth/change-password')
        .set(bearer())
        .send({ currentPassword: PASSWORD, newPassword: 'a'.repeat(73) })
        .expect(400);
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: reader.id },
      });
      expect(await bcrypt.compare(PASSWORD, row.passwordHash)).toBe(true);
    });

    it('changes the password: the new one logs in, the old one does not, session stays valid', async () => {
      const res = await http
        .post('/api/auth/change-password')
        .set(bearer())
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(200);
      expect(res.body).toMatchObject({
        id: reader.id,
        mustChangePassword: false,
      });
      expect(res.body.passwordChangedAt).toBeTruthy();
      expect(res.headers['cache-control']).toBe('no-store');

      await http
        .post('/api/auth/login')
        .send({ email: reader.email, password: PASSWORD })
        .expect(401);
      const login = await http
        .post('/api/auth/login')
        .send({ email: reader.email, password: NEW_PASSWORD })
        .expect(200);
      expect(login.body.user.lastLoginAt).toBeTruthy();
      // đổi mật khẩu không thu hồi phiên đang dùng
      await http.get('/api/auth/me').set(bearer()).expect(200);
    });
  });

  it('records the previous and latest login time', async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: reader.id },
    });
    const second = await http
      .post('/api/auth/login')
      .send({ email: reader.email, password: NEW_PASSWORD })
      .expect(200);
    expect(new Date(second.body.user.previousLoginAt).getTime()).toBe(
      before.lastLoginAt!.getTime(),
    );
    expect(
      new Date(second.body.user.lastLoginAt).getTime(),
    ).toBeGreaterThanOrEqual(before.lastLoginAt!.getTime());
  });
});
