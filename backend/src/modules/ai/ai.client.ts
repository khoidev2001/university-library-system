import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemberType } from '@prisma/client';

export interface OverdueFeatures {
  memberType: MemberType;
  priorLoans: number;
  priorOverdue: number;
  activeLoans: number;
  categoryId: number;
  loanDays: number;
  month: number;
}

/**
 * Cầu nối sang AI Service (FastAPI). Hợp đồng ở SDD mục 5.9.
 *
 * Nguyên tắc (FR-LOAN-02, NFR-AVAIL-03): AI chậm hoặc chết KHÔNG được chặn nghiệp vụ.
 * - predictOverdue: timeout 2s → trả null, thủ thư vẫn cho mượn được.
 * - recommend: timeout 3s → ném AiUnavailableError để tầng trên trả danh sách rỗng.
 * Sprint 3 sẽ hiện thực hoá phía service; phần client này đã dùng được ngay.
 */
export class AiUnavailableError extends Error {
  constructor(cause: string) {
    super(`AI service không phản hồi: ${cause}`);
    this.name = 'AiUnavailableError';
  }
}

@Injectable()
export class AiClient {
  private readonly logger = new Logger(AiClient.name);
  private readonly baseUrl: string;
  private readonly predictTimeoutMs: number;
  private readonly recommendTimeoutMs: number;

  constructor(
    config: ConfigService,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = config
      .get<string>('AI_SERVICE_URL', 'http://localhost:8000')
      .replace(/\/$/, '');
    this.predictTimeoutMs = Number(config.get('AI_TIMEOUT_MS', 2000));
    this.recommendTimeoutMs = Number(
      config.get('AI_RECOMMEND_TIMEOUT_MS', 3000),
    );
  }

  /** Xác suất trả trễ 0..1, hoặc null khi AI không sẵn sàng (không ném lỗi). */
  async predictOverdue(features: OverdueFeatures): Promise<number | null> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/predict-overdue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_type: features.memberType,
          prior_loans: features.priorLoans,
          prior_overdue: features.priorOverdue,
          active_loans: features.activeLoans,
          category_id: features.categoryId,
          loan_days: features.loanDays,
          month: features.month,
        }),
        signal: AbortSignal.timeout(this.predictTimeoutMs),
      });
      if (!res.ok) {
        this.logger.warn(`predict-overdue HTTP ${res.status} — bỏ qua dự báo`);
        return null;
      }
      const body = (await res.json()) as { risk?: number };
      if (typeof body.risk !== 'number' || body.risk < 0 || body.risk > 1)
        return null;
      return body.risk;
    } catch (e) {
      this.logger.warn(
        `predict-overdue lỗi: ${(e as Error).message} — bỏ qua dự báo`,
      );
      return null;
    }
  }

  /** FR-AI-04: yêu cầu AI Service huấn luyện lại (nó tự kéo dữ liệu qua /internal/training-data). */
  async train(): Promise<void> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/train`, {
        method: 'POST',
        signal: AbortSignal.timeout(this.recommendTimeoutMs),
      });
      if (!res.ok) throw new AiUnavailableError(`HTTP ${res.status}`);
    } catch (e) {
      throw e instanceof AiUnavailableError
        ? e
        : new AiUnavailableError((e as Error).message);
    }
  }

  /** Số đo mô hình để đưa vào báo cáo LAB 3. */
  async metrics(): Promise<unknown> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/metrics`, {
        signal: AbortSignal.timeout(this.recommendTimeoutMs),
      });
      if (!res.ok) throw new AiUnavailableError(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      throw e instanceof AiUnavailableError
        ? e
        : new AiUnavailableError((e as Error).message);
    }
  }

  /** Danh sách bookId gợi ý; ném AiUnavailableError khi AI không sẵn sàng. */
  async recommend(userId: number, k: number): Promise<number[]> {
    try {
      const url = new URL(`${this.baseUrl}/recommend`);
      url.searchParams.set('user_id', String(userId));
      url.searchParams.set('k', String(k));
      const res = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(this.recommendTimeoutMs),
      });
      if (!res.ok) throw new AiUnavailableError(`HTTP ${res.status}`);
      const body = (await res.json()) as { book_ids?: number[] };
      return Array.isArray(body.book_ids) ? body.book_ids : [];
    } catch (e) {
      if (e instanceof AiUnavailableError) throw e;
      throw new AiUnavailableError((e as Error).message);
    }
  }
}
