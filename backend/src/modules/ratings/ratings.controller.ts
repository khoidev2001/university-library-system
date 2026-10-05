import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RateBookDto } from './dto/ratings.dto';
import { RatingsService } from './ratings.service';

@ApiTags('ratings')
@Controller('books/:id/ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.READER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Chấm 1–5 sao cho sách đã mượn và trả (chấm lại sẽ ghi đè)' })
  @ApiResponse({ status: 403, description: 'NOT_BORROWED' })
  rate(@Param('id', ParseIntPipe) bookId: number, @Body() dto: RateBookDto, @CurrentUser() user: JwtUser) {
    return this.ratings.rate(user.id, bookId, dto.score);
  }

  @Public()
  @Get('summary')
  @ApiOperation({ summary: 'Điểm trung bình và số lượt đánh giá' })
  summary(@Param('id', ParseIntPipe) bookId: number) {
    return this.ratings.summary(bookId);
  }
}
