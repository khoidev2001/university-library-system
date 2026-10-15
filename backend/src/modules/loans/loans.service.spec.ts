import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CopyStatus,
  FineType,
  LoanStatus,
  MemberType,
  Role,
} from '@prisma/client';
import { overdueCutoff } from '../../common/date.util';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { AiClient } from '../ai/ai.client';
import { FinesService } from '../fines/fines.service';
import { PoliciesService } from '../policies/policies.service';
import { ReservationsService } from '../reservations/reservations.service';
import { LoansService } from './loans.service';

const NOW = new Date('2026-10-05T09:00:00.000Z');
const POLICY = {
  memberType: MemberType.STUDENT,
  maxBooks: 3,
  loanDays: 14,
  renewLimit: 1,
  renewExtraDays: 7,
  finePerDay: 5000,
};

const reader = {
  id: 7,
  role: Role.READER,
  isActive: true,
  memberType: MemberType.STUDENT,
  memberCode: 'SV001',
  fullName: 'SV',
};
const copy = {
  id: 20,
  barcode: 'LIB-1',
  status: CopyStatus.AVAILABLE,
  bookId: 3,
  book: { id: 3, title: 'T', price: 120000, categoryId: 2, coverUrl: null },
};

function loanRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 100,
    copyId: copy.id,
    userId: reader.id,
    status: LoanStatus.ACTIVE,
    borrowedAt: new Date('2026-09-21T09:00:00.000Z'),
    dueAt: new Date('2026-10-05T09:00:00.000Z'),
    returnedAt: null,
    renewedCount: 0,
    predictedOverdueRisk: null,
    copy,
    user: reader,
    fines: [],
    ...overrides,
  };
}

describe('LoansService', () => {
  let service: LoansService;
  let prisma: PrismaMock;
  const ai = { predictOverdue: jest.fn(), recommend: jest.fn() };
  const policies = { getFor: jest.fn() };
  // Hành vi thật của ReservationsService được kiểm ở test e2e trên DB thật.
  const reservations = {
    fulfillHeldCopy: jest.fn(),
    expireStale: jest.fn(),
    handleCopyReturned: jest.fn(async (tx: PrismaMock, copyId: number) =>
      tx.bookCopy.update({
        where: { id: copyId },
        data: { status: CopyStatus.AVAILABLE },
      }),
    ),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        LoansService,
        FinesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PoliciesService, useValue: policies },
        { provide: AiClient, useValue: ai },
        { provide: ReservationsService, useValue: reservations },
      ],
    }).compile();
    service = moduleRef.get(LoansService);
    jest.clearAllMocks();
    policies.getFor.mockResolvedValue(POLICY);
    ai.predictOverdue.mockResolvedValue(0.42);
  });

  /** Mặc định: mọi điều kiện BR-01…BR-05 đều hợp lệ. Từng test bẻ đúng một điều kiện. */
  function allowBorrow(): void {
    prisma.user.findUnique.mockResolvedValue(reader);
    prisma.bookCopy.findUnique.mockResolvedValue(copy);
    prisma.loan.count.mockResolvedValue(0);
    prisma.fine.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prisma.loan.create.mockImplementation(async ({ data }) =>
      loanRow({ ...data, id: 101 }),
    );
    prisma.bookCopy.updateMany.mockResolvedValue({ count: 1 });
    prisma.bookCopy.update.mockResolvedValue({
      ...copy,
      status: CopyStatus.BORROWED,
    });
  }

  /** Mô phỏng trả / báo mất: lần chốt trạng thái thắng, rồi đọc lại phiếu đã đóng. */
  function closeLoan(status: LoanStatus): void {
    prisma.loan.updateMany.mockResolvedValue({ count: 1 });
    prisma.loan.findUniqueOrThrow.mockImplementation(async () => ({
      ...(await (prisma.loan.findUnique.mock.results[0]
        .value as Promise<object>)),
      status,
      returnedAt: NOW,
    }));
  }

  describe('borrow', () => {
    it('creates an ACTIVE loan, sets dueAt from the policy and flips the copy to BORROWED', async () => {
      allowBorrow();
      const result = await service.borrow(
        { barcode: 'LIB-1', memberCode: 'SV001' },
        2,
        NOW,
      );

      const data = prisma.loan.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        copyId: copy.id,
        userId: reader.id,
        createdById: 2,
        predictedOverdueRisk: 0.42,
      });
      expect(data.dueAt).toEqual(new Date('2026-10-19T09:00:00.000Z')); // +14 ngày
      expect(prisma.bookCopy.updateMany).toHaveBeenCalledWith({
        where: { id: copy.id, status: CopyStatus.AVAILABLE },
        data: { status: CopyStatus.BORROWED },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.overdueRisk).toBe(0.42);
    });

    it('race: loses the copy to a concurrent borrow → COPY_NOT_AVAILABLE, no loan written', async () => {
      allowBorrow();
      prisma.bookCopy.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.borrow({ barcode: 'LIB-1', memberCode: 'SV001' }, 2, NOW),
      ).rejects.toMatchObject({ code: 'COPY_NOT_AVAILABLE' });
      expect(prisma.loan.create).not.toHaveBeenCalled();
    });

    it('race: re-counts active loans under the reader lock → LOAN_LIMIT_REACHED', async () => {
      allowBorrow();
      // 4 lần đếm đầu (ngoài transaction) thấy 0; lần đếm trong transaction đã thấy đủ 3 cuốn
      prisma.loan.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3);
      await expect(
        service.borrow({ barcode: 'LIB-1', memberCode: 'SV001' }, 2, NOW),
      ).rejects.toMatchObject({ code: 'LOAN_LIMIT_REACHED' });
      expect(prisma.$queryRaw).toHaveBeenCalled(); // SELECT … FOR UPDATE trên hàng bạn đọc
      expect(prisma.loan.create).not.toHaveBeenCalled();
    });

    it('borrowing a HELD copy fulfils the reservation first, then claims the copy by its HELD status', async () => {
      allowBorrow();
      prisma.bookCopy.findUnique.mockResolvedValue({
        ...copy,
        status: CopyStatus.HELD,
      });
      await service.borrow({ barcode: 'LIB-1', memberCode: 'SV001' }, 2, NOW);
      expect(reservations.expireStale).toHaveBeenCalledWith(NOW); // hạn giữ đã qua thì giải phóng trước
      expect(reservations.fulfillHeldCopy).toHaveBeenCalledWith(
        prisma,
        copy.id,
        reader.id,
      );
      expect(prisma.bookCopy.updateMany).toHaveBeenCalledWith({
        where: { id: copy.id, status: CopyStatus.HELD },
        data: { status: CopyStatus.BORROWED },
      });
    });

    it('uses the LECTURER policy for a lecturer (30 ngày)', async () => {
      allowBorrow();
      prisma.user.findUnique.mockResolvedValue({
        ...reader,
        memberType: MemberType.LECTURER,
      });
      policies.getFor.mockResolvedValue({
        ...POLICY,
        memberType: MemberType.LECTURER,
        maxBooks: 5,
        loanDays: 30,
      });

      await service.borrow({ barcode: 'LIB-1', memberCode: 'GV1' }, 2, NOW);

      expect(policies.getFor).toHaveBeenCalledWith(MemberType.LECTURER);
      expect(prisma.loan.create.mock.calls[0][0].data.dueAt).toEqual(
        new Date('2026-11-04T09:00:00.000Z'),
      );
    });

    it('still lends when the AI service is unavailable (risk = null)', async () => {
      allowBorrow();
      ai.predictOverdue.mockResolvedValue(null);
      const result = await service.borrow(
        { barcode: 'LIB-1', memberCode: 'SV001' },
        2,
        NOW,
      );
      expect(result.overdueRisk).toBeNull();
      expect(prisma.loan.create).toHaveBeenCalled();
    });

    it('BR-01: refuses a non-reader account', async () => {
      allowBorrow();
      prisma.user.findUnique.mockResolvedValue({
        ...reader,
        role: Role.LIBRARIAN,
      });
      await expect(
        service.borrow({ barcode: 'LIB-1', memberCode: 'L1' }, 2, NOW),
      ).rejects.toMatchObject({ code: 'NOT_A_READER' });
      expect(prisma.loan.create).not.toHaveBeenCalled();
    });

    it('BR-05: refuses a locked card and a copy that is not AVAILABLE', async () => {
      allowBorrow();
      prisma.user.findUnique.mockResolvedValue({ ...reader, isActive: false });
      await expect(
        service.borrow({ barcode: 'LIB-1', memberCode: 'SV001' }, 2, NOW),
      ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });

      allowBorrow();
      prisma.bookCopy.findUnique.mockResolvedValue({
        ...copy,
        status: CopyStatus.BORROWED,
      });
      await expect(
        service.borrow({ barcode: 'LIB-1', memberCode: 'SV001' }, 2, NOW),
      ).rejects.toMatchObject({ code: 'COPY_NOT_AVAILABLE' });
      expect(prisma.loan.create).not.toHaveBeenCalled();
    });

    it('BR-02: refuses when the reader already holds maxBooks', async () => {
      allowBorrow();
      prisma.loan.count.mockResolvedValueOnce(3); // activeLoans
      await expect(
        service.borrow({ barcode: 'LIB-1', memberCode: 'SV001' }, 2, NOW),
      ).rejects.toMatchObject({ code: 'LOAN_LIMIT_REACHED' });
    });

    it('BR-03: refuses when the reader has an overdue loan', async () => {
      allowBorrow();
      prisma.loan.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1); // active, overdue
      await expect(
        service.borrow({ barcode: 'LIB-1', memberCode: 'SV001' }, 2, NOW),
      ).rejects.toMatchObject({ code: 'HAS_OVERDUE_LOAN' });
    });

    it('BR-04: refuses when the reader owes an unpaid fine', async () => {
      allowBorrow();
      prisma.fine.aggregate.mockResolvedValue({ _sum: { amount: 15000 } });
      await expect(
        service.borrow({ barcode: 'LIB-1', memberCode: 'SV001' }, 2, NOW),
      ).rejects.toMatchObject({ code: 'UNPAID_FINE' });
      expect(prisma.loan.create).not.toHaveBeenCalled();
    });

    it('404s an unknown member code or barcode', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.borrow({ barcode: 'LIB-1', memberCode: 'NOPE' }, 2, NOW),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.user.findUnique.mockResolvedValue(reader);
      prisma.bookCopy.findUnique.mockResolvedValue(null);
      await expect(
        service.borrow({ barcode: 'NOPE', memberCode: 'SV001' }, 2, NOW),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('returnCopy', () => {
    it('on time: no fine, copy back to AVAILABLE', async () => {
      prisma.loan.findUnique.mockResolvedValue(
        loanRow({ dueAt: new Date('2026-10-10T09:00:00.000Z') }),
      );
      closeLoan(LoanStatus.RETURNED);

      const result = await service.returnCopy(100, NOW);

      expect(result.fine).toBeNull();
      expect(result.overdueDays).toBe(0);
      expect(prisma.fine.create).not.toHaveBeenCalled();
      expect(prisma.bookCopy.update).toHaveBeenCalledWith({
        where: { id: copy.id },
        data: { status: CopyStatus.AVAILABLE },
      });
      expect(prisma.loan.updateMany.mock.calls[0][0]).toMatchObject({
        where: { id: 100, status: LoanStatus.ACTIVE },
        data: { status: LoanStatus.RETURNED, returnedAt: NOW },
      });
    });

    it('race: a concurrent return already closed the loan → LOAN_NOT_ACTIVE, no fine, no second hold', async () => {
      prisma.loan.findUnique.mockResolvedValue(
        loanRow({ dueAt: new Date('2026-10-02T09:00:00.000Z') }),
      );
      prisma.loan.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.returnCopy(100, NOW)).rejects.toMatchObject({
        code: 'LOAN_NOT_ACTIVE',
      });
      expect(prisma.fine.create).not.toHaveBeenCalled();
      expect(reservations.handleCopyReturned).not.toHaveBeenCalled();
    });

    it('BR-07: 3 ngày trễ → phạt 15.000đ trong cùng transaction', async () => {
      prisma.loan.findUnique.mockResolvedValue(
        loanRow({ dueAt: new Date('2026-10-02T09:00:00.000Z') }),
      );
      closeLoan(LoanStatus.RETURNED);
      prisma.fine.create.mockImplementation(async ({ data }) => ({
        id: 1,
        ...data,
      }));

      const result = await service.returnCopy(100, NOW);

      expect(result.overdueDays).toBe(3);
      expect(result.fine).toMatchObject({
        type: FineType.OVERDUE,
        amount: 15000,
        loanId: 100,
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('trả muộn vài giờ trong chính ngày hết hạn thì không bị phạt (BR-07 theo ngày lịch)', async () => {
      prisma.loan.findUnique.mockResolvedValue(
        loanRow({ dueAt: new Date('2026-10-05T07:00:00.000Z') }),
      );
      closeLoan(LoanStatus.RETURNED);

      const result = await service.returnCopy(100, NOW);
      expect(result.overdueDays).toBe(0);
      expect(result.fine).toBeNull();
      expect(prisma.fine.create).not.toHaveBeenCalled();
    });

    it('sang ngày hôm sau là tính một ngày trễ', async () => {
      prisma.loan.findUnique.mockResolvedValue(
        loanRow({ dueAt: new Date('2026-10-04T16:00:00.000Z') }),
      );
      closeLoan(LoanStatus.RETURNED);
      prisma.fine.create.mockImplementation(async ({ data }) => ({
        id: 1,
        ...data,
      }));

      const result = await service.returnCopy(100, NOW);
      expect(result.overdueDays).toBe(1);
      expect(result.fine?.amount).toBe(5000);
    });

    it('refuses a loan that is not ACTIVE', async () => {
      prisma.loan.findUnique.mockResolvedValue(
        loanRow({ status: LoanStatus.RETURNED }),
      );
      await expect(service.returnCopy(100, NOW)).rejects.toMatchObject({
        code: 'LOAN_NOT_ACTIVE',
      });
    });
  });

  describe('renew', () => {
    it('BR-06: extends dueAt by renewExtraDays and counts the renewal', async () => {
      const active = loanRow({ dueAt: new Date('2026-10-10T09:00:00.000Z') });
      prisma.loan.findUnique
        .mockResolvedValueOnce(active)
        .mockResolvedValueOnce(
          loanRow({
            dueAt: new Date('2026-10-17T09:00:00.000Z'),
            renewedCount: 1,
          }),
        );
      prisma.fine.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.loan.updateMany.mockResolvedValue({ count: 1 });

      const view = await service.renew(100, reader.id, NOW);

      expect(prisma.loan.updateMany.mock.calls[0][0]).toMatchObject({
        where: { id: 100, status: LoanStatus.ACTIVE, renewedCount: 0 },
        data: {
          dueAt: new Date('2026-10-17T09:00:00.000Z'),
          renewedCount: { increment: 1 },
        },
      });
      expect(view.renewedCount).toBe(1);
    });

    it('race: a concurrent renew used the last renewal → RENEW_LIMIT_REACHED', async () => {
      prisma.loan.findUnique
        .mockResolvedValueOnce(
          loanRow({ dueAt: new Date('2026-10-10T09:00:00.000Z') }),
        )
        .mockResolvedValueOnce(
          loanRow({
            dueAt: new Date('2026-10-17T09:00:00.000Z'),
            renewedCount: 1,
          }),
        );
      prisma.fine.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.loan.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.renew(100, reader.id, NOW)).rejects.toMatchObject({
        code: 'RENEW_LIMIT_REACHED',
      });
    });

    it('BR-06: refuses an overdue loan, an exhausted renewal and an unpaid fine', async () => {
      prisma.fine.aggregate.mockResolvedValue({ _sum: { amount: null } });

      prisma.loan.findUnique.mockResolvedValue(
        loanRow({ dueAt: new Date('2026-10-01T09:00:00.000Z') }),
      );
      await expect(service.renew(100, reader.id, NOW)).rejects.toMatchObject({
        code: 'LOAN_OVERDUE_CANNOT_RENEW',
      });

      prisma.loan.findUnique.mockResolvedValue(
        loanRow({
          dueAt: new Date('2026-10-10T09:00:00.000Z'),
          renewedCount: 1,
        }),
      );
      await expect(service.renew(100, reader.id, NOW)).rejects.toMatchObject({
        code: 'RENEW_LIMIT_REACHED',
      });

      prisma.loan.findUnique.mockResolvedValue(
        loanRow({ dueAt: new Date('2026-10-10T09:00:00.000Z') }),
      );
      prisma.fine.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });
      await expect(service.renew(100, reader.id, NOW)).rejects.toMatchObject({
        code: 'UNPAID_FINE',
      });
      expect(prisma.loan.updateMany).not.toHaveBeenCalled();
    });

    it("refuses to renew someone else's loan", async () => {
      prisma.loan.findUnique.mockResolvedValue(
        loanRow({ dueAt: new Date('2026-10-10T09:00:00.000Z') }),
      );
      await expect(service.renew(100, 999, NOW)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reportLost', () => {
    it('BR-08: fine = giá bìa + phạt trễ; phiếu và bản sao → LOST', async () => {
      prisma.loan.findUnique.mockResolvedValue(
        loanRow({ dueAt: new Date('2026-10-03T09:00:00.000Z') }),
      );
      closeLoan(LoanStatus.LOST);
      prisma.fine.create.mockImplementation(async ({ data }) => ({
        id: 2,
        ...data,
      }));

      const result = await service.reportLost(100, NOW);

      expect(result.fine).toMatchObject({
        type: FineType.LOST,
        amount: 120000 + 2 * 5000,
      });
      expect(prisma.loan.updateMany.mock.calls[0][0]).toMatchObject({
        where: { id: 100, status: LoanStatus.ACTIVE },
        data: { status: LoanStatus.LOST },
      });
      expect(prisma.bookCopy.update).toHaveBeenCalledWith({
        where: { id: copy.id },
        data: { status: CopyStatus.LOST },
      });
    });
  });

  describe('findMany', () => {
    it('BR-09: lọc quá hạn = ACTIVE và dueAt < now, và gắn cờ dẫn xuất', async () => {
      prisma.loan.findMany.mockResolvedValue([
        loanRow({ dueAt: new Date('2026-10-01T09:00:00.000Z') }),
      ]);
      prisma.loan.count.mockResolvedValue(1);

      const page = await service.findMany(
        Object.assign(Object.create(Object.getPrototypeOf({})), {
          overdue: true,
          page: 1,
          limit: 20,
          skip: 0,
        }) as never,
        NOW,
      );

      expect(prisma.loan.findMany.mock.calls[0][0].where).toMatchObject({
        status: LoanStatus.ACTIVE,
        dueAt: { lt: overdueCutoff(NOW) },
      });
      expect(page.items[0]).toMatchObject({ isOverdue: true, overdueDays: 4 });
    });

    it('a returned loan is never overdue', async () => {
      prisma.loan.findMany.mockResolvedValue([
        loanRow({
          status: LoanStatus.RETURNED,
          dueAt: new Date('2026-10-01T09:00:00.000Z'),
          returnedAt: new Date('2026-10-02T09:00:00.000Z'),
        }),
      ]);
      prisma.loan.count.mockResolvedValue(1);
      const page = await service.findMany(
        { page: 1, limit: 20, skip: 0 } as never,
        NOW,
      );
      expect(page.items[0]).toMatchObject({ isOverdue: false, overdueDays: 0 });
    });
  });
});
