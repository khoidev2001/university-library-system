import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupE2eData, createE2eApp } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const RUN = `${Date.now().toString().slice(-6)}x`;
const SUFFIX = `${RUN}@throttle2.local`;

describeWithDb('Giới hạn tần suất các API mật khẩu (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let token: string;

  beforeAll(async () => {
    process.env.FORGOT_PASSWORD_MIN_MS = '0';
    const e = await createE2eApp();
    ({ app, prisma, http } = e);
    const user = await e.createUser(`rd${SUFFIX}`, Role.READER, {
      memberCode: `THR${RUN}`,
    });
    token = e.tokenFor(user);
  });

  afterAll(async () => {
    await cleanupE2eData(prisma, { emailSuffix: SUFFIX });
    await app.close();
    delete process.env.FORGOT_PASSWORD_MIN_MS;
  });

  it('forgot-password: 5 requests a minute, then 429 in the standard error format', async () => {
    const attempt = () =>
      http.post('/api/auth/forgot-password').send({ email: `nobody${SUFFIX}` });
    for (let i = 0; i < 5; i++) await attempt().expect(200);
    const res = await attempt().expect(429);
    expect(res.body).toMatchObject({
      statusCode: 429,
      error: 'TOO_MANY_REQUESTS',
      path: '/api/auth/forgot-password',
    });
  });

  it('reset-password: 10 attempts a minute (brute-forcing tokens is capped), then 429', async () => {
    const attempt = () =>
      http
        .post('/api/auth/reset-password')
        .send({ token: 'B'.repeat(43), newPassword: 'FreshPass123' });
    for (let i = 0; i < 10; i++) await attempt().expect(400);
    await attempt().expect(429);
  });

  it('change-password: 5 attempts a minute (guessing the current password is capped), then 429', async () => {
    const attempt = () =>
      http
        .post('/api/auth/change-password')
        .set({ Authorization: `Bearer ${token}` })
        .send({ currentPassword: 'WrongPass1', newPassword: 'FreshPass123' });
    for (let i = 0; i < 5; i++) await attempt().expect(400);
    await attempt().expect(429);
  });
});
