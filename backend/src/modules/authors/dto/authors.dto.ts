import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAuthorsDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
}

export class AuthorDto {
  @ApiProperty({ example: 'Nguyễn Nhật Ánh' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;
}
