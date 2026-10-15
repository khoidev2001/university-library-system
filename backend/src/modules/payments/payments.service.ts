import {
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import { hasRole } from '../../common/guards/roles.guard';
import { Page, PaginationDto, toPage } from '../../common/dto/pagination.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/payments.dto';
import { expireStalePayments, PAYMENT_TTL_MINUTES } from './payment-expiry';
import { readVnpayConfig } from './vnpay.config';
import {
  buildPaymentUrl,
  orderInfoFor,
  parseVnpDate,
  verifyVnpParams,
} from './vnpay.util';

/** VNPay không nhận giao dịch dưới 5.000đ; `vnp_Amount` (×100) tối đa 12 chữ số. */
export const MIN_PAYMENT_AMOUNT = 5_000;
export const MAX_PAYMENT_AMOUNT = 999_999_999;

const paymentInclude = {
  user: { select: { id: true, fullName: true, memberCode: true } },
  fines: {
    orderBy: { fineId: 'asc' },
    include: {
      fine: {
        select: {
          id: true,
          type: true,
          amount: true,
          loan: {
            select: {
              id: true,
              copy: { select: { book: { select: { id: true, title: true } } } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PaymentInclude;

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

export interface PaymentView {
  id: number;
  txnRef: string;
  amount: number;
  status: PaymentStatus;
  vnpTransactionNo: string | null;
  bankCode: string | null;
  responseCode: string | null;
  /** Tiền đã về sau khi khoản phạt được thu cách khác: cần thủ thư hoàn tiền thủ công. */
  needsRefund: boolean;
  createdAt: Date;
  paidAt: Date | null;
  expiresAt: Date;
  user: { id: number; fullName: string; memberCode: string | null };
  fines: {
    id: number;
    type: string;
    amount: number;
    loanId: number;
    bookTitle: string;
  }[];
}

export interface CreatedPayment {
  paymentUrl: string;
  paymentId: number;
  txnRef: string;
  amount: number;
  expiresAt: Date;
}

export interface IpnResponse {
  RspCode: string;
  Message: string;
}

export type SettleOutcome =
  | 'NOT_FOUND'
  | 'BAD_AMOUNT'
  | 'ALREADY_PROCESSED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUND_REQUIRED';

export interface Settlement {
  outcome: SettleOutcome;
  paymentId?: number;
}

const REFUND_NOTE = 'REFUND_REQUIRED';

/** Chỉ giữ tham số dạng chuỗi; `a=1&a=2` (mảng) hay `a[x]=1` (object) bị bỏ nên làm chữ ký sai. */
export function onlyStringParams(query: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof query !== 'object' || query === null) return out;
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function randomTxnRef(): string {
  return `ULS${randomBytes(8).toString('hex').toUpperCase()}`;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- tạo giao dịch

  /**
   * Tạo giao dịch PENDING cho các khoản phạt của chính bạn đọc và trả URL sang VNPay.
   * Số tiền = tổng amount đọc từ DB trong transaction, KHÔNG nhận từ client. Khoá dòng phạt
   * (FOR UPDATE) rồi mới kiểm tra chưa trả / chưa nằm trong giao dịch khác; chỉ mục duy nhất từng
   * phần trên payment_fines là chốt cuối nếu có đường ghi nào lọt qua.
   */
  async create(
    userId: number,
    dto: CreatePaymentDto,
    ipAddr: string,
    now: Date = new Date(),
  ): Promise<CreatedPayment> {
    const config = readVnpayConfig();
    if (!config)
      throw new BusinessException(
        'PAYMENT_NOT_CONFIGURED',
        'Thanh toán trực tuyến chưa được cấu hình. Vui lòng nộp phạt tại quầy thủ thư.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );

    // Giao dịch quá hạn của bạn đọc này nhả khoản phạt trước khi xét chúng
    await expireStalePayments(this.prisma, now, { userId });

    const explicit = dto.fineIds ? [...new Set(dto.fineIds)] : null;
    const candidateIds =
      explicit ??
      (
        await this.prisma.fine.findMany({
          where: { paidAt: null, loan: { userId } },
          select: { id: true },
        })
      ).map((f) => f.id);
    if (candidateIds.length === 0) throw this.noUnpaidFines();

    const txnRef = randomTxnRef();
    const expiresAt = new Date(now.getTime() + PAYMENT_TTL_MINUTES * 60_000);

    let payment: PaymentRow;
    try {
      payment = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          {
            id: number;
            amount: number;
            paid_at: Date | null;
            user_id: number;
          }[]
        >`SELECT f.id, f.amount, f.paid_at, l.user_id
            FROM fines f JOIN loans l ON l.id = f.loan_id
           WHERE f.id IN (${Prisma.join(candidateIds)})
           ORDER BY f.id
             FOR UPDATE OF f`;
        const byId = new Map(rows.map((r) => [r.id, r]));
        // Khoản phạt của người khác hay không tồn tại đều báo 404, không lộ sự tồn tại
        if (explicit && explicit.some((id) => byId.get(id)?.user_id !== userId))
          throw new NotFoundException('Không tìm thấy khoản phạt');

        const links = await tx.paymentFine.findMany({
          where: { fineId: { in: candidateIds }, active: true },
          select: { fineId: true },
        });
        const held = new Set(links.map((l) => l.fineId));

        let usable = rows.filter((r) => r.user_id === userId);
        if (explicit) {
          if (usable.some((r) => r.paid_at))
            throw new BusinessException(
              'FINE_ALREADY_PAID',
              'Có khoản phạt đã được thanh toán',
            );
          if (usable.some((r) => held.has(r.id))) throw this.pendingExists();
        } else {
          usable = usable.filter((r) => !r.paid_at && !held.has(r.id));
          if (usable.length === 0)
            throw held.size > 0 ? this.pendingExists() : this.noUnpaidFines();
        }

        const amount = usable.reduce((sum, r) => sum + r.amount, 0);
        if (amount < MIN_PAYMENT_AMOUNT)
          throw new BusinessException(
            'PAYMENT_AMOUNT_TOO_SMALL',
            `VNPay yêu cầu tối thiểu ${MIN_PAYMENT_AMOUNT.toLocaleString('vi-VN')}đ mỗi giao dịch. Hãy chọn thêm khoản phạt hoặc nộp tại quầy.`,
          );
        if (amount > MAX_PAYMENT_AMOUNT)
          throw new BusinessException(
            'PAYMENT_AMOUNT_TOO_LARGE',
            'Số tiền vượt hạn mức một giao dịch. Hãy chọn bớt khoản phạt hoặc nộp tại quầy.',
          );

        return tx.payment.create({
          data: {
            userId,
            txnRef,
            amount,
            createdAt: now,
            expiresAt,
            fines: { create: usable.map((r) => ({ fineId: r.id })) },
          },
          include: paymentInclude,
        });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Chốt cuối: chỉ mục duy nhất từng phần bắt được ca đua hiếm gặp
        throw this.pendingExists();
      }
      throw err;
    }

    const paymentUrl = buildPaymentUrl({
      payUrl: config.payUrl,
      tmnCode: config.tmnCode,
      hashSecret: config.hashSecret,
      returnUrl: config.returnUrl,
      txnRef: payment.txnRef,
      amount: payment.amount,
      orderInfo: orderInfoFor(payment.txnRef),
      ipAddr,
      createdAt: payment.createdAt,
      expiresAt: payment.expiresAt,
    });
    this.logger.log(
      `Tạo giao dịch ${payment.txnRef}: ${payment.amount}đ, ${payment.fines.length} khoản phạt, user ${userId}`,
    );
    return {
      paymentUrl,
      paymentId: payment.id,
      txnRef: payment.txnRef,
      amount: payment.amount,
      expiresAt: payment.expiresAt,
    };
  }

  // ---------------------------------------------------------------- truy vấn

  async findMine(
    userId: number,
    query: PaginationDto,
  ): Promise<Page<PaymentView>> {
    await expireStalePayments(this.prisma, new Date(), { userId });
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: { userId },
        include: paymentInclude,
        orderBy: { id: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);
    return toPage(items.map(toView), total, query);
  }

  /** Bạn đọc chỉ xem giao dịch của mình; thủ thư xem mọi giao dịch. Người khác nhận 404. */
  async findOne(id: number, user: JwtUser): Promise<PaymentView> {
    await expireStalePayments(this.prisma, new Date(), { paymentId: id });
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: paymentInclude,
    });
    if (
      !payment ||
      (payment.userId !== user.id && !hasRole(user.role, [Role.LIBRARIAN]))
    )
      throw new NotFoundException('Không tìm thấy giao dịch');
    return toView(payment);
  }

  /**
   * Huỷ giao dịch đang chờ (chủ giao dịch hoặc thủ thư) để chọn lại khoản phạt hoặc thu tiền mặt.
   * Nếu bạn đọc vẫn lỡ trả bên VNPay, IPN muộn được xử lý ở settle(): nhận tiền nếu khoản phạt
   * còn trống, ngược lại đánh dấu cần hoàn tiền.
   */
  async cancel(id: number, user: JwtUser): Promise<PaymentView> {
    const found = await this.prisma.payment.findUnique({ where: { id } });
    if (
      !found ||
      (found.userId !== user.id && !hasRole(user.role, [Role.LIBRARIAN]))
    )
      throw new NotFoundException('Không tìm thấy giao dịch');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${id} FOR UPDATE`;
      const current = await tx.payment.findUniqueOrThrow({ where: { id } });
      if (current.status !== PaymentStatus.PENDING)
        throw new BusinessException(
          'PAYMENT_NOT_PENDING',
          'Giao dịch này không còn ở trạng thái chờ thanh toán',
        );
      await tx.payment.update({
        where: { id },
        data: { status: PaymentStatus.CANCELLED },
      });
      await tx.paymentFine.updateMany({
        where: { paymentId: id },
        data: { active: false },
      });
    });
    return this.findOne(id, user);
  }

  /** Cho bộ lập lịch: nhả khoản phạt của giao dịch quá hạn. */
  expireStale(at: Date = new Date()): Promise<number> {
    return expireStalePayments(this.prisma, at);
  }

  // ---------------------------------------------------------------- VNPay trả về

  /** IPN (máy chủ VNPay gọi): nguồn xác nhận chính thức. Luôn trả JSON {RspCode, Message}. */
  async handleIpn(query: unknown): Promise<IpnResponse> {
    const config = readVnpayConfig();
    if (!config) return { RspCode: '99', Message: 'Unknown error' };
    const params = onlyStringParams(query);
    if (!verifyVnpParams(params, config.hashSecret))
      return { RspCode: '97', Message: 'Invalid signature' };
    try {
      const result = await this.settle(params);
      switch (result.outcome) {
        case 'NOT_FOUND':
          return { RspCode: '01', Message: 'Order not found' };
        case 'BAD_AMOUNT':
          return { RspCode: '04', Message: 'Invalid amount' };
        case 'ALREADY_PROCESSED':
          return { RspCode: '02', Message: 'Order already confirmed' };
        default:
          return { RspCode: '00', Message: 'Confirm Success' };
      }
    } catch (err) {
      this.logger.error('IPN VNPay lỗi', err as Error);
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }

  /**
   * Trình duyệt bạn đọc quay về từ VNPay. Địa chỉ chuyển hướng luôn nằm dưới APP_PUBLIC_URL với đường
   * dẫn cố định, tham số chỉ gồm số/mã đã kiểm (không phản chiếu chuỗi người dùng gửi).
   * Sandbox thường không gọi được IPN (cần URL công khai) nên return cũng chốt giao dịch, nhưng chỉ
   * khi chữ ký hợp lệ VÀ số tiền khớp, qua đúng hàm settle() idempotent như IPN.
   */
  async handleReturn(query: unknown): Promise<string> {
    const config = readVnpayConfig();
    const base =
      config?.appPublicUrl ??
      (process.env.APP_PUBLIC_URL ?? '').replace(/\/+$/, '');
    const target = (qs: Record<string, string>) =>
      `${base}/my/payments/result?${new URLSearchParams(qs).toString()}`;
    if (!config) return target({ error: 'not_configured' });
    const params = onlyStringParams(query);
    if (!verifyVnpParams(params, config.hashSecret))
      return target({ error: 'invalid_signature' });
    try {
      const result = await this.settle(params);
      if (result.outcome === 'NOT_FOUND') return target({ error: 'not_found' });
      if (result.outcome === 'BAD_AMOUNT')
        return target({ error: 'invalid_amount' });
      return target({ paymentId: String(result.paymentId) });
    } catch (err) {
      this.logger.error('Return VNPay lỗi', err as Error);
      return target({ error: 'unknown' });
    }
  }

  /**
   * Áp kết quả VNPay (đã qua kiểm chữ ký) vào DB, idempotent và an toàn khi đua.
   * Khoá dòng giao dịch rồi khoá các dòng phạt (thứ tự id) trước khi đổi gì, nên hai IPN song song,
   * IPN đua với thu tiền mặt hay với hết hạn đều tuần tự hoá; kẻ đến sau thấy trạng thái đã chốt.
   */
  async settle(params: Record<string, string>): Promise<Settlement> {
    const txnRef = params.vnp_TxnRef;
    if (!txnRef) return { outcome: 'NOT_FOUND' };
    const known = await this.prisma.payment.findUnique({ where: { txnRef } });
    if (!known) return { outcome: 'NOT_FOUND' };
    // vnp_Amount là VND × 100; so chuỗi nguyên văn để không dính lỗi làm tròn / "1e5"
    if (params.vnp_Amount !== String(known.amount * 100))
      return { outcome: 'BAD_AMOUNT', paymentId: known.id };

    const succeeded =
      params.vnp_ResponseCode === '00' &&
      (params.vnp_TransactionStatus === undefined ||
        params.vnp_TransactionStatus === '00');
    const when = parseVnpDate(params.vnp_PayDate) ?? new Date();
    const gatewayFields = {
      vnpTransactionNo: params.vnp_TransactionNo?.slice(0, 40) ?? null,
      bankCode: params.vnp_BankCode?.slice(0, 20) ?? null,
      responseCode: params.vnp_ResponseCode?.slice(0, 8) ?? null,
    };

    const settlement = await this.prisma.$transaction(
      async (tx): Promise<Settlement> => {
        await tx.$queryRaw`SELECT id FROM payments WHERE id = ${known.id} FOR UPDATE`;
        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: known.id },
        });
        const paymentId = payment.id;
        if (payment.status === PaymentStatus.PAID)
          return { outcome: 'ALREADY_PROCESSED', paymentId };

        if (!succeeded) {
          // Kết quả hỏng chỉ có nghĩa khi giao dịch còn chờ; đã hỏng/hết hạn/huỷ rồi thì thôi
          if (payment.status !== PaymentStatus.PENDING)
            return { outcome: 'ALREADY_PROCESSED', paymentId };
          const cancelled = params.vnp_ResponseCode === '24';
          await tx.payment.update({
            where: { id: paymentId },
            data: {
              ...gatewayFields,
              status: cancelled
                ? PaymentStatus.CANCELLED
                : PaymentStatus.FAILED,
            },
          });
          await tx.paymentFine.updateMany({
            where: { paymentId },
            data: { active: false },
          });
          return { outcome: cancelled ? 'CANCELLED' : 'FAILED', paymentId };
        }

        const links = await tx.paymentFine.findMany({
          where: { paymentId },
          select: { fineId: true },
          orderBy: { fineId: 'asc' },
        });
        const fineIds = links.map((l) => l.fineId);
        await tx.$queryRaw`SELECT id FROM fines WHERE id IN (${Prisma.join(fineIds)}) ORDER BY id FOR UPDATE`;

        if (payment.status !== PaymentStatus.PENDING) {
          // IPN thành công đến muộn (giao dịch đã hết hạn / bị huỷ / bị ghi hỏng trước đó, ví dụ
          // bạn đọc nhập sai OTP rồi thử lại thành công trên cùng trang VNPay). Tiền đã về: nhận
          // nếu mọi khoản phạt vẫn trống, nếu không thì giữ nguyên và đánh dấu cần hoàn tiền.
          const paidFines = await tx.fine.count({
            where: { id: { in: fineIds }, paidAt: { not: null } },
          });
          const otherHolders = await tx.paymentFine.count({
            where: {
              fineId: { in: fineIds },
              active: true,
              paymentId: { not: paymentId },
            },
          });
          if (paidFines > 0 || otherHolders > 0) {
            await tx.payment.update({
              where: { id: paymentId },
              data: { ...gatewayFields, note: REFUND_NOTE },
            });
            this.logger.warn(
              `Giao dịch ${txnRef} đã trả tiền sau khi khoản phạt được xử lý cách khác: cần hoàn tiền thủ công`,
            );
            return { outcome: 'REFUND_REQUIRED', paymentId };
          }
        }

        const marked = await tx.fine.updateMany({
          where: { id: { in: fineIds }, paidAt: null },
          data: { paidAt: when, paidToId: null },
        });
        if (marked.count !== fineIds.length)
          throw new Error('Khoản phạt đổi trạng thái giữa chừng'); // đã khoá nên không xảy ra; rollback nếu có
        await tx.paymentFine.updateMany({
          where: { paymentId },
          data: { active: true },
        });
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            ...gatewayFields,
            status: PaymentStatus.PAID,
            paidAt: when,
            note: null,
          },
        });
        return { outcome: 'PAID', paymentId };
      },
    );
    this.logger.log(`VNPay ${txnRef}: ${settlement.outcome}`);
    return settlement;
  }

  private pendingExists(): BusinessException {
    return new BusinessException(
      'FINE_PAYMENT_PENDING',
      'Khoản phạt đang nằm trong một giao dịch chờ thanh toán. Hãy hoàn tất hoặc huỷ giao dịch đó trước.',
    );
  }

  private noUnpaidFines(): BusinessException {
    return new BusinessException(
      'NO_UNPAID_FINES',
      'Bạn không có khoản phạt nào cần thanh toán',
    );
  }
}

function toView(row: PaymentRow): PaymentView {
  return {
    id: row.id,
    txnRef: row.txnRef,
    amount: row.amount,
    status: row.status,
    vnpTransactionNo: row.vnpTransactionNo,
    bankCode: row.bankCode,
    responseCode: row.responseCode,
    needsRefund: row.note === REFUND_NOTE,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
    expiresAt: row.expiresAt,
    user: row.user,
    fines: row.fines.map((l) => ({
      id: l.fine.id,
      type: l.fine.type,
      amount: l.fine.amount,
      loanId: l.fine.loan.id,
      bookTitle: l.fine.loan.copy.book.title,
    })),
  };
}
