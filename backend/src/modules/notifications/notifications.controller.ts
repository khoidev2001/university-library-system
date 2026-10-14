import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Thông báo của tôi kèm số chưa đọc' })
  listMine(@CurrentUser() user: JwtUser) {
    return this.notifications.listMine(user.id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Đánh dấu đã đọc tất cả' })
  readAll(@CurrentUser() user: JwtUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Đánh dấu đã đọc một thông báo' })
  read(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.markRead(user.id, id);
  }
}
