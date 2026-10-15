import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { NotificationsService } from './notifications.service';

// Hành vi trên DB thật (INSERT … ON CONFLICT, duyệt lô) được kiểm ở test/reminders.e2e-spec.ts.
const NOW = new Date('2026-10-05T09:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function loanRow(id: number, dueInDays: number) {
  return {
    id,
    userId: id * 10,
    dueAt: new Date(NOW.getTime() + dueInDays * DAY),
    copy: { book: { title: `Sách ${id}` } },
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  describe('notify', () => {
    it('inserts with skipDuplicates and reports whether a row was created', async () => {
      prisma.notification.createMany.mockResolvedValueOnce({ count: 1 });
      prisma.notification.createMany.mockResolvedValueOnce({ count: 0 });
      const n = {
        userId: 1,
        type: 'T',
        title: 't',
        body: 'b',
        dedupeKey: 'k',
      };

      expect(await service.notify(n)).toBe(true);
      expect(await service.notify(n)).toBe(false);
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [n],
        skipDuplicates: true,
      });
    });

    it('uses the caller transaction when given one', async () => {
      const tx = createPrismaMock();
      tx.notification.createMany.mockResolvedValue({ count: 1 });
      await service.notify(
        { userId: 1, type: 'T', title: 't', body: 'b' },
        tx as never,
      );
      expect(tx.notification.createMany).toHaveBeenCalled();
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('inbox', () => {
    it('listMine returns the newest items and the unread count', async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: 2 }, { id: 1 }]);
      prisma.notification.count.mockResolvedValue(1);
      expect(await service.listMine(7)).toEqual({
        items: [{ id: 2 }, { id: 1 }],
        unread: 1,
      });
      expect(prisma.notification.findMany.mock.calls[0][0]).toMatchObject({
        where: { userId: 7 },
        orderBy: { id: 'desc' },
        take: 30,
      });
    });

    it('markRead is idempotent for an own notification and 404s someone else’s', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });
      prisma.notification.findFirst.mockResolvedValueOnce({ id: 5 });
      expect(await service.markRead(7, 5)).toEqual({ ok: true });

      prisma.notification.findFirst.mockResolvedValueOnce(null);
      await expect(service.markRead(7, 6)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('markAllRead returns how many were unread', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });
      expect(await service.markAllRead(7)).toEqual({ updated: 3 });
    });
  });

  describe('sendLoanReminders', () => {
    it('walks batches by id cursor until a short batch, splitting overdue from due-soon', async () => {
      prisma.loan.findMany
        .mockResolvedValueOnce([loanRow(1, -3), loanRow(2, 1)]) // lô đầy
        .mockResolvedValueOnce([loanRow(3, -10)]); // lô ngắn → dừng
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.createMany.mockImplementation(
        async ({ data }: { data: unknown[] }) => ({ count: data.length }),
      );

      const result = await service.sendLoanReminders(NOW, 2);

      expect(result).toEqual({ dueSoon: 1, overdue: 2 });
      expect(prisma.loan.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.loan.findMany.mock.calls[0][0]).toMatchObject({
        take: 2,
        orderBy: { id: 'asc' },
      });
      expect(prisma.loan.findMany.mock.calls[0][0]).not.toHaveProperty(
        'cursor',
      );
      expect(prisma.loan.findMany.mock.calls[1][0]).toMatchObject({
        cursor: { id: 2 },
        skip: 1,
      });
      const keys = prisma.notification.createMany.mock.calls.flatMap(
        (c: [{ data: { dedupeKey: string }[] }]) =>
          c[0].data.map((d) => d.dedupeKey),
      );
      expect(keys.sort()).toEqual([
        'loan:1:overdue',
        'loan:2:due',
        'loan:3:overdue',
      ]);
    });

    it('skips loans that already have their reminder and writes nothing when all are sent', async () => {
      prisma.loan.findMany.mockResolvedValue([loanRow(1, -3), loanRow(2, 1)]);
      prisma.notification.findMany.mockResolvedValue([
        { dedupeKey: 'loan:1:overdue' },
        { dedupeKey: 'loan:2:due' },
      ]);

      expect(await service.sendLoanReminders(NOW)).toEqual({
        dueSoon: 0,
        overdue: 0,
      });
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('does nothing when no loan needs a reminder', async () => {
      prisma.loan.findMany.mockResolvedValue([]);
      expect(await service.sendLoanReminders(NOW)).toEqual({
        dueSoon: 0,
        overdue: 0,
      });
      expect(prisma.notification.findMany).not.toHaveBeenCalled();
    });
  });
});
