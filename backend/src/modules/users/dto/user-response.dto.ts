import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MemberType, Role, User } from '@prisma/client';

/** Hình chiếu User an toàn — không bao giờ chứa passwordHash (NFR-SEC-01). */
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

  static from(user: User): UserResponseDto {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
