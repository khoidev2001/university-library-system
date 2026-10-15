import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueryFinesDto } from './dto/fines.dto';
import { FinesService } from './fines.service';

@ApiTags('fines')
@ApiBearerAuth()
@Controller('fines')
export class FinesController {
  constructor(private readonly fines: FinesService) {}

  @Get('me')
  @Roles(Role.READER)
  @ApiOperation({ summary: 'Các khoản phạt của tôi và tổng chưa thanh toán' })
  findMine(@CurrentUser() user: JwtUser) {
    return this.fines.findMine(user.id);
  }

  @Get()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({
    summary: 'Danh sách khoản phạt; mặc định xem cả đã và chưa thu',
  })
  findAll(@Query() query: QueryFinesDto) {
    return this.fines.findAll(query);
  }

  @Post(':id/pay')
  @Roles(Role.LIBRARIAN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Ghi nhận bạn đọc đã nộp tiền phạt' })
  @ApiResponse({ status: 409, description: 'FINE_ALREADY_PAID' })
  pay(@Param('id', ParseIdPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.fines.pay(id, user.id);
  }
}
