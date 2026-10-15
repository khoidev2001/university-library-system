import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

function hasNullByte(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return value.includes('\u0000');
  if (depth > 8 || value === null || typeof value !== 'object') return false;
  return Object.values(value).some((v) => hasNullByte(v, depth + 1));
}

/**
 * Postgres không lưu được ký tự NUL (0x00) trong text: để lọt xuống DB là lỗi 500.
 * Chặn sớm ở mọi body / query / param bằng 400.
 */
@Injectable()
export class RejectNullBytePipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'custom' && hasNullByte(value))
      throw new BadRequestException('Dữ liệu chứa ký tự không hợp lệ (NUL)');
    return value;
  }
}
