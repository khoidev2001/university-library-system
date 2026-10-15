import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { IsEntityId } from '../../../common/dto/entity-id.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateReservationDto {
  @ApiProperty({ example: 1, description: 'Mã đầu sách cần đặt' })
  @IsEntityId()
  bookId: number;
}

export class QueryReservationsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  bookId?: number;
}
