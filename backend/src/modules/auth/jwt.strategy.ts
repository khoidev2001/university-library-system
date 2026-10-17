import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { MemberType, Role } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: number;
  role: Role;
  memberType: MemberType | null;
  /** Thời điểm cấp (giây, do thư viện jsonwebtoken tự thêm). */
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Token còn hạn chưa đủ: tài khoản phải còn tồn tại và chưa bị khoá (FR-AUTH-05),
   * và vai trò lấy từ DB chứ không tin token, hạ quyền / khoá thẻ có hiệu lực ngay.
   */
  async validate(payload: JwtPayload): Promise<JwtUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        memberType: true,
        isActive: true,
        mustChangePassword: true,
        sessionsRevokedAt: true,
      },
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('Tài khoản không còn hiệu lực');
    // Mật khẩu vừa được đặt lại (quên mật khẩu / thủ thư cấp lại): phiên cũ không còn hiệu lực.
    // So theo giây như `iat`; token cấp ngay sau lúc đặt lại (cùng giây) vẫn hợp lệ.
    if (
      user.sessionsRevokedAt &&
      payload.iat !== undefined &&
      payload.iat < Math.floor(user.sessionsRevokedAt.getTime() / 1000)
    )
      throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
    return {
      id: user.id,
      role: user.role,
      memberType: user.memberType,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
