import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberType, Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdatePolicyDto } from './dto/policies.dto';
import { PoliciesService } from './policies.service';

@ApiTags('policies')
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Chính sách mượn theo loại bạn đọc' })
  findAll() {
    return this.policies.findAll();
  }

  @Patch(':memberType')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Admin sửa chính sách mượn (áp dụng cho phiếu tạo sau)',
  })
  update(
    @Param('memberType', new ParseEnumPipe(MemberType)) memberType: MemberType,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.policies.update(memberType, dto);
  }
}
