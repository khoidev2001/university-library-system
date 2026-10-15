import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CopyStatus,
  LoanStatus,
  Prisma,
  ReservationStatus,
  Role,
} from '@prisma/client';
import { addDays } from '../../common/date.util';
import { Page, toPage } from '../../common/dto/pagination.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { FinesService } from '../fines/fines.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QueryReservationsDto } from './dto/reservations.dto';

/** Số ngày bạn đọc được giữ sách sau khi có bản sao trả về. */
export const HOLD_DAYS = 3;
/** Số đặt trước đang hiệu lực tối đa của một bạn đọc. */
export const MAX_ACTIVE_RESERVATIONS = 3;

const reservationInclude = {
  book: { select: { id: true, title: true, coverUrl: true } },
  copy: { select: { id: true, barcode: true, shelfLocation: true } },
  user: { select: { id: true, fullName: true, memberCode: true } },
} satisfies Prisma.ReservationInclude;

export type ReservationRow = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

const ACTIVE: ReservationStatus[] = [
  ReservationStatus.WAITING,
  ReservationStatus.READY,
];

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly fines: FinesService,
  ) {}

  /** Bạn đọc đặt trước một đầu sách đang hết bản trên kệ. */
  async create(userId: number, bookId: number): Promise<ReservationRow> {
    await this.expireStale();
    const [user, book] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.book.findUnique({
        where: { id: bookId },
        include: { copies: { select: { status: true } } },
      }),
    ]);
    if (!user || user.role !== Role.READER)
      throw new BusinessException('NOT_A_READER', 'Chỉ bạn đọc mới đặt trước');
    if (!user.isActive)
      throw new BusinessException('ACCOUNT_LOCKED', 'Thẻ bạn đọc đang bị khoá');
    if (!book) throw new NotFoundException('Không tìm thấy sách');

    const circulating = book.copies.filter(
      (c) =>
        c.status === CopyStatus.AVAILABLE ||
        c.status === CopyStatus.BORROWED ||
        c.status === CopyStatus.HELD,
    );
    if (circulating.length === 0)
      throw new BusinessException(
        'NO_COPIES',
        'Sách này hiện không có bản sao nào để đặt',
      );
    if (circulating.some((c) => c.status === CopyStatus.AVAILABLE))
      throw new BusinessException(
        'BOOK_AVAILABLE',
        'Sách đang còn trên kệ, bạn đến quầy mượn trực tiếp',
      );

    // Khoá hàng bạn đọc rồi mới kiểm tra + ghi: nhiều yêu cầu đồng thời của cùng một người
    // xếp hàng nối đuôi, nên không thể vượt hạn mức hay đặt trùng một cuốn.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const borrowing = await tx.loan.count({
        where: {
          userId,
          status: LoanStatus.ACTIVE,
          copy: { bookId },
        },
      });
      if (borrowing > 0)
        throw new BusinessException(
          'ALREADY_BORROWING',
          'Bạn đang mượn cuốn sách này',
        );

      const mine = await tx.reservation.findMany({
        where: { userId, status: { in: ACTIVE } },
        select: { bookId: true },
      });
      if (mine.some((r) => r.bookId === bookId))
        throw new BusinessException(
          'ALREADY_RESERVED',
          'Bạn đã đặt trước cuốn sách này',
        );
      if (mine.length >= MAX_ACTIVE_RESERVATIONS)
        throw new BusinessException(
          'RESERVATION_LIMIT',
          `Mỗi bạn đọc đặt trước tối đa ${MAX_ACTIVE_RESERVATIONS} cuốn cùng lúc`,
        );
      const unpaid = await this.fines.unpaidTotal(userId, tx);
      if (unpaid > 0)
        throw new BusinessException(
          'UNPAID_FINE',
          `Bạn còn ${unpaid.toLocaleString('vi-VN')}đ phạt chưa thanh toán`,
        );

      return tx.reservation.create({
        data: { userId, bookId },
        include: reservationInclude,
      });
    });
  }

  /** Bạn đọc huỷ đặt trước của mình; thủ thư huỷ được của bất kỳ ai. */
  async cancel(
    id: number,
    userId: number,
    role: Role,
  ): Promise<ReservationRow> {
    const res = await this.prisma.reservation.findUnique({ where: { id } });
    if (!res || (role === Role.READER && res.userId !== userId))
      throw new NotFoundException('Không tìm thấy đặt trước');
    if (!ACTIVE.includes(res.status))
      throw new BusinessException(
        'RESERVATION_NOT_ACTIVE',
        `Đặt trước đang ở trạng thái ${res.status}`,
      );
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id },
        data: { status: ReservationStatus.CANCELLED },
        include: reservationInclude,
      });
      if (res.status === ReservationStatus.READY && res.copyId) {
        await this.releaseCopy(tx, res.copyId, res.bookId);
      }
      return updated;
    });
  }

  /** Đặt trước của tôi, kèm vị trí trong hàng đợi. */
  async findMine(userId: number) {
    await this.expireStale();
    const rows = await this.prisma.reservation.findMany({
      where: { userId, status: { in: ACTIVE } },
      include: reservationInclude,
      orderBy: { id: 'desc' },
    });
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        queuePosition:
          r.status === ReservationStatus.WAITING
            ? await this.prisma.reservation.count({
                where: {
                  bookId: r.bookId,
                  status: ReservationStatus.WAITING,
                  id: { lte: r.id },
                },
              })
            : 0,
      })),
    );
  }

  /** Hàng đợi cho thủ thư. */
  async findMany(query: QueryReservationsDto): Promise<Page<ReservationRow>> {
    await this.expireStale();
    const where: Prisma.ReservationWhereInput = {
      status: query.status ?? { in: ACTIVE },
      bookId: query.bookId,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        include: reservationInclude,
        orderBy: { id: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return toPage(rows, total, query);
  }

  /** Số người đang xếp hàng cho một đầu sách (hiển thị ở trang chi tiết). */
  waitingCount(bookId: number): Promise<number> {
    return this.prisma.reservation.count({
      where: { bookId, status: ReservationStatus.WAITING },
    });
  }

  /**
   * Gọi khi một bản sao vừa về kệ: giữ nó cho người xếp hàng đầu tiên (nếu có),
   * không thì để AVAILABLE. Chạy trong transaction của người gọi.
   */
  async handleCopyReturned(
    tx: Prisma.TransactionClient,
    copyId: number,
    bookId: number,
    at: Date = new Date(),
  ): Promise<void> {
    // SKIP LOCKED: hai bản sao trả về cùng lúc không thể cùng chọn một người xếp hàng đầu
    // (người thứ hai nhận lượt kế tiếp, hoặc bản sao về AVAILABLE nếu hết người chờ).
    const [pick] = await tx.$queryRaw<{ id: number }[]>`
      SELECT r.id FROM reservations r
      JOIN users u ON u.id = r.user_id
      WHERE r.book_id = ${bookId}
        AND r.status = 'WAITING'::"ReservationStatus"
        AND u.is_active
      ORDER BY r.id ASC
      LIMIT 1
      FOR UPDATE OF r SKIP LOCKED`;
    const next = pick
      ? await tx.reservation.findUnique({
          where: { id: pick.id },
          include: { book: { select: { title: true } } },
        })
      : null;
    if (!next) {
      await tx.bookCopy.update({
        where: { id: copyId },
        data: { status: CopyStatus.AVAILABLE },
      });
      return;
    }
    const expiresAt = addDays(at, HOLD_DAYS);
    await tx.bookCopy.update({
      where: { id: copyId },
      data: { status: CopyStatus.HELD },
    });
    await tx.reservation.update({
      where: { id: next.id },
      data: {
        status: ReservationStatus.READY,
        copyId,
        readyAt: at,
        expiresAt,
      },
    });
    await this.notifications.notify(
      {
        userId: next.userId,
        type: 'RESERVATION_READY',
        title: 'Sách bạn đặt đã có',
        body: `"${next.book.title}" đang được giữ cho bạn tới ${expiresAt.toLocaleDateString('vi-VN')}. Hãy tới quầy thủ thư để mượn.`,
        link: '/my/reservations',
        dedupeKey: `reservation:${next.id}:ready`,
      },
      tx,
    );
  }

  /** Khi mượn bản sao đang HELD: chỉ đúng người đã đặt mới được mượn; đánh dấu đã nhận. */
  async fulfillHeldCopy(
    tx: Prisma.TransactionClient,
    copyId: number,
    userId: number,
  ): Promise<void> {
    // Một câu UPDATE có điều kiện: chỉ đúng người đặt và chỉ một lần (mượn đồng thời không nhân đôi).
    const fulfilled = await tx.reservation.updateMany({
      where: { copyId, userId, status: ReservationStatus.READY },
      data: { status: ReservationStatus.FULFILLED },
    });
    if (fulfilled.count === 0)
      throw new BusinessException(
        'COPY_HELD',
        'Bản sao đang được giữ cho bạn đọc đã đặt trước',
      );
  }

  /** Quá hạn nhận sách: huỷ giữ, trả bản sao về hàng đợi người kế tiếp. */
  async expireStale(at: Date = new Date()): Promise<number> {
    const stale = await this.prisma.reservation.findMany({
      where: { status: ReservationStatus.READY, expiresAt: { lt: at } },
    });
    for (const res of stale) {
      await this.prisma.$transaction(async (tx) => {
        const flipped = await tx.reservation.updateMany({
          where: { id: res.id, status: ReservationStatus.READY },
          data: { status: ReservationStatus.EXPIRED },
        });
        if (flipped.count === 0) return;
        await this.notifications.notify(
          {
            userId: res.userId,
            type: 'RESERVATION_EXPIRED',
            title: 'Đặt trước đã hết hạn',
            body: 'Bạn chưa tới nhận sách trong thời hạn giữ nên lượt đặt trước đã bị huỷ.',
            link: '/my/reservations',
            dedupeKey: `reservation:${res.id}:expired`,
          },
          tx,
        );
        if (res.copyId) await this.releaseCopy(tx, res.copyId, res.bookId, at);
      });
    }
    return stale.length;
  }

  private async releaseCopy(
    tx: Prisma.TransactionClient,
    copyId: number,
    bookId: number,
    at: Date = new Date(),
  ): Promise<void> {
    await this.handleCopyReturned(tx, copyId, bookId, at);
  }
}
