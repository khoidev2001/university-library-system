import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { LoansByMonthQueryDto, TopBooksQueryDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.LIBRARIAN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('top-books')
  @ApiOperation({ summary: 'Sách được mượn nhiều nhất trong khoảng thời gian' })
  topBooks(@Query() query: TopBooksQueryDto) {
    return this.reports.topBooks(query);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Bạn đọc đang quá hạn kèm số ngày trễ và phạt ước tính' })
  overdue() {
    return this.reports.overdueReaders();
  }

  @Get('loans-by-month')
  @ApiOperation({ summary: 'Số lượt mượn theo tháng' })
  loansByMonth(@Query() query: LoansByMonthQueryDto) {
    return this.reports.loansByMonth(query.months);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Tồn kho theo thể loại' })
  inventory() {
    return this.reports.inventoryByCategory();
  }
}
