import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Giao dịch chưa trả tiền sau ngần này phút thì hết hạn (cũng là `vnp_ExpireDate` gửi VNPay). */
export const PAYMENT_TTL_MINUTES = 15;

export interface ExpireScope {
  userId?: number;
  paymentId?: number;
  fineId?: number;
}

/**
 * Chuyển giao dịch PENDING đã quá `expiresAt` sang EXPIRED và nhả các khoản phạt của nó.
 * An toàn khi chạy lặp và khi đua với IPN: UPDATE có điều kiện `status = PENDING` nên giao dịch
 * IPN vừa chốt PAID thì bị bỏ qua; cập nhật bảng nối chỉ chạm giao dịch đã EXPIRED.
 * Trả về số giao dịch vừa hết hạn.
 */
export async function expireStalePayments(
  prisma: PrismaService,
  at: Date = new Date(),
  scope: ExpireScope = {},
): Promise<number> {
  const stale = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.PENDING,
      expiresAt: { lt: at },
      ...(scope.userId !== undefined && { userId: scope.userId }),
      ...(scope.paymentId !== undefined && { id: scope.paymentId }),
      ...(scope.fineId !== undefined && {
        fines: { some: { fineId: scope.fineId } },
      }),
    },
    select: { id: true },
  });
  if (stale.length === 0) return 0;
  const ids = stale.map((p) => p.id);
  const [expired] = await prisma.$transaction([
    prisma.payment.updateMany({
      where: {
        id: { in: ids },
        status: PaymentStatus.PENDING,
        expiresAt: { lt: at },
      },
      data: { status: PaymentStatus.EXPIRED },
    }),
    prisma.paymentFine.updateMany({
      where: {
        paymentId: { in: ids },
        payment: { status: PaymentStatus.EXPIRED },
      },
      data: { active: false },
    }),
  ]);
  return expired.count;
}
