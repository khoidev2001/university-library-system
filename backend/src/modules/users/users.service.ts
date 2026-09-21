import { Injectable, NotFoundException } from '@nestjs/common';
import { LoanStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Page, toPage } from '../../common/dto/pagination.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { BCRYPT_ROUNDS } from '../auth/auth.service';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateStaffDto, QueryUsersDto, UpdateUserDto } from './dto/users.dto';

export interface UserDetail extends UserResponseDto {
  activeLoans: number;
  overdueLoans: number;
  unpaidFines: number;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** FR-USER-01 */
  async findAll(query: QueryUsersDto): Promise<Page<UserResponseDto>> {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      isActive: query.isActive,
      ...(query.q && {
        OR: [
          { fullName: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
          { memberCode: { contains: query.q, mode: 'insensitive' } },
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
        where: { userId: id, status: LoanStatus.ACTIVE, dueAt: { lt: now } },
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

  /** FR-USER-03, FR-USER-04 */
  async update(id: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
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
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists)
      throw new BusinessException('EMAIL_EXISTS', 'Email đã được đăng ký');
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        fullName: dto.fullName,
        role: dto.role,
      },
    });
    return UserResponseDto.from(user);
  }
}
