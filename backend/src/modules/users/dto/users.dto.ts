import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MemberType, Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên, email, mã SV/GV' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ enum: MemberType })
  @IsOptional()
  @IsEnum(MemberType)
  memberType?: MemberType;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;
}

export class CreateStaffDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) fullName: string;
  @ApiProperty({ enum: [Role.LIBRARIAN, Role.ADMIN] })
  @IsIn([Role.LIBRARIAN, Role.ADMIN])
  role: Role;
}
