import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class BorrowDto {
  @ApiProperty({ example: 'LIB-000123-1', description: 'Mã vạch bản sao' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{3,40}$/, { message: 'Mã vạch chỉ gồm chữ, số, dấu gạch ngang' })
  barcode: string;

  @ApiProperty({ example: '23Q74802012006', description: 'Mã sinh viên / giảng viên' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{3,30}$/, { message: 'Mã bạn đọc chỉ gồm chữ, số, dấu gạch ngang' })
  memberCode: string;
}

export class QueryLoansDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LoanStatus })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @ApiPropertyOptional({ type: Boolean, description: 'Chỉ phiếu đang quá hạn' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ description: 'Lọc theo bạn đọc (thủ thư)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;
}
