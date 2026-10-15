import { Injectable, NotFoundException } from '@nestjs/common';
import { Fine, FineType, LoanPolicy, Prisma } from '@prisma/client';
import { overdueDays } from '../../common/date.util';
import { Page, toPage } from '../../common/dto/pagination.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { INT4_MAX } from '../../common/pipes/parse-id.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryFinesDto } from './dto/fines.dto';

const fineInclude = {
  loan: {
    include: {
      copy: { include: { book: { select: { id: true, title: true } } } },
      user: { select: { id: true, fullName: true, memberCode: true } },
    },
  },
} satisfies Prisma.FineInclude;

export type FineRow = Prisma.FineGetPayload<{ include: typeof fineInclude }>;

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
    return { items, unpaidTotal: unpaid };
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
    return toPage(items, total, query);
  }

  /** FR-FINE-02: ghi nhận thủ thư đã thu tiền mặt; không thu lại khoản đã thu. */
  async pay(fineId: number, librarianId: number): Promise<FineRow> {
    const fine = await this.prisma.fine.findUnique({ where: { id: fineId } });
    if (!fine) throw new NotFoundException('Không tìm thấy khoản phạt');
    if (fine.paidAt)
      throw new BusinessException(
        'FINE_ALREADY_PAID',
        'Khoản phạt này đã được thanh toán',
      );
    // Chỉ ghi khi vẫn chưa thu: hai thủ thư bấm đồng thời thì một người thắng, người kia nhận FINE_ALREADY_PAID.
    const paid = await this.prisma.fine.updateMany({
      where: { id: fineId, paidAt: null },
      data: { paidAt: new Date(), paidToId: librarianId },
    });
    if (paid.count === 0)
      throw new BusinessException(
        'FINE_ALREADY_PAID',
        'Khoản phạt này đã được thanh toán',
      );
    return this.prisma.fine.findUniqueOrThrow({
      where: { id: fineId },
      include: fineInclude,
    });
  }
}
