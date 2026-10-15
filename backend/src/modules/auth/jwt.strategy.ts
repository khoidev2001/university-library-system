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
   * và vai trò lấy từ DB chứ không tin token — hạ quyền / khoá thẻ có hiệu lực ngay.
   */
  async validate(payload: JwtPayload): Promise<JwtUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, memberType: true, isActive: true },
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('Tài khoản không còn hiệu lực');
    return { id: user.id, role: user.role, memberType: user.memberType };
  }
}
