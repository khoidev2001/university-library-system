import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateReservationDto,
  QueryReservationsDto,
} from './dto/reservations.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post()
  @Roles(Role.READER)
  @ApiOperation({ summary: 'Đặt trước sách đang hết bản trên kệ' })
  @ApiResponse({
    status: 409,
    description:
      'NO_COPIES | BOOK_AVAILABLE | ALREADY_BORROWING | ALREADY_RESERVED | RESERVATION_LIMIT | UNPAID_FINE',
  })
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateReservationDto) {
    return this.reservations.create(user.id, dto.bookId);
  }

  @Get('me')
  @Roles(Role.READER)
  @ApiOperation({ summary: 'Đặt trước của tôi, kèm vị trí hàng đợi' })
  findMine(@CurrentUser() user: JwtUser) {
    return this.reservations.findMine(user.id);
  }

  @Get()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Hàng đợi đặt trước (thủ thư)' })
  findMany(@Query() query: QueryReservationsDto) {
    return this.reservations.findMany(query);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Huỷ đặt trước (bạn đọc: của mình; thủ thư: bất kỳ)',
  })
  cancel(@Param('id', ParseIdPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.reservations.cancel(id, user.id, user.role);
  }
}
