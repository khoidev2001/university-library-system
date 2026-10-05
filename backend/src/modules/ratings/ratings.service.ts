import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { LoanStatus, Rating } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR-RATE-01, BR-11: chỉ chấm điểm sách đã từng mượn và trả xong;
   * mỗi bạn đọc một điểm cho một đầu sách (chấm lại thì ghi đè).
   */
  async rate(userId: number, bookId: number, score: number): Promise<Rating> {
    const book = await this.prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Không tìm thấy sách');

    const returned = await this.prisma.loan.count({
      where: { userId, status: LoanStatus.RETURNED, copy: { bookId } },
    });
    if (returned === 0) {
      throw new BusinessException(
        'NOT_BORROWED',
        'Bạn chỉ đánh giá được sách đã mượn và trả',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.prisma.rating.upsert({
      where: { userId_bookId: { userId, bookId } },
      update: { score },
      create: { userId, bookId, score },
    });
  }

  async summary(
    bookId: number,
  ): Promise<{ avg: number | null; count: number }> {
    const result = await this.prisma.rating.aggregate({
      where: { bookId },
      _avg: { score: true },
      _count: true,
    });
    return { avg: result._avg.score, count: result._count };
  }
}
