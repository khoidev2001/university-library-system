import { Injectable, NotFoundException } from '@nestjs/common';
import { LoanPolicy, MemberType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePolicyDto } from './dto/policies.dto';

/** Chính sách mặc định (SRS 3.4) — dùng khi seed và khi bảng chưa có dòng cho member_type. */
export const DEFAULT_POLICIES: Record<MemberType, Omit<LoanPolicy, 'id'>> = {
  STUDENT: {
    memberType: 'STUDENT',
    maxBooks: 3,
    loanDays: 14,
    renewLimit: 1,
    renewExtraDays: 7,
    finePerDay: 5000,
  },
  LECTURER: {
    memberType: 'LECTURER',
    maxBooks: 5,
    loanDays: 30,
    renewLimit: 1,
    renewExtraDays: 14,
    finePerDay: 5000,
  },
};

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<LoanPolicy[]> {
    return this.prisma.loanPolicy.findMany({ orderBy: { memberType: 'asc' } });
  }

  /** Luôn trả về một chính sách: dòng trong DB, hoặc mặc định nếu chưa cấu hình. */
  async getFor(
    memberType: MemberType,
  ): Promise<Omit<LoanPolicy, 'id'> & { id?: number }> {
    const policy = await this.prisma.loanPolicy.findUnique({
      where: { memberType },
    });
    return policy ?? DEFAULT_POLICIES[memberType];
  }

  /** FR-POLICY-01/02: chỉ phiếu tạo sau khi sửa mới dùng chính sách mới (BR-10). */
  async update(
    memberType: MemberType,
    dto: UpdatePolicyDto,
  ): Promise<LoanPolicy> {
    const existing = await this.prisma.loanPolicy.findUnique({
      where: { memberType },
    });
    if (!existing)
      throw new NotFoundException('Chưa có chính sách cho loại bạn đọc này');
    return this.prisma.loanPolicy.update({ where: { memberType }, data: dto });
  }
}
