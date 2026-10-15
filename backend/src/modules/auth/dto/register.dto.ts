import { ApiProperty } from '@nestjs/swagger';
import { MemberType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsPasswordValue } from '../../../common/password.util';

/** Quy tắc mã sinh viên / giảng viên / mã thẻ, dùng chung cho đăng ký và thủ thư tạo bạn đọc. */
export const MEMBER_CODE_PATTERN = /^[A-Za-z0-9-]{3,30}$/;

export class RegisterDto {
  @ApiProperty({ example: 'sv001@student.muce.edu.vn' })
  @IsEmail()
  email: string;

  @IsPasswordValue()
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ enum: MemberType, example: MemberType.STUDENT })
  @IsEnum(MemberType)
  memberType: MemberType;

  @ApiProperty({
    example: '23Q74802012006',
    description: 'Mã sinh viên / giảng viên',
  })
  @IsString()
  @Matches(MEMBER_CODE_PATTERN, {
    message: 'memberCode chỉ gồm chữ, số, dấu gạch ngang (3-30 ký tự)',
  })
  memberCode: string;
}
