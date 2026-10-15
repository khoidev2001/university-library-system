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
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { MEMBER_CODE_PATTERN } from '../../auth/dto/register.dto';
import { UserResponseDto } from './user-response.dto';

export class QueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên, email, mã SV/GV' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
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

/** Thủ thư tạo bạn đọc tại quầy: không nhập mật khẩu, hệ thống sinh mật khẩu tạm. */
export class CreateReaderDto {
  @ApiProperty({ example: 'sv002@student.muce.edu.vn' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Trần Thị B' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ enum: MemberType, example: MemberType.STUDENT })
  @IsEnum(MemberType)
  memberType: MemberType;

  @ApiPropertyOptional({
    example: '23Q74802012007',
    description: 'Bỏ trống để hệ thống tự sinh mã duy nhất (dạng DG26xxxxxx)',
  })
  @IsOptional()
  @IsString()
  @Matches(MEMBER_CODE_PATTERN, {
    message: 'memberCode chỉ gồm chữ, số, dấu gạch ngang (3-30 ký tự)',
  })
  memberCode?: string;
}

/** Kết quả cấp mật khẩu tạm: mật khẩu chỉ hiện đúng một lần, không lưu dạng đọc được. */
export class TemporaryPasswordResultDto {
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
  @ApiProperty({
    description:
      'Mật khẩu tạm, chỉ trả một lần; người dùng phải đổi khi đăng nhập',
  })
  temporaryPassword: string;
}

export class CreateReaderResultDto extends TemporaryPasswordResultDto {
  @ApiProperty({
    description:
      'true nếu đã xếp hàng gửi email chào mừng (chỉ khi cấu hình Resend)',
  })
  welcomeEmailQueued: boolean;
}
