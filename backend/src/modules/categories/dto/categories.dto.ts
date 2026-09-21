import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Khoa học máy tính' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'khoa-hoc-may-tinh',
    description: 'Tự sinh từ tên nếu bỏ trống',
  })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug chỉ gồm chữ thường, số, dấu gạch ngang',
  })
  slug?: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
