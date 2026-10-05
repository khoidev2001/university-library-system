import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BorrowDto, QueryLoansDto } from './dto/loans.dto';
import { LoansService } from './loans.service';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Post()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({
    summary:
      'Cho mượn tại quầy bằng mã vạch + mã bạn đọc; kèm dự báo nguy cơ trả trễ',
  })
  @ApiResponse({
    status: 201,
    description:
      '{ loan, overdueRisk } — overdueRisk có thể null khi AI không sẵn sàng',
  })
  @ApiResponse({
    status: 409,
    description:
      'NOT_A_READER | ACCOUNT_LOCKED | COPY_NOT_AVAILABLE | LOAN_LIMIT_REACHED | HAS_OVERDUE_LOAN | UNPAID_FINE',
  })
  borrow(@Body() dto: BorrowDto, @CurrentUser() user: JwtUser) {
    return this.loans.borrow(dto, user.id);
  }

  @Get('me')
  @Roles(Role.READER)
  @ApiOperation({ summary: 'Sách tôi đang mượn và lịch sử' })
  findMine(@CurrentUser() user: JwtUser, @Query() query: QueryLoansDto) {
    return this.loans.findMine(user.id, query);
  }

  @Get()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({
    summary: 'Tra cứu phiếu mượn; lọc theo trạng thái, quá hạn, bạn đọc',
  })
  findMany(@Query() query: QueryLoansDto) {
    return this.loans.findMany(query);
  }

  @Get(':id')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Chi tiết phiếu mượn' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.loans.findOne(id);
  }

  @Post(':id/return')
  @Roles(Role.LIBRARIAN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Nhận trả sách; tự tạo phiếu phạt nếu trả trễ' })
  @ApiResponse({ status: 409, description: 'LOAN_NOT_ACTIVE' })
  returnCopy(@Param('id', ParseIntPipe) id: number) {
    return this.loans.returnCopy(id);
  }

  @Post(':id/report-lost')
  @Roles(Role.LIBRARIAN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Ghi nhận mất sách; phạt = giá bìa + phạt trễ' })
  @ApiResponse({ status: 409, description: 'LOAN_NOT_ACTIVE' })
  reportLost(@Param('id', ParseIntPipe) id: number) {
    return this.loans.reportLost(id);
  }

  @Post(':id/renew')
  @Roles(Role.READER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Bạn đọc tự gia hạn phiếu của mình' })
  @ApiResponse({
    status: 409,
    description:
      'LOAN_NOT_ACTIVE | LOAN_OVERDUE_CANNOT_RENEW | RENEW_LIMIT_REACHED | UNPAID_FINE',
  })
  renew(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.loans.renew(id, user.id);
  }
}
