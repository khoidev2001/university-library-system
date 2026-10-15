import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './support/e2e-app';

// Chạy trên Postgres thật (DATABASE_URL); CI cung cấp service container.
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb('Giới hạn tần suất đăng nhập (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    ({ app, http } = await createE2eApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows 10 attempts a minute, then answers 429 TOO_MANY_REQUESTS in the standard error format', async () => {
    const attempt = () =>
      http
        .post('/api/auth/login')
        .send({ email: 'nobody@throttle.local', password: 'wrong-pass' });
    for (let i = 0; i < 10; i++) await attempt().expect(401);

    const res = await attempt().expect(429);
    expect(res.body).toMatchObject({
      statusCode: 429,
      error: 'TOO_MANY_REQUESTS',
      path: '/api/auth/login',
    });
    expect(res.headers['retry-after']).toBeDefined();
  });
});
