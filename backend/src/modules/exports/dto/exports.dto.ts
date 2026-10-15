import { ApiPropertyOptional } from '@nestjs/swagger';
import { LoanStatus, MemberType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsEntityId } from '../../../common/dto/entity-id.decorator';

const toBool = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

/** Số dòng tối đa của một lần xuất; vượt thì file bị cắt và có header X-Export-Truncated. */
export const MAX_EXPORT_ROWS = Number(process.env.EXPORT_MAX_ROWS ?? 100_000);

export class ExportFormatDto {
  @ApiPropertyOptional({ enum: ['csv', 'xlsx'], default: 'csv' })
  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format: 'csv' | 'xlsx' = 'csv';
}

export class ExportDateRangeDto extends ExportFormatDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Từ ngày (bao gồm), theo giờ thư viện UTC+7',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Đến hết ngày này (bao gồm cả ngày), theo giờ thư viện UTC+7',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class LoansExportQueryDto extends ExportDateRangeDto {
  @ApiPropertyOptional({ enum: LoanStatus })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @ApiPropertyOptional({ type: Boolean, description: 'Chỉ phiếu đang quá hạn' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  userId?: number;
}

export class TopBooksExportQueryDto extends ExportDateRangeDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit = 50;
}

export class FinesExportQueryDto extends ExportDateRangeDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: 'true = đã thu, false = chưa thu, bỏ trống = cả hai',
  })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  paid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  userId?: number;
}

export class ReadersExportQueryDto extends ExportFormatDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên, email, mã thẻ' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: MemberType })
  @IsOptional()
  @IsEnum(MemberType)
  memberType?: MemberType;
}

export class BooksExportQueryDto extends ExportFormatDto {
  @ApiPropertyOptional({ description: 'Khớp tiêu đề, tên tác giả hoặc ISBN' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  categoryId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  authorId?: number;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Chỉ sách còn bản mượn được',
  })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  available?: boolean;
}
