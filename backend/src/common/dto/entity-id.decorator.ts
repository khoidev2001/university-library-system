import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { INT4_MAX } from '../pipes/parse-id.pipe';

/** Khoá ngoại / id gửi qua body hoặc query: số nguyên 1…INT4_MAX (ngoài miền này Postgres báo tràn số → 500). */
export function IsEntityId(options: { each?: boolean } = {}) {
  return applyDecorators(
    ...(options.each ? [] : [Type(() => Number)]),
    IsInt({ each: options.each }),
    Min(1, { each: options.each }),
    Max(INT4_MAX, { each: options.each }),
  );
}
