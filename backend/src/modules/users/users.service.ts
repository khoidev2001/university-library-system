import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { LoanStatus, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { overdueCutoff } from '../../common/date.util';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { Page, toPage } from '../../common/dto/pagination.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { likePattern } from '../../common/sql.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  generateMemberCode,
  generateTemporaryPassword,
} from '../../common/password.util';
import { BCRYPT_ROUNDS, normalizeEmail } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { welcomeReaderEmail } from '../mail/mail.templates';
import { UserResponseDto } from './dto/user-response.dto';
import {
  CreateReaderDto,
  CreateReaderResultDto,
  CreateStaffDto,
  QueryUsersDto,
  TemporaryPasswordResultDto,
  UpdateUserDto,
} from './dto/users.dto';

export interface UserDetail extends UserResponseDto {
  activeLoans: number;
  overdueLoans: number;
  unpaidFines: number;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** FR-USER-01 */
  async findAll(query: QueryUsersDto): Promise<Page<UserResponseDto>> {
    const q = likePattern(query.q);
    const where: Prisma.UserWhereInput = {
      role: query.role,
      isActive: query.isActive,
      ...(q && {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { memberCode: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return toPage(items.map(UserResponseDto.from), total, query);
  }

  /** FR-USER-02: hồ sơ kèm số sách đang mượn, quá hạn, phạt chưa trả. */
  async findOne(id: number): Promise<UserDetail> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    const now = new Date();
    const [activeLoans, overdueLoans, fines] = await Promise.all([
      this.prisma.loan.count({
        where: { userId: id, status: LoanStatus.ACTIVE },
      }),
      this.prisma.loan.count({
        where: {
          userId: id,
          status: LoanStatus.ACTIVE,
          dueAt: { lt: overdueCutoff(now) },
        },
      }),
      this.prisma.fine.aggregate({
        _sum: { amount: true },
        where: { loan: { userId: id }, paidAt: null },
      }),
    ]);
    return {
      ...UserResponseDto.from(user),
      activeLoans,
      overdueLoans,
      unpaidFines: fines._sum.amount ?? 0,
    };
  }

  /**
   * FR-USER-03, FR-USER-04. Thủ thư chỉ khoá/mở thẻ bạn đọc: tài khoản nhân sự do Admin quản lý,
   * và không ai tự khoá chính mình (sẽ mất quyền mà không còn ai mở lại nếu là Admin duy nhất).
   * Khoá thẻ không chặn trả sách: phiếu đang mượn vẫn nhận trả bình thường.
   */
  async update(
    id: number,
    dto: UpdateUserDto,
    actor: Pick<JwtUser, 'id' | 'role'>,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (user.role !== Role.READER && actor.role !== Role.ADMIN) {
      throw new BusinessException(
        'STAFF_ACCOUNT_PROTECTED',
        'Chỉ quản trị viên được sửa tài khoản nhân sự',
        HttpStatus.FORBIDDEN,
      );
    }
    if (dto.isActive === false && actor.id === id) {
      throw new BusinessException(
        'CANNOT_LOCK_SELF',
        'Không thể tự khoá tài khoản của chính mình',
      );
    }
    if (dto.memberType !== undefined && user.role !== 'READER') {
      throw new BusinessException(
        'NOT_A_READER',
        'Chỉ bạn đọc mới có loại bạn đọc',
      );
    }
    const updated = await this.prisma.user.update({ where: { id }, data: dto });
    return UserResponseDto.from(updated);
  }

  /** FR-USER-05: Admin tạo thủ thư / admin. */
  async createStaff(dto: CreateStaffDto): Promise<UserResponseDto> {
    const email = normalizeEmail(dto.email);
    const exists = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (exists)
      throw new BusinessException('EMAIL_EXISTS', 'Email đã được đăng ký');
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        fullName: dto.fullName,
        role: dto.role,
      },
    });
    return UserResponseDto.from(user);
  }

  /**
   * Thủ thư tạo bạn đọc tại quầy. Mật khẩu tạm sinh ngẫu nhiên, trả về đúng một lần,
   * bắt buộc đổi ở lần đăng nhập đầu (mustChangePassword). Mã thẻ bỏ trống thì tự sinh.
   * Thư chào mừng (nếu có cấu hình Resend) KHÔNG chứa mật khẩu.
   */
  async createReader(dto: CreateReaderDto): Promise<CreateReaderResultDto> {
    const email = normalizeEmail(dto.email);
    const emailTaken = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (emailTaken)
      throw new BusinessException('EMAIL_EXISTS', 'Email đã được đăng ký');

    const explicitCode = dto.memberCode?.trim() || undefined;
    if (explicitCode && (await this.memberCodeTaken(explicitCode)))
      throw new BusinessException(
        'MEMBER_CODE_EXISTS',
        'Mã sinh viên / giảng viên đã được đăng ký',
      );

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    // Mã tự sinh có thể trùng (hiếm): thử lại với mã khác; mã do thủ thư nhập mà trùng thì báo lỗi.
    for (let attempt = 0; attempt < 5; attempt++) {
      const memberCode = explicitCode ?? (await this.freshMemberCode());
      try {
        const user = await this.prisma.user.create({
          data: {
            email,
            passwordHash,
            fullName: dto.fullName.trim(),
            role: Role.READER,
            memberType: dto.memberType,
            memberCode,
            mustChangePassword: true,
          },
        });
        const welcomeEmailQueued = this.mail.enabled;
        if (welcomeEmailQueued) {
          this.mail.sendDetached({
            to: user.email,
            ...welcomeReaderEmail({
              fullName: user.fullName,
              email: user.email,
              memberCode,
              loginUrl: `${this.mail.appUrl}/login`,
            }),
          });
        }
        return {
          user: UserResponseDto.from(user),
          temporaryPassword,
          welcomeEmailQueued,
        };
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          String(err.meta?.target).includes('member_code') &&
          !explicitCode
        )
          continue;
        throw err; // email trùng do đua → HttpExceptionFilter đổi thành EMAIL_EXISTS
      }
    }
    throw new BusinessException(
      'MEMBER_CODE_GENERATION_FAILED',
      'Không sinh được mã thẻ duy nhất, hãy thử lại',
    );
  }

  /**
   * Cấp lại mật khẩu (quên mật khẩu mà email không dùng được): sinh mật khẩu tạm, trả đúng một lần,
   * bắt đổi ở lần đăng nhập kế tiếp, thu hồi phiên cũ và token đặt lại còn hiệu lực.
   * Thủ thư chỉ cấp lại cho bạn đọc; tài khoản nhân sự do quản trị viên. Không tự cấp lại cho mình
   * (dùng đổi mật khẩu), vì sẽ làm mất phiên đang dùng.
   */
  async resetPasswordByStaff(
    id: number,
    actor: Pick<JwtUser, 'id' | 'role'>,
  ): Promise<TemporaryPasswordResultDto> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');
    if (target.role !== Role.READER && actor.role !== Role.ADMIN) {
      throw new BusinessException(
        'STAFF_ACCOUNT_PROTECTED',
        'Chỉ quản trị viên được cấp lại mật khẩu tài khoản nhân sự',
        HttpStatus.FORBIDDEN,
      );
    }
    if (target.id === actor.id) {
      throw new BusinessException(
        'CANNOT_RESET_SELF',
        'Hãy dùng chức năng đổi mật khẩu trong trang tài khoản',
      );
    }
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    const now = new Date();
    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          passwordChangedAt: now,
          sessionsRevokedAt: now,
        },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: id, usedAt: null },
        data: { usedAt: now },
      }),
    ]);
    return { user: UserResponseDto.from(user), temporaryPassword };
  }

  private async memberCodeTaken(code: string): Promise<boolean> {
    const found = await this.prisma.user.findFirst({
      where: { memberCode: { equals: code, mode: 'insensitive' } },
      select: { id: true },
    });
    return !!found;
  }

  private async freshMemberCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = generateMemberCode();
      if (!(await this.memberCodeTaken(code))) return code;
    }
    return generateMemberCode();
  }
}
