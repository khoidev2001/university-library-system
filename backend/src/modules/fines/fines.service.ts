import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Fine,
  FineType,
  LoanPolicy,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { overdueDays } from '../../common/date.util';
import { Page, toPage } from '../../common/dto/pagination.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { INT4_MAX } from '../../common/pipes/parse-id.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { expireStalePayments } from '../payments/payment-expiry';
import { QueryFinesDto } from './dto/fines.dto';

const fineInclude = {
  loan: {
    include: {
      copy: { include: { book: { select: { id: true, title: true } } } },
      user: { select: { id: true, fullName: true, memberCode: true } },
    },
  },
  // Giao dịch VNPay đang giữ khoản phạt (chờ trả hoặc đã trả); giao dịch hỏng/hết hạn đã nhả (active = false)
  paymentLinks: {
    where: { active: true },
    include: {
      payment: {
        select: {
          id: true,
          txnRef: true,
          status: true,
          vnpTransactionNo: true,
          bankCode: true,
          paidAt: true,
          expiresAt: true,
        },
      },
    },
  },
} satisfies Prisma.FineInclude;

type FineWithLinks = Prisma.FineGetPayload<{ include: typeof fineInclude }>;

/** Thông tin giao dịch online gắn với khoản phạt (null nếu chưa từng qua cổng thanh toán). */
export interface FineOnlinePayment {
  id: number;
  txnRef: string;
  status: PaymentStatus;
  vnpTransactionNo: string | null;
  bankCode: string | null;
  paidAt: Date | null;
  expiresAt: Date;
}

export type FineRow = Omit<FineWithLinks, 'paymentLinks'> & {
  onlinePayment: FineOnlinePayment | null;
};

/** Gộp `paymentLinks` (tối đa 1 dòng nhờ chỉ mục duy nhất từng phần) thành `onlinePayment`. */
function toFineRow(row: FineWithLinks): FineRow {
  const { paymentLinks, ...fine } = row;
  return { ...fine, onlinePayment: paymentLinks[0]?.payment ?? null };
}

@Injectable()
export class FinesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * BR-07: phạt trễ = số ngày trễ (làm tròn lên) × fine_per_day của chính sách.
   * Hàm thuần — không chạm DB, để tính trước khi tạo phiếu phạt và để hiển thị ước tính.
   */
  calculateOverdue(
    loan: { dueAt: Date; returnedAt: Date | null },
    policy: Pick<LoanPolicy, 'finePerDay'>,
    at: Date = new Date(),
  ): number {
    return overdueDays(loan.dueAt, at) * policy.finePerDay;
  }

  /** BR-04: tổng tiền phạt chưa thanh toán của một bạn đọc. */
  async unpaidTotal(
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await tx.fine.aggregate({
      _sum: { amount: true },
      where: { paidAt: null, loan: { userId } },
    });
    return result._sum.amount ?? 0;
  }

  /** Tạo phiếu phạt trong cùng transaction với thao tác trả / báo mất. */
  createFine(
    tx: Prisma.TransactionClient,
    loanId: number,
    type: FineType,
    amount: number,
  ): Promise<Fine> {
    // Cột amount là INT4: kẹp trần để phiếu quá hạn rất lâu không làm tràn số (→ 500)
    return tx.fine.create({
      data: { loanId, type, amount: Math.min(amount, INT4_MAX) },
    });
  }

  async findMine(
    userId: number,
  ): Promise<{ items: FineRow[]; unpaidTotal: number }> {
    const [items, unpaid] = await Promise.all([
      this.prisma.fine.findMany({
        where: { loan: { userId } },
        include: fineInclude,
        orderBy: { createdAt: 'desc' },
      }),
      this.unpaidTotal(userId),
    ]);
    return { items: items.map(toFineRow), unpaidTotal: unpaid };
  }

  async findAll(query: QueryFinesDto): Promise<Page<FineRow>> {
    const where: Prisma.FineWhereInput = {
      ...(query.paid !== undefined &&
        (query.paid ? { paidAt: { not: null } } : { paidAt: null })),
      ...(query.userId && { loan: { userId: query.userId } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.fine.findMany({
        where,
        include: fineInclude,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.fine.count({ where }),
    ]);
    return toPage(items.map(toFineRow), total, query);
  }

  /**
   * FR-FINE-02: ghi nhận thủ thư đã thu tiền mặt; không thu lại khoản đã thu.
   *
   * Khoản phạt đang nằm trong giao dịch VNPay còn hiệu lực thì KHÔNG thu tiền mặt được
   * (FINE_PAYMENT_PENDING): bạn đọc có thể đang nhập OTP ở ngân hàng, thu tay lúc này dễ dẫn tới
   * thu hai lần. Muốn thu tại quầy, thủ thư huỷ giao dịch chờ (POST /payments/:id/cancel) hoặc đợi
   * nó hết hạn (15 phút); giao dịch quá hạn được nhả ngay tại đây.
   */
  async pay(fineId: number, librarianId: number): Promise<FineRow> {
    const fine = await this.prisma.fine.findUnique({ where: { id: fineId } });
    if (!fine) throw new NotFoundException('Không tìm thấy khoản phạt');
    if (fine.paidAt) throw this.alreadyPaid();
    await expireStalePayments(this.prisma, new Date(), { fineId });

    await this.prisma.$transaction(async (tx) => {
      // Khoá dòng phạt: tạo giao dịch VNPay cho cùng khoản phạt phải đợi, hoặc chúng ta đợi nó.
      // Các câu lệnh sau mỗi câu một snapshot mới nên thấy bản ghi nối vừa commit.
      await tx.$queryRaw`SELECT id FROM fines WHERE id = ${fineId} FOR UPDATE`;
      const holder = await tx.paymentFine.findFirst({
        where: { fineId, active: true },
        select: { payment: { select: { status: true, expiresAt: true } } },
      });
      if (holder?.payment.status === PaymentStatus.PENDING)
        throw new BusinessException(
          'FINE_PAYMENT_PENDING',
          'Khoản phạt đang chờ thanh toán trực tuyến qua VNPay. Hãy huỷ giao dịch chờ hoặc đợi giao dịch hết hạn rồi thu tiền mặt.',
        );
      // Chỉ ghi khi vẫn chưa thu: hai thủ thư bấm đồng thời thì một người thắng, người kia nhận FINE_ALREADY_PAID.
      const paid = await tx.fine.updateMany({
        where: { id: fineId, paidAt: null },
        data: { paidAt: new Date(), paidToId: librarianId },
      });
      if (paid.count === 0) throw this.alreadyPaid();
    });
    return toFineRow(
      await this.prisma.fine.findUniqueOrThrow({
        where: { id: fineId },
        include: fineInclude,
      }),
    );
  }

  private alreadyPaid(): BusinessException {
    return new BusinessException(
      'FINE_ALREADY_PAID',
      'Khoản phạt này đã được thanh toán',
    );
  }
}
