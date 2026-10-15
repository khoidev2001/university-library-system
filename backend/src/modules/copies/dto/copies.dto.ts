import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CopyStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEntityId } from '../../../common/dto/entity-id.decorator';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateCopyDto {
  @ApiProperty({ example: 'LIB-000123' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{3,40}$/, {
    message: 'Mã vạch chỉ gồm chữ, số, dấu gạch ngang',
  })
  barcode: string;

  @ApiPropertyOptional({ example: 'Kệ A2-03' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shelfLocation?: string;
}

export class UpdateCopyDto {
  @ApiPropertyOptional({ enum: CopyStatus })
  @IsOptional()
  @IsEnum(CopyStatus)
  status?: CopyStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shelfLocation?: string;
}

/** Chuỗi "1,2,3" trên query → mảng số (đã là mảng thì giữ nguyên). */
const toIdList = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map(Number)
    : value;

export const MAX_LABEL_COPIES = 2000;

export class LabelCopiesQueryDto {
  @ApiPropertyOptional({
    description: 'Mã đầu sách, cách nhau dấu phẩy (tối đa 200)',
    example: '12,13',
  })
  @IsOptional()
  @Transform(toIdList)
  @IsArray()
  @ArrayMaxSize(200)
  @IsEntityId({ each: true })
  bookIds?: number[];

  @ApiPropertyOptional({
    description: 'Mã bản sao, cách nhau dấu phẩy (tối đa 500)',
    example: '101,102',
  })
  @IsOptional()
  @Transform(toIdList)
  @IsArray()
  @ArrayMaxSize(500)
  @IsEntityId({ each: true })
  copyIds?: number[];
}
