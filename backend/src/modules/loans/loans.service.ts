import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CopyStatus,
  Fine,
  FineType,
  LoanStatus,
  MemberType,
  Prisma,
  Role,
} from '@prisma/client';
import {
  addDays,
  isOverdue,
  overdueCutoff,
  overdueDays,
} from '../../common/date.util';
import { Page, toPage } from '../../common/dto/pagination.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AiClient } from '../ai/ai.client';
import { FinesService } from '../fines/fines.service';
import { PoliciesService } from '../policies/policies.service';
import { ReservationsService } from '../reservations/reservations.service';
import { BorrowDto, QueryLoansDto } from './dto/loans.dto';

const loanInclude = {
  copy: {
    include: {
      book: {
        select: {
          id: true,
          title: true,
          coverUrl: true,
          price: true,
          categoryId: true,
        },
      },
    },
  },
  user: {
    select: { id: true, fullName: true, memberCode: true, memberType: true },
  },
  fines: true,
} satisfies Prisma.LoanInclude;

export type LoanRow = Prisma.LoanGetPayload<{ include: typeof loanInclude }>;

/** Phiếu mượn kèm hai trường dẫn xuất (BR-09) — không lưu trong DB. */
export interface LoanView extends LoanRow {
  isOverdue: boolean;
  overdueDays: number;
}

export interface BorrowResult {
  loan: LoanView;
  overdueRisk: number | null;
}

export interface ReturnResult {
  loan: LoanView;
  fine: Fine | null;
  overdueDays: number;
}

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
    private readonly fines: FinesService,
    private readonly ai: AiClient,
    private readonly reservations: ReservationsService,
  ) {}

  /**
   * FR-LOAN-01: thủ thư cho mượn tại quầy bằng mã vạch + mã bạn đọc.
   * Kiểm BR-01…BR-05 trước, gọi AI (có fallback), rồi ghi trong MỘT transaction.
   */
  async borrow(
    dto: BorrowDto,
    librarianId: number,
    at: Date = new Date(),
  ): Promise<BorrowResult> {
    const reader = await this.prisma.user.findUnique({
      where: { memberCode: dto.memberCode },
    });
    if (!reader)
      throw new NotFoundException(
        `Không tìm thấy bạn đọc có mã ${dto.memberCode}`,
      );
    if (reader.role !== Role.READER)
      throw new BusinessException(
        'NOT_A_READER',
        'Tài khoản này không phải bạn đọc',
      );
    if (!reader.isActive)
      throw new BusinessException('ACCOUNT_LOCKED', 'Thẻ bạn đọc đang bị khoá');

    const findCopy = () =>
      this.prisma.bookCopy.findUnique({
        where: { barcode: dto.barcode },
        include: { book: true },
      });
    let copy = await findCopy();
    if (!copy)
      throw new NotFoundException(
        `Không tìm thấy bản sao có mã vạch ${dto.barcode}`,
      );
    // Bản sao HELD đã quá hạn nhận sách thì giải phóng ngay (cho người kế tiếp hoặc về kệ),
    // không đợi lượt quét định kỳ — instance miễn phí có thể đang ngủ nên lượt quét không chạy.
    if (copy.status === CopyStatus.HELD) {
      await this.reservations.expireStale(at);
      copy = (await findCopy()) ?? copy;
    }
    // HELD = đang giữ cho người đặt trước; chỉ đúng người đó mượn được (kiểm trong transaction).
    if (
      copy.status !== CopyStatus.AVAILABLE &&
      copy.status !== CopyStatus.HELD
    ) {
      throw new BusinessException(
        'COPY_NOT_AVAILABLE',
        `Bản sao đang ở trạng thái ${copy.status}`,
      );
    }

    const policy = await this.policies.getFor(
      reader.memberType ?? MemberType.STUDENT,
    );

    const activeLoans = await this.prisma.loan.count({
      where: { userId: reader.id, status: LoanStatus.ACTIVE },
    });
    if (activeLoans >= policy.maxBooks) {
      throw new BusinessException(
        'LOAN_LIMIT_REACHED',
        `Bạn đọc đã mượn tối đa ${policy.maxBooks} cuốn`,
      );
    }

    const overdueCount = await this.prisma.loan.count({
      where: {
        userId: reader.id,
        status: LoanStatus.ACTIVE,
        dueAt: { lt: overdueCutoff(at) },
      },
    });
    if (overdueCount > 0) {
      throw new BusinessException(
        'HAS_OVERDUE_LOAN',
        `Bạn đọc đang có ${overdueCount} cuốn quá hạn`,
      );
    }

    const unpaid = await this.fines.unpaidTotal(reader.id);
    if (unpaid > 0) {
      throw new BusinessException(
        'UNPAID_FINE',
        `Bạn đọc còn ${unpaid.toLocaleString('vi-VN')}đ phạt chưa thanh toán`,
      );
    }

    // FR-LOAN-02: AI chỉ là thông tin thêm — chậm/chết thì vẫn cho mượn.
    const [priorLoans, priorOverdue] = await Promise.all([
      this.prisma.loan.count({ where: { userId: reader.id } }),
      this.prisma.loan.count({
        where: {
          userId: reader.id,
          fines: { some: { type: FineType.OVERDUE } },
        },
      }),
    ]);
    const overdueRisk = await this.ai.predictOverdue({
      memberType: reader.memberType ?? MemberType.STUDENT,
      priorLoans,
      priorOverdue,
      activeLoans,
      categoryId: copy.book.categoryId,
      loanDays: policy.loanDays,
      month: at.getMonth() + 1,
    });

    // BR-10: hạn trả chụp theo chính sách tại thời điểm mượn.
    const loan = await this.prisma.$transaction(async (tx) => {
      // Các kiểm tra ở trên đọc ngoài transaction nên hai yêu cầu đồng thời cùng qua được.
      // Khoá hàng bạn đọc để các lần mượn của cùng một người xếp hàng, rồi đếm lại hạn mức.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${reader.id} FOR UPDATE`;
      const activeNow = await tx.loan.count({
        where: { userId: reader.id, status: LoanStatus.ACTIVE },
      });
      if (activeNow >= policy.maxBooks) {
        throw new BusinessException(
          'LOAN_LIMIT_REACHED',
          `Bạn đọc đã mượn tối đa ${policy.maxBooks} cuốn`,
        );
      }
      // Bản sao HELD: đánh dấu đặt trước đã nhận (khoá hàng đặt trước TRƯỚC hàng bản sao,
      // cùng thứ tự với huỷ / hết hạn để không bế tắc).
      if (copy.status === CopyStatus.HELD) {
        await this.reservations.fulfillHeldCopy(tx, copy.id, reader.id);
      }
      // Chiếm bản sao nguyên tử: chỉ một yêu cầu đổi được trạng thái từ giá trị đã đọc.
      const claimed = await tx.bookCopy.updateMany({
        where: { id: copy.id, status: copy.status },
        data: { status: CopyStatus.BORROWED },
      });
      if (claimed.count === 0) {
        throw new BusinessException(
          'COPY_NOT_AVAILABLE',
          'Bản sao vừa được người khác mượn',
        );
      }
      return tx.loan.create({
        data: {
          copyId: copy.id,
          userId: reader.id,
          createdById: librarianId,
          borrowedAt: at,
          dueAt: addDays(at, policy.loanDays),
          predictedOverdueRisk: overdueRisk,
        },
        include: loanInclude,
      });
    });

    return { loan: this.toView(loan, at), overdueRisk };
  }

  /** FR-LOAN-03: nhận trả, tự tính phạt trễ (BR-07), bản sao về AVAILABLE. */
  async returnCopy(
    loanId: number,
    at: Date = new Date(),
  ): Promise<ReturnResult> {
    const loan = await this.getActiveOrThrow(loanId);
    const policy = await this.policies.getFor(
      loan.user.memberType ?? MemberType.STUDENT,
    );
    const days = overdueDays(loan.dueAt, at);
    const amount = days * policy.finePerDay;

    const result = await this.prisma.$transaction(async (tx) => {
      // Chốt trạng thái nguyên tử: trả đồng thời chỉ một yêu cầu thắng, không tạo phạt / giữ sách hai lần.
      await this.claimActive(tx, loanId, LoanStatus.RETURNED, at);
      const updated = await tx.loan.findUniqueOrThrow({
        where: { id: loanId },
        include: loanInclude,
      });
      // Có người đặt trước thì bản sao chuyển sang HELD, không thì về AVAILABLE.
      await this.reservations.handleCopyReturned(
        tx,
        loan.copyId,
        loan.copy.bookId,
        at,
      );
      const fine =
        amount > 0
          ? await this.fines.createFine(tx, loanId, FineType.OVERDUE, amount)
          : null;
      return { updated, fine };
    });

    return {
      loan: this.toView(result.updated, at),
      fine: result.fine,
      overdueDays: days,
    };
  }

  /** FR-LOAN-04, BR-06: bạn đọc tự gia hạn phiếu của chính mình. */
  async renew(
    loanId: number,
    userId: number,
    at: Date = new Date(),
  ): Promise<LoanView> {
    const loan = await this.getActiveOrThrow(loanId);
    if (loan.userId !== userId)
      throw new NotFoundException('Không tìm thấy phiếu mượn của bạn');

    const policy = await this.policies.getFor(
      loan.user.memberType ?? MemberType.STUDENT,
    );
    if (isOverdue(loan, at)) {
      throw new BusinessException(
        'LOAN_OVERDUE_CANNOT_RENEW',
        'Phiếu đã quá hạn, vui lòng trả sách tại quầy',
      );
    }
    if (loan.renewedCount >= policy.renewLimit) {
      throw new BusinessException(
        'RENEW_LIMIT_REACHED',
        `Mỗi phiếu chỉ được gia hạn ${policy.renewLimit} lần`,
      );
    }
    const unpaid = await this.fines.unpaidTotal(userId);
    if (unpaid > 0) {
      throw new BusinessException(
        'UNPAID_FINE',
        `Bạn còn ${unpaid.toLocaleString('vi-VN')}đ phạt chưa thanh toán`,
      );
    }

    // Gia hạn đồng thời: chỉ thành công nếu phiếu còn nguyên như vừa đọc (số lần gia hạn không đổi).
    const renewed = await this.prisma.loan.updateMany({
      where: {
        id: loanId,
        status: LoanStatus.ACTIVE,
        renewedCount: loan.renewedCount,
      },
      data: {
        dueAt: addDays(loan.dueAt, policy.renewExtraDays),
        renewedCount: { increment: 1 },
      },
    });
    if (renewed.count === 0) {
      // Có yêu cầu khác vừa đổi phiếu: đọc lại để báo đúng lý do.
      const fresh = await this.getActiveOrThrow(loanId);
      if (fresh.renewedCount >= policy.renewLimit) {
        throw new BusinessException(
          'RENEW_LIMIT_REACHED',
          `Mỗi phiếu chỉ được gia hạn ${policy.renewLimit} lần`,
        );
      }
      throw new BusinessException(
        'LOAN_CHANGED',
        'Phiếu mượn vừa thay đổi, vui lòng thử lại',
      );
    }
    return this.findOne(loanId, at);
  }

  /** FR-LOAN-06, BR-08: báo mất — phạt = giá bìa + phạt trễ tính đến ngày báo. */
  async reportLost(
    loanId: number,
    at: Date = new Date(),
  ): Promise<{ loan: LoanView; fine: Fine }> {
    const loan = await this.getActiveOrThrow(loanId);
    const policy = await this.policies.getFor(
      loan.user.memberType ?? MemberType.STUDENT,
    );
    const amount =
      loan.copy.book.price + overdueDays(loan.dueAt, at) * policy.finePerDay;

    const result = await this.prisma.$transaction(async (tx) => {
      await this.claimActive(tx, loanId, LoanStatus.LOST, at);
      const updated = await tx.loan.findUniqueOrThrow({
        where: { id: loanId },
        include: loanInclude,
      });
      await tx.bookCopy.update({
        where: { id: loan.copyId },
        data: { status: CopyStatus.LOST },
      });
      const fine = await this.fines.createFine(
        tx,
        loanId,
        FineType.LOST,
        amount,
      );
      return { updated, fine };
    });

    return { loan: this.toView(result.updated, at), fine: result.fine };
  }

  /** FR-LOAN-05: bạn đọc xem phiếu của mình. */
  async findMine(
    userId: number,
    query: QueryLoansDto,
    at: Date = new Date(),
  ): Promise<Page<LoanView>> {
    return this.findMany(
      Object.assign(Object.create(Object.getPrototypeOf(query)), query, {
        userId,
      }),
      at,
    );
  }

  /** FR-LOAN-07: thủ thư tra cứu phiếu, lọc trạng thái và quá hạn. */
  async findMany(
    query: QueryLoansDto,
    at: Date = new Date(),
  ): Promise<Page<LoanView>> {
    const where: Prisma.LoanWhereInput = {
      userId: query.userId,
      status: query.status,
      ...(query.overdue && {
        status: LoanStatus.ACTIVE,
        dueAt: { lt: overdueCutoff(at) },
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.loan.findMany({
        where,
        include: loanInclude,
        orderBy: { id: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.loan.count({ where }),
    ]);
    return toPage(
      rows.map((r) => this.toView(r, at)),
      total,
      query,
    );
  }

  async findOne(id: number, at: Date = new Date()): Promise<LoanView> {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: loanInclude,
    });
    if (!loan) throw new NotFoundException('Không tìm thấy phiếu mượn');
    return this.toView(loan, at);
  }

  /** Đóng phiếu ACTIVE → RETURNED / LOST; không còn ACTIVE (đã xử lý trước đó) thì ném LOAN_NOT_ACTIVE. */
  private async claimActive(
    tx: Prisma.TransactionClient,
    loanId: number,
    status: 'RETURNED' | 'LOST',
    at: Date,
  ): Promise<void> {
    const claimed = await tx.loan.updateMany({
      where: { id: loanId, status: LoanStatus.ACTIVE },
      data: { status, returnedAt: at },
    });
    if (claimed.count === 0) {
      throw new BusinessException(
        'LOAN_NOT_ACTIVE',
        'Phiếu mượn đã được xử lý (trả / báo mất) trước đó',
      );
    }
  }

  private async getActiveOrThrow(loanId: number): Promise<LoanRow> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: loanInclude,
    });
    if (!loan) throw new NotFoundException('Không tìm thấy phiếu mượn');
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BusinessException(
        'LOAN_NOT_ACTIVE',
        `Phiếu mượn đang ở trạng thái ${loan.status}`,
      );
    }
    return loan;
  }

  private toView(loan: LoanRow, at: Date): LoanView {
    return {
      ...loan,
      isOverdue: isOverdue(loan, at),
      overdueDays: loan.returnedAt ? 0 : overdueDays(loan.dueAt, at),
    };
  }
}
