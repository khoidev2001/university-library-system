import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { IsEntityId } from '../../../common/dto/entity-id.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryFinesDto extends PaginationDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: 'false = chưa thanh toán',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  paid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  userId?: number;
}
