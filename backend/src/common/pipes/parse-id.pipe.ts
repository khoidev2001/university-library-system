import {
  ArgumentMetadata,
  Injectable,
  NotFoundException,
  ParseIntPipe,
} from '@nestjs/common';

/** Khoá chính là INT4 của Postgres; số lớn hơn không thể tồn tại, đưa xuống DB sẽ thành lỗi 500. */
export const INT4_MAX = 2_147_483_647;

/**
 * ParseIntPipe cho `:id` trên đường dẫn: chữ → 400; số ngoài miền INT4 → 404
 * (id đó chắc chắn không có) thay vì để Prisma ném lỗi tràn số thành 500.
 */
@Injectable()
export class ParseIdPipe extends ParseIntPipe {
  async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
    const id = await super.transform(value, metadata);
    if (id > INT4_MAX || id < -INT4_MAX)
      throw new NotFoundException('Không tìm thấy bản ghi');
    return id;
  }
}
