import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BookInfo {
  isbn: string;
  title: string;
  authors: string[];
  description?: string;
  publisher?: string;
  publishedYear?: number;
  categories: string[];
  coverUrl?: string;
  pageCount?: number;
}

interface VolumeResponse {
  totalItems: number;
  items?: {
    volumeInfo: {
      title?: string;
      authors?: string[];
      description?: string;
      publisher?: string;
      publishedDate?: string;
      categories?: string[];
      pageCount?: number;
      imageLinks?: { thumbnail?: string };
    };
  }[];
}

/**
 * Tích hợp ngoài duy nhất của hệ thống (SDD 2.4). Không gọi khi tra cứu — chỉ ở seed và FR-BOOK-05.
 * Có key thì gửi key (1.000 req/ngày); không key vẫn chạy nhưng bị giới hạn chặt hơn.
 */
@Injectable()
export class GoogleBooksClient {
  private readonly logger = new Logger(GoogleBooksClient.name);
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GOOGLE_BOOKS_API_KEY') || undefined;
    this.baseUrl = config.get<string>(
      'GOOGLE_BOOKS_URL',
      'https://www.googleapis.com/books/v1/volumes',
    );
  }

  async lookup(
    isbn: string,
    fetchImpl: typeof fetch = fetch,
  ): Promise<BookInfo | null> {
    const clean = isbn.replace(/[^0-9Xx]/g, '');
    const url = new URL(this.baseUrl);
    url.searchParams.set('q', `isbn:${clean}`);
    url.searchParams.set('maxResults', '1');
    if (this.apiKey) url.searchParams.set('key', this.apiKey);

    let body: VolumeResponse;
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        this.logger.warn(`Google Books ${res.status} for ISBN ${clean}`);
        return null;
      }
      body = (await res.json()) as VolumeResponse;
    } catch (e) {
      this.logger.warn(
        `Google Books lỗi mạng cho ISBN ${clean}: ${(e as Error).message}`,
      );
      return null;
    }
    const info = body.items?.[0]?.volumeInfo;
    if (!info?.title) return null;
    const year = info.publishedDate
      ? Number.parseInt(info.publishedDate.slice(0, 4), 10)
      : undefined;
    return {
      isbn: clean,
      title: info.title,
      authors: info.authors ?? [],
      description: info.description,
      publisher: info.publisher,
      publishedYear: Number.isFinite(year) ? year : undefined,
      categories: info.categories ?? [],
      coverUrl: info.imageLinks?.thumbnail?.replace(/^http:/, 'https:'),
      pageCount: info.pageCount,
    };
  }
}
