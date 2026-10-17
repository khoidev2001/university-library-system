import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MemberType, Role, User } from '@prisma/client';

/** Hình chiếu User an toàn, không bao giờ chứa passwordHash (NFR-SEC-01). */
export class UserResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() email: string;
  @ApiProperty() fullName: string;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiPropertyOptional({ enum: MemberType, nullable: true })
  memberType: MemberType | null;
  @ApiPropertyOptional({ nullable: true }) memberCode: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ description: 'Nhận email nhắc hạn trả sách' })
  emailReminders: boolean;
  @ApiProperty({
    description:
      'true = đang dùng mật khẩu tạm, phải đổi qua POST /auth/change-password trước khi dùng các API khác',
  })
  mustChangePassword: boolean;
  @ApiPropertyOptional({ nullable: true }) passwordChangedAt: Date | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Lần đăng nhập gần nhất',
  })
  lastLoginAt: Date | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Lần đăng nhập trước lần gần nhất',
  })
  previousLoginAt: Date | null;

  /**
   * Chọn từng trường một (không dùng "bỏ passwordHash khỏi phần còn lại"): thêm cột nhạy cảm vào
   * User sau này, như sessionsRevokedAt, sẽ không tự lộ ra API.
   */
  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      memberType: user.memberType,
      memberCode: user.memberCode,
      isActive: user.isActive,
      createdAt: user.createdAt,
      emailReminders: user.emailReminders,
      mustChangePassword: user.mustChangePassword,
      passwordChangedAt: user.passwordChangedAt,
      lastLoginAt: user.lastLoginAt,
      previousLoginAt: user.previousLoginAt,
    };
  }
}
