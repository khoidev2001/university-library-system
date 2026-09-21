import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const prisma = { $queryRaw: jest.fn() };
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('reports ok when the database answers', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const result = await controller.check();
    expect(result).toMatchObject({
      status: 'ok',
      service: 'backend',
      database: 'ok',
    });
  });

  it('reports degraded when the database is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await controller.check();
    expect(result).toMatchObject({
      status: 'degraded',
      database: 'unavailable',
    });
  });
});
