import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class TopBooksQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;
  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}

/** Trần số dòng của báo cáo quá hạn (phản hồi từng lên tới 6MB / 1,3 giây với 24k phiếu quá hạn). */
export const MAX_OVERDUE_ROWS = 5000;

export class OverdueQueryDto {
  @ApiPropertyOptional({
    default: MAX_OVERDUE_ROWS,
    minimum: 1,
    maximum: MAX_OVERDUE_ROWS,
    description:
      'Số dòng tối đa, quá hạn lâu nhất xếp trước; tổng số ở header X-Total-Count',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_OVERDUE_ROWS)
  limit = MAX_OVERDUE_ROWS;
}

export class LoansByMonthQueryDto {
  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 36 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  months = 12;
}
