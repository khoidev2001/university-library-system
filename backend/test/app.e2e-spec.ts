import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// Chạy trên Postgres thật (service container trong CI); bỏ qua khi không có DATABASE_URL
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health → 200 ok with database ok', () =>
    request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({ status: 'ok', database: 'ok' }),
      ));
});
