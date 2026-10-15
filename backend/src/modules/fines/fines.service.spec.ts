import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FineType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { QueryFinesDto } from './dto/fines.dto';
import { FinesService } from './fines.service';

const NOW = new Date('2026-10-05T09:00:00.000Z');
const policy = { finePerDay: 5000 };

describe('FinesService', () => {
  let service: FinesService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    // Thu tiền mặt chạy trong transaction có khoá dòng và tra bản ghi nối với giao dịch VNPay
    Object.assign(prisma, {
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      paymentFine: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg as unknown[]),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [FinesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(FinesService);
  });

  describe('calculateOverdue (BR-07)', () => {
    it('is 0 before and on the due date', () => {
      expect(
        service.calculateOverdue(
          { dueAt: new Date('2026-10-06T09:00:00.000Z'), returnedAt: null },
          policy,
          NOW,
        ),
      ).toBe(0);
      expect(
        service.calculateOverdue({ dueAt: NOW, returnedAt: null }, policy, NOW),
      ).toBe(0);
    });

    it('charges one day per calendar day late', () => {
      expect(
        service.calculateOverdue(
          { dueAt: new Date('2026-10-04T09:00:00.000Z'), returnedAt: null },
          policy,
          NOW,
        ),
      ).toBe(5000);
      expect(
        service.calculateOverdue(
          { dueAt: new Date('2026-10-02T09:00:00.000Z'), returnedAt: null },
          policy,
          NOW,
        ),
      ).toBe(15000);
    });

    it('is 0 when returned later the same calendar day', () => {
      expect(
        service.calculateOverdue(
          { dueAt: new Date('2026-10-05T08:00:00.000Z'), returnedAt: null },
          policy,
          NOW,
        ),
      ).toBe(0);
    });

    it('scales with the configured rate', () => {
      expect(
        service.calculateOverdue(
          { dueAt: new Date('2026-10-03T09:00:00.000Z'), returnedAt: null },
          { finePerDay: 7000 },
          NOW,
        ),
      ).toBe(14000);
    });
  });

  it('unpaidTotal sums only unpaid fines of that reader, 0 when none', async () => {
    prisma.fine.aggregate.mockResolvedValue({ _sum: { amount: 20000 } });
    expect(await service.unpaidTotal(7)).toBe(20000);
    expect(prisma.fine.aggregate.mock.calls[0][0].where).toEqual({
      paidAt: null,
      loan: { userId: 7 },
    });

    prisma.fine.aggregate.mockResolvedValue({ _sum: { amount: null } });
    expect(await service.unpaidTotal(7)).toBe(0);
  });

  it('createFine writes through the given transaction client', async () => {
    const tx = { fine: { create: jest.fn().mockResolvedValue({ id: 1 }) } };
    await service.createFine(tx as never, 100, FineType.OVERDUE, 15000);
    expect(tx.fine.create).toHaveBeenCalledWith({
      data: { loanId: 100, type: FineType.OVERDUE, amount: 15000 },
    });
    expect(prisma.fine.create).not.toHaveBeenCalled();
  });

  it('findMine returns the rows and the unpaid total', async () => {
    prisma.fine.findMany.mockResolvedValue([
      { id: 1, amount: 5000, paymentLinks: [] },
    ]);
    prisma.fine.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });
    expect(await service.findMine(7)).toEqual({
      items: [{ id: 1, amount: 5000, onlinePayment: null }],
      unpaidTotal: 5000,
    });
  });

  it('findAll maps paid=false to paidAt null and filters by reader', async () => {
    prisma.fine.findMany.mockResolvedValue([]);
    prisma.fine.count.mockResolvedValue(0);
    await service.findAll(
      Object.assign(new QueryFinesDto(), { paid: false, userId: 7 }),
    );
    expect(prisma.fine.findMany.mock.calls[0][0].where).toEqual({
      paidAt: null,
      loan: { userId: 7 },
    });

    await service.findAll(Object.assign(new QueryFinesDto(), { paid: true }));
    expect(prisma.fine.findMany.mock.calls[1][0].where).toEqual({
      paidAt: { not: null },
    });
  });

  describe('pay', () => {
    it('records who collected and when, with a conditional update (paid_at IS NULL)', async () => {
      prisma.fine.findUnique.mockResolvedValue({ id: 1, paidAt: null });
      prisma.fine.updateMany.mockResolvedValue({ count: 1 });
      prisma.fine.findUniqueOrThrow.mockResolvedValue({
        id: 1,
        paidToId: 2,
        paidAt: new Date(),
        paymentLinks: [],
      });
      const fine = await service.pay(1, 2);
      expect(fine).toMatchObject({ paidToId: 2 });
      expect((fine as unknown as { paidAt: Date }).paidAt).toBeInstanceOf(Date);
      expect(prisma.fine.updateMany.mock.calls[0][0]).toMatchObject({
        where: { id: 1, paidAt: null },
        data: { paidToId: 2 },
      });
    });

    it('race: another librarian collected between read and write → FINE_ALREADY_PAID', async () => {
      prisma.fine.findUnique.mockResolvedValue({ id: 1, paidAt: null });
      prisma.fine.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.pay(1, 2)).rejects.toMatchObject({
        code: 'FINE_ALREADY_PAID',
      });
    });

    it('refuses cash while the fine sits in a live PENDING VNPay payment', async () => {
      prisma.fine.findUnique.mockResolvedValue({ id: 1, paidAt: null });
      (
        prisma as unknown as { paymentFine: { findFirst: jest.Mock } }
      ).paymentFine.findFirst.mockResolvedValue({
        payment: {
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await expect(service.pay(1, 2)).rejects.toMatchObject({
        code: 'FINE_PAYMENT_PENDING',
      });
      expect(prisma.fine.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to collect twice and 404s an unknown fine', async () => {
      prisma.fine.findUnique.mockResolvedValue({ id: 1, paidAt: new Date() });
      await expect(service.pay(1, 2)).rejects.toMatchObject({
        code: 'FINE_ALREADY_PAID',
      });

      prisma.fine.findUnique.mockResolvedValue(null);
      await expect(service.pay(9, 2)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
