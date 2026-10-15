import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsPasswordValue } from '../../../common/password.util';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mật khẩu hiện tại' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  currentPassword: string;

  @IsPasswordValue()
  newPassword: string;
}

/** Chỉ hai trường này tự sửa được; vai trò, email, mã thẻ bị `forbidNonWhitelisted` chặn. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Nhận email nhắc hạn trả sách' })
  @IsOptional()
  @IsBoolean()
  emailReminders?: boolean;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'sv001@student.muce.edu.vn' })
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token trong liên kết email' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{20,100}$/, { message: 'Token không hợp lệ' })
  token: string;

  @IsPasswordValue()
  newPassword: string;
}
