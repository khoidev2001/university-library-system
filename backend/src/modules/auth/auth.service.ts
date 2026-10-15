import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt.strategy';

export const BCRYPT_ROUNDS = 10;

/** Email lưu và tra cứu theo chữ thường, bỏ khoảng trắng hai đầu. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Băm giả để email không tồn tại cũng tốn thời gian như sai mật khẩu (chống dò email qua độ trễ). */
const DUMMY_HASH = bcrypt.hashSync('uls-timing-equalizer', BCRYPT_ROUNDS);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** FR-AUTH-01: tài khoản tự đăng ký luôn là READER. */
  async register(dto: RegisterDto): Promise<UserResponseDto> {
    // Email / mã bạn đọc không phân biệt hoa thường: "A@x.vn" và "a@x.vn" là một tài khoản.
    const email = normalizeEmail(dto.email);
    const [emailTaken, codeTaken] = await Promise.all([
      this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      }),
      this.prisma.user.findFirst({
        where: { memberCode: { equals: dto.memberCode, mode: 'insensitive' } },
      }),
    ]);
    if (emailTaken)
      throw new BusinessException('EMAIL_EXISTS', 'Email đã được đăng ký');
    if (codeTaken)
      throw new BusinessException(
        'MEMBER_CODE_EXISTS',
        'Mã sinh viên / giảng viên đã được đăng ký',
      );

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        fullName: dto.fullName,
        role: Role.READER,
        memberType: dto.memberType,
        memberCode: dto.memberCode,
      },
    });
    return UserResponseDto.from(user);
  }

  /** FR-AUTH-02, FR-AUTH-05: không tiết lộ email có tồn tại hay không. */
  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; user: UserResponseDto }> {
    const email = normalizeEmail(dto.email);
    // Email lưu chữ thường; tài khoản cũ lưu chữ hoa thì tìm lại không phân biệt hoa thường.
    const user =
      (await this.prisma.user.findUnique({ where: { email } })) ??
      (await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      }));
    const matches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !matches) {
      throw new BusinessException(
        'INVALID_CREDENTIALS',
        'Email hoặc mật khẩu không đúng',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!user.isActive) {
      throw new BusinessException(
        'ACCOUNT_LOCKED',
        'Tài khoản đã bị khoá',
        HttpStatus.FORBIDDEN,
      );
    }
    return { accessToken: this.sign(user), user: UserResponseDto.from(user) };
  }

  async me(userId: number): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return UserResponseDto.from(user);
  }

  sign(user: Pick<User, 'id' | 'role' | 'memberType'>): string {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      memberType: user.memberType,
    };
    return this.jwt.sign(payload);
  }
}
