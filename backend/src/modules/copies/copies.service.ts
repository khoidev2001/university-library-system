import { Injectable, NotFoundException } from '@nestjs/common';
import { BookCopy, CopyStatus, LoanStatus } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCopyDto, UpdateCopyDto } from './dto/copies.dto';

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
    return this.prisma.bookCopy.update({ where: { id }, data: dto });
  }
}
