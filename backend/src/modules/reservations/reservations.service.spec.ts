import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CopyStatus, ReservationStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { FinesService } from '../fines/fines.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  HOLD_DAYS,
  MAX_ACTIVE_RESERVATIONS,
  ReservationsService,
} from './reservations.service';

// Khoá hàng, SKIP LOCKED và tranh chấp thật được kiểm ở test/concurrency.e2e-spec.ts trên Postgres thật;
// ở đây kiểm các nhánh quyết định bằng mock.
const NOW = new Date('2026-10-05T09:00:00.000Z');
const reader = { id: 7, role: Role.READER, isActive: true };
const copies = (...status: CopyStatus[]) => status.map((s) => ({ status: s }));
const bookWith = (...status: CopyStatus[]) => ({
  id: 3,
  title: 'Sách',
  copies: copies(...status),
});

describe('ReservationsService', () => {
  let service: ReservationsService;
  let prisma: PrismaMock;
  const notifications = { notify: jest.fn() };
  const fines = { unpaidTotal: jest.fn() };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: FinesService, useValue: fines },
      ],
    }).compile();
    service = moduleRef.get(ReservationsService);
    jest.clearAllMocks();
    prisma.reservation.findMany.mockResolvedValue([]); // expireStale: không có gì quá hạn
    fines.unpaidTotal.mockResolvedValue(0);
    prisma.loan.count.mockResolvedValue(0);
  });

  describe('create', () => {
    function allowCreate(...status: CopyStatus[]) {
      prisma.user.findUnique.mockResolvedValue(reader);
      prisma.book.findUnique.mockResolvedValue(
        bookWith(...(status.length ? status : [CopyStatus.BORROWED])),
      );
      prisma.reservation.create.mockImplementation(async ({ data }) => ({
        id: 50,
        ...data,
      }));
    }

    it('locks the reader row, then checks and writes in one transaction', async () => {
      allowCreate();
      const res = await service.create(7, 3);
      expect(res).toMatchObject({ id: 50, userId: 7, bookId: 3 });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).toHaveBeenCalled(); // SELECT … FOR UPDATE
      expect(fines.unpaidTotal).toHaveBeenCalledWith(7, prisma);
    });

    it('rejects staff accounts, locked cards and unknown books', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...reader, role: Role.ADMIN });
      prisma.book.findUnique.mockResolvedValue(bookWith(CopyStatus.BORROWED));
      await expect(service.create(7, 3)).rejects.toMatchObject({
        code: 'NOT_A_READER',
      });

      prisma.user.findUnique.mockResolvedValue({ ...reader, isActive: false });
      await expect(service.create(7, 3)).rejects.toMatchObject({
        code: 'ACCOUNT_LOCKED',
      });

      prisma.user.findUnique.mockResolvedValue(reader);
      prisma.book.findUnique.mockResolvedValue(null);
      await expect(service.create(7, 3)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('NO_COPIES when every copy is lost / in maintenance; BOOK_AVAILABLE when one is on the shelf', async () => {
      allowCreate(CopyStatus.LOST, CopyStatus.MAINTENANCE);
      await expect(service.create(7, 3)).rejects.toMatchObject({
        code: 'NO_COPIES',
      });

      allowCreate(CopyStatus.BORROWED, CopyStatus.AVAILABLE);
      await expect(service.create(7, 3)).rejects.toMatchObject({
        code: 'BOOK_AVAILABLE',
      });
    });

    it('ALREADY_BORROWING, ALREADY_RESERVED, RESERVATION_LIMIT and UNPAID_FINE', async () => {
      allowCreate();
      prisma.loan.count.mockResolvedValueOnce(1);
      await expect(service.create(7, 3)).rejects.toMatchObject({
        code: 'ALREADY_BORROWING',
      });

      prisma.reservation.findMany
        .mockResolvedValueOnce([]) // expireStale
        .mockResolvedValueOnce([{ bookId: 3 }]);
      await expect(service.create(7, 3)).rejects.toMatchObject({
        code: 'ALREADY_RESERVED',
      });

      prisma.reservation.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(
          Array.from({ length: MAX_ACTIVE_RESERVATIONS }, (_, i) => ({
            bookId: 100 + i,
          })),
        );
      await expect(service.create(7, 3)).rejects.toMatchObject({
        code: 'RESERVATION_LIMIT',
      });

      fines.unpaidTotal.mockResolvedValue(5000);
      await expect(service.create(7, 3)).rejects.toMatchObject({
        code: 'UNPAID_FINE',
      });
      expect(prisma.reservation.create).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('404s a missing reservation and one that belongs to someone else (for a reader)', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);
      await expect(service.cancel(1, 7, Role.READER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      prisma.reservation.findUnique.mockResolvedValue({
        id: 1,
        userId: 99,
        status: ReservationStatus.WAITING,
      });
      await expect(service.cancel(1, 7, Role.READER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuses a reservation that is no longer active', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        status: ReservationStatus.CANCELLED,
      });
      await expect(service.cancel(1, 7, Role.READER)).rejects.toMatchObject({
        code: 'RESERVATION_NOT_ACTIVE',
      });
    });

    it('cancelling a READY reservation hands its copy to the next in line (or back to the shelf)', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 1,
        userId: 7,
        bookId: 3,
        copyId: 20,
        status: ReservationStatus.READY,
      });
      prisma.reservation.update.mockResolvedValue({ id: 1 });
      prisma.$queryRaw.mockResolvedValue([]); // không còn ai chờ
      await service.cancel(1, 2, Role.LIBRARIAN); // thủ thư huỷ hộ người khác
      expect(prisma.bookCopy.update).toHaveBeenCalledWith({
        where: { id: 20 },
        data: { status: CopyStatus.AVAILABLE },
      });
    });
  });

  describe('handleCopyReturned', () => {
    it('no one waiting → the copy goes back to AVAILABLE', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await service.handleCopyReturned(prisma as never, 20, 3, NOW);
      expect(prisma.bookCopy.update).toHaveBeenCalledWith({
        where: { id: 20 },
        data: { status: CopyStatus.AVAILABLE },
      });
      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('first in line → copy HELD, reservation READY with an expiry, reader notified once', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 5 }]);
      prisma.reservation.findUnique.mockResolvedValue({
        id: 5,
        userId: 8,
        book: { title: 'Sách' },
      });
      await service.handleCopyReturned(prisma as never, 20, 3, NOW);

      expect(prisma.bookCopy.update).toHaveBeenCalledWith({
        where: { id: 20 },
        data: { status: CopyStatus.HELD },
      });
      const upd = prisma.reservation.update.mock.calls[0][0];
      expect(upd.data).toMatchObject({
        status: ReservationStatus.READY,
        copyId: 20,
        readyAt: NOW,
      });
      expect(upd.data.expiresAt.getTime()).toBe(
        NOW.getTime() + HOLD_DAYS * 24 * 60 * 60 * 1000,
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 8,
          type: 'RESERVATION_READY',
          dedupeKey: 'reservation:5:ready',
        }),
        prisma,
      );
    });
  });

  describe('fulfillHeldCopy', () => {
    it('marks the owner’s READY reservation FULFILLED with a conditional update', async () => {
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
      await service.fulfillHeldCopy(prisma as never, 20, 7);
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith({
        where: { copyId: 20, userId: 7, status: ReservationStatus.READY },
        data: { status: ReservationStatus.FULFILLED },
      });
    });

    it('COPY_HELD when the copy is held for someone else or the hold was already used', async () => {
      prisma.reservation.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.fulfillHeldCopy(prisma as never, 20, 7),
      ).rejects.toMatchObject({ code: 'COPY_HELD' });
    });
  });

  describe('expireStale', () => {
    it('expires overdue holds, notifies the reader and releases the copy', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        { id: 9, userId: 7, bookId: 3, copyId: 20 },
      ]);
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
      prisma.$queryRaw.mockResolvedValue([]);

      expect(await service.expireStale(NOW)).toBe(1);
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith({
        where: { id: 9, status: ReservationStatus.READY },
        data: { status: ReservationStatus.EXPIRED },
      });
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RESERVATION_EXPIRED',
          dedupeKey: 'reservation:9:expired',
        }),
        prisma,
      );
      expect(prisma.bookCopy.update).toHaveBeenCalledWith({
        where: { id: 20 },
        data: { status: CopyStatus.AVAILABLE },
      });
    });

    it('does not touch a hold that another request already expired or used', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        { id: 9, userId: 7, bookId: 3, copyId: 20 },
      ]);
      prisma.reservation.updateMany.mockResolvedValue({ count: 0 });
      await service.expireStale(NOW);
      expect(notifications.notify).not.toHaveBeenCalled();
      expect(prisma.bookCopy.update).not.toHaveBeenCalled();
    });
  });

  describe('queues', () => {
    it('findMine adds the queue position for WAITING reservations only', async () => {
      prisma.reservation.findMany
        .mockResolvedValueOnce([]) // expireStale
        .mockResolvedValueOnce([
          { id: 12, bookId: 3, status: ReservationStatus.WAITING },
          { id: 13, bookId: 4, status: ReservationStatus.READY },
        ]);
      prisma.reservation.count.mockResolvedValue(2);

      const rows = await service.findMine(7);

      expect(rows.map((r) => r.queuePosition)).toEqual([2, 0]);
      expect(prisma.reservation.count).toHaveBeenCalledTimes(1);
    });

    it('findMany pages the staff queue and waitingCount counts WAITING', async () => {
      prisma.reservation.findMany
        .mockResolvedValueOnce([]) // expireStale
        .mockResolvedValueOnce([{ id: 1 }]);
      prisma.reservation.count.mockResolvedValue(1);
      const page = await service.findMany({
        page: 1,
        limit: 20,
        skip: 0,
      } as never);
      expect(page).toMatchObject({ items: [{ id: 1 }], total: 1 });

      prisma.reservation.count.mockResolvedValue(4);
      expect(await service.waitingCount(3)).toBe(4);
    });
  });
});
