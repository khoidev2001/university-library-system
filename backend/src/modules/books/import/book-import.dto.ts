import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { OnDuplicate } from './book-import.types';

export class ImportFileQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      'true = chỉ kiểm tra và trả bản xem trước theo từng dòng, KHÔNG ghi gì vào cơ sở dữ liệu',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  dryRun = false;

  @ApiPropertyOptional({
    enum: ['skip', 'update'],
    default: 'skip',
    description:
      'Khi ISBN đã có trong kho: skip = bỏ qua, update = cập nhật các trường có giá trị và bổ sung bản sao còn thiếu',
  })
  @IsOptional()
  @IsIn(['skip', 'update'])
  onDuplicate: OnDuplicate = 'skip';
}

export class ImportTemplateQueryDto {
  @ApiPropertyOptional({ enum: ['csv', 'xlsx'], default: 'csv' })
  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format: 'csv' | 'xlsx' = 'csv';
}
