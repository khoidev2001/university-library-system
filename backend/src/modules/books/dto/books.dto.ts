import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryBooksDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Khớp tiêu đề, tên tác giả hoặc ISBN' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  authorId?: number;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Chỉ sách còn bản mượn được',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  available?: boolean;
}

export class CreateBookDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title: string;

  @ApiPropertyOptional({ example: '9780439023481' })
  @IsOptional()
  @Matches(/^[0-9Xx-]{10,17}$/, { message: 'ISBN không hợp lệ' })
  isbn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  publisher?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(2100)
  publishedYear?: number;

  @ApiProperty({
    description: 'Giá bìa (VND) — dùng tính phạt mất sách',
    example: 120000,
  })
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional() @IsOptional() @IsUrl() coverUrl?: string;
  @ApiProperty() @IsInt() categoryId: number;

  @ApiProperty({ type: [Number], description: 'Ít nhất 1 tác giả' })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  authorIds: number[];
}

export class UpdateBookDto extends PartialType(CreateBookDto) {}

export class ImportBooksDto {
  @ApiProperty({ type: [String], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  isbns: string[];
}
