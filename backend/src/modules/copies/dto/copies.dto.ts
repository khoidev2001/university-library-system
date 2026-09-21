import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CopyStatus } from '@prisma/client';
import {
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
