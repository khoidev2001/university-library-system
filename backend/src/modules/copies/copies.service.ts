import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookCopy, CopyStatus, LoanStatus } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCopyDto,
  LabelCopiesQueryDto,
  MAX_LABEL_COPIES,
  UpdateCopyDto,
} from './dto/copies.dto';

export interface LabelCopy {
  id: number;
  barcode: string;
  shelfLocation: string | null;
  status: CopyStatus;
  book: { id: number; title: string; isbn: string | null };
}

@Injectable()
export class CopiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByBook(bookId: number): Promise<BookCopy[]> {
    const book = await this.prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Không tìm thấy sách');
    return this.prisma.bookCopy.findMany({
      where: { bookId },
      orderBy: { barcode: 'asc' },
    });
  }

  /** Dữ liệu để in nhãn: bản sao của các đầu sách chọn (hoặc các bản sao chọn), xếp theo sách rồi mã vạch. */
  async findForLabels(query: LabelCopiesQueryDto): Promise<LabelCopy[]> {
    const bookIds = query.bookIds ?? [];
    const copyIds = query.copyIds ?? [];
    if (bookIds.length === 0 && copyIds.length === 0)
      throw new BadRequestException('Cần truyền bookIds hoặc copyIds');
    const copies = await this.prisma.bookCopy.findMany({
      where: {
        OR: [
          ...(bookIds.length ? [{ bookId: { in: bookIds } }] : []),
          ...(copyIds.length ? [{ id: { in: copyIds } }] : []),
        ],
      },
      orderBy: [{ bookId: 'asc' }, { id: 'asc' }],
      take: MAX_LABEL_COPIES + 1,
      select: {
        id: true,
        barcode: true,
        shelfLocation: true,
        status: true,
        book: { select: { id: true, title: true, isbn: true } },
      },
    });
    if (copies.length > MAX_LABEL_COPIES)
      throw new BusinessException(
        'TOO_MANY_LABELS',
        `Tối đa ${MAX_LABEL_COPIES} nhãn mỗi lần in, hãy chọn ít sách hơn`,
        422,
      );
    return copies;
  }

  /** FR-COPY-01 */
  async create(bookId: number, dto: CreateCopyDto): Promise<BookCopy> {
    const book = await this.prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Không tìm thấy sách');
    if (
      await this.prisma.bookCopy.findUnique({ where: { barcode: dto.barcode } })
    ) {
      throw new BusinessException(
        'BARCODE_EXISTS',
        `Mã vạch ${dto.barcode} đã tồn tại`,
      );
    }
    return this.prisma.bookCopy.create({
      data: {
        bookId,
        barcode: dto.barcode,
        shelfLocation: dto.shelfLocation,
        status: CopyStatus.AVAILABLE,
      },
    });
  }

  /** FR-COPY-02: không được đặt AVAILABLE/MAINTENANCE/LOST tay khi bản sao đang có phiếu ACTIVE. */
  async update(id: number, dto: UpdateCopyDto): Promise<BookCopy> {
    const copy = await this.prisma.bookCopy.findUnique({ where: { id } });
    if (!copy) throw new NotFoundException('Không tìm thấy bản sao');
    if (dto.status !== undefined && dto.status !== copy.status) {
      const activeLoan = await this.prisma.loan.count({
        where: { copyId: id, status: LoanStatus.ACTIVE },
      });
      if (activeLoan > 0) {
        throw new BusinessException(
          'COPY_HAS_ACTIVE_LOAN',
          'Bản sao đang được mượn; hãy nhận trả hoặc báo mất qua phiếu mượn',
        );
      }
      if (dto.status === CopyStatus.BORROWED) {
        throw new BusinessException(
          'COPY_HAS_ACTIVE_LOAN',
          'Trạng thái BORROWED chỉ được đặt qua phiếu mượn',
        );
      }
    }
    if (dto.status !== undefined && dto.status !== copy.status) {
      if (dto.status === CopyStatus.HELD) {
        throw new BusinessException(
          'COPY_HELD',
          'Trạng thái HELD chỉ được đặt khi có người đặt trước',
        );
      }
      if (copy.status === CopyStatus.HELD) {
        throw new BusinessException(
          'COPY_HELD',
          'Bản sao đang giữ cho bạn đọc đã đặt trước; hãy huỷ đặt trước trước khi đổi trạng thái',
        );
      }
    }
    return this.prisma.bookCopy.update({ where: { id }, data: dto });
  }
}
