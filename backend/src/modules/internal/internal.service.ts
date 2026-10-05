import { Injectable } from '@nestjs/common';
import { LoanStatus, MemberType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface TrainingBook {
  id: number;
  title: string;
  authors: string;
  category: string;
  description: string | null;
}

export interface TrainingInteraction {
  userId: number;
  bookId: number;
  type: 'LOAN' | 'RATING';
  score: number | null;
  borrowedAt: string | null;
  dueAt: string | null;
  returnedAt: string | null;
  categoryId: number | null;
}

export interface TrainingUser {
  id: number;
  memberType: MemberType | null;
}

export interface TrainingData {
  generatedAt: string;
  books: TrainingBook[];
  users: TrainingUser[];
  interactions: TrainingInteraction[];
}

/**
 * Nguồn dữ liệu huấn luyện cho AI Service (SDD mục 5.8, quyết định ADR #4):
 * AI không kết nối trực tiếp cơ sở dữ liệu, chỉ đọc qua đây.
 */
@Injectable()
export class InternalService {
  constructor(private readonly prisma: PrismaService) {}

  async trainingData(): Promise<TrainingData> {
    const [books, users, loans, ratings] = await Promise.all([
      this.prisma.book.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          category: { select: { name: true } },
          authors: { select: { author: { select: { name: true } } } },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.user.findMany({ where: { role: 'READER' }, select: { id: true, memberType: true } }),
      this.prisma.loan.findMany({
        select: {
          userId: true,
          borrowedAt: true,
          dueAt: true,
          returnedAt: true,
          status: true,
          copy: { select: { bookId: true, book: { select: { categoryId: true } } } },
        },
      }),
      this.prisma.rating.findMany({ select: { userId: true, bookId: true, score: true } }),
    ]);

    const interactions: TrainingInteraction[] = [
      ...loans.map((loan) => ({
        userId: loan.userId,
        bookId: loan.copy.bookId,
        type: 'LOAN' as const,
        score: null,
        borrowedAt: loan.borrowedAt.toISOString(),
        dueAt: loan.dueAt.toISOString(),
        // Phiếu LOST coi như chưa trả: mô hình không được học đó là lần trả đúng hạn.
        returnedAt: loan.status === LoanStatus.RETURNED && loan.returnedAt ? loan.returnedAt.toISOString() : null,
        categoryId: loan.copy.book.categoryId,
      })),
      ...ratings.map((rating) => ({
        userId: rating.userId,
        bookId: rating.bookId,
        type: 'RATING' as const,
        score: rating.score,
        borrowedAt: null,
        dueAt: null,
        returnedAt: null,
        categoryId: null,
      })),
    ];

    return {
      generatedAt: new Date().toISOString(),
      books: books.map((b) => ({
        id: b.id,
        title: b.title,
        authors: b.authors.map((ba) => ba.author.name).join(', '),
        category: b.category.name,
        description: b.description,
      })),
      users,
      interactions,
    };
  }
}
