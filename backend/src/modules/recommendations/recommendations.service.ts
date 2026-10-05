import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CopyStatus, LoanStatus } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AiClient, AiUnavailableError } from '../ai/ai.client';

export interface RecommendationItem {
  id: number;
  title: string;
  coverUrl: string | null;
  category: { id: number; name: string };
  authors: string[];
  copiesAvailable: number;
}

export type RecommendationSource = 'MODEL' | 'POPULAR' | 'NONE';

export interface RecommendationResult {
  items: RecommendationItem[];
  source: RecommendationSource;
  reason?: string;
}

/**
 * FR-AI-01…04. Mô hình nằm ở AI Service; tầng này chịu trách nhiệm:
 *  - loại sách bạn đọc đã mượn (FR-AI-03),
 *  - làm giàu bằng dữ liệu sách thật và số bản còn,
 *  - fallback sách mượn nhiều khi AI chưa sẵn sàng (FR-AI-02, NFR-AVAIL-03).
 */
@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClient,
  ) {}

  async forUser(userId: number, k: number): Promise<RecommendationResult> {
    const borrowed = await this.prisma.loan.findMany({
      where: { userId },
      select: { copy: { select: { bookId: true } } },
    });
    const excluded = new Set(borrowed.map((l) => l.copy.bookId));

    let bookIds: number[] = [];
    let source: RecommendationSource = 'MODEL';
    try {
      bookIds = (await this.ai.recommend(userId, k + excluded.size)).filter((id) => !excluded.has(id)).slice(0, k);
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) throw e;
      this.logger.warn(`AI không sẵn sàng, dùng sách mượn nhiều: ${e.message}`);
      source = 'POPULAR';
      bookIds = await this.popularBookIds(k, excluded);
    }

    if (bookIds.length === 0 && source === 'MODEL') {
      source = 'POPULAR';
      bookIds = await this.popularBookIds(k, excluded);
    }
    if (bookIds.length === 0) return { items: [], source: 'NONE', reason: 'NO_DATA' };

    const items = await this.loadBooks(bookIds);
    return { items, source, ...(source === 'POPULAR' && { reason: 'AI_UNAVAILABLE_OR_COLD_START' }) };
  }

  /** FR-AI-02: cold-start và fallback — sách được mượn nhiều nhất, trừ sách đã mượn. */
  private async popularBookIds(k: number, excluded: Set<number>): Promise<number[]> {
    const groups = await this.prisma.loan.groupBy({
      by: ['copyId'],
      _count: { _all: true },
      orderBy: { _count: { copyId: 'desc' } },
      take: (k + excluded.size) * 3,
    });
    const copies = await this.prisma.bookCopy.findMany({
      where: { id: { in: groups.map((g) => g.copyId) } },
      select: { id: true, bookId: true },
    });
    const bookOfCopy = new Map(copies.map((c) => [c.id, c.bookId]));
    const counts = new Map<number, number>();
    for (const g of groups) {
      const bookId = bookOfCopy.get(g.copyId);
      if (bookId === undefined || excluded.has(bookId)) continue;
      counts.set(bookId, (counts.get(bookId) ?? 0) + g._count._all);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([bookId]) => bookId);
  }

  /** Giữ nguyên thứ tự do mô hình trả về. */
  private async loadBooks(bookIds: number[]): Promise<RecommendationItem[]> {
    const books = await this.prisma.book.findMany({
      where: { id: { in: bookIds } },
      select: {
        id: true,
        title: true,
        coverUrl: true,
        category: { select: { id: true, name: true } },
        authors: { select: { author: { select: { name: true } } } },
        copies: { where: { status: CopyStatus.AVAILABLE }, select: { id: true } },
      },
    });
    const byId = new Map(books.map((b) => [b.id, b]));
    return bookIds
      .map((id) => byId.get(id))
      .filter((b): b is NonNullable<typeof b> => !!b)
      .map((b) => ({
        id: b.id,
        title: b.title,
        coverUrl: b.coverUrl,
        category: b.category,
        authors: b.authors.map((ba) => ba.author.name),
        copiesAvailable: b.copies.length,
      }));
  }

  /** FR-AI-04: Admin yêu cầu huấn luyện lại; AI Service tự kéo dữ liệu qua /internal/training-data. */
  async train(): Promise<{ status: string }> {
    await this.callAi(() => this.ai.train());
    return { status: 'started' };
  }

  /** Số liệu đánh giá mô hình để đưa vào báo cáo LAB 3. */
  metrics(): Promise<unknown> {
    return this.callAi(() => this.ai.metrics());
  }

  /** SDD 5.8: AI không phản hồi thì trả 503 AI_UNAVAILABLE, không để lọt thành 500. */
  private async callAi<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (e) {
      if (e instanceof AiUnavailableError) {
        throw new BusinessException('AI_UNAVAILABLE', e.message, HttpStatus.SERVICE_UNAVAILABLE);
      }
      throw e;
    }
  }

  /** Thống kê độ chính xác thực tế của dự báo trả trễ (so dự báo đã lưu với kết quả thật). */
  async overdueAccuracy(): Promise<{ sampled: number; predictedHigh: number; actuallyLate: number; hitRate: number | null }> {
    const loans = await this.prisma.loan.findMany({
      where: { predictedOverdueRisk: { not: null }, status: LoanStatus.RETURNED },
      select: { predictedOverdueRisk: true, dueAt: true, returnedAt: true },
    });
    const high = loans.filter((l) => (l.predictedOverdueRisk ?? 0) >= 0.5);
    const lateAmongHigh = high.filter((l) => l.returnedAt && l.returnedAt > l.dueAt).length;
    return {
      sampled: loans.length,
      predictedHigh: high.length,
      actuallyLate: lateAmongHigh,
      hitRate: high.length ? Number((lateAmongHigh / high.length).toFixed(3)) : null,
    };
  }
}
