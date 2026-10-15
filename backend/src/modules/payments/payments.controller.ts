import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { CreatePaymentDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';
import { resolveClientIp } from './vnpay.util';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @Roles(Role.READER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Tạo giao dịch thanh toán phạt qua VNPay; trả paymentUrl để chuyển hướng trình duyệt',
    description:
      'Số tiền tính ở máy chủ từ các khoản phạt chưa trả của chính bạn đọc (fineIds bỏ trống = tất cả). Giao dịch hết hạn sau 15 phút.',
  })
  @ApiResponse({ status: 404, description: 'Khoản phạt không phải của bạn' })
  @ApiResponse({
    status: 409,
    description:
      'NO_UNPAID_FINES | FINE_ALREADY_PAID | FINE_PAYMENT_PENDING | PAYMENT_AMOUNT_TOO_SMALL | PAYMENT_AMOUNT_TOO_LARGE',
  })
  @ApiResponse({ status: 503, description: 'PAYMENT_NOT_CONFIGURED' })
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
  ) {
    const ip = resolveClientIp(
      req.headers['x-forwarded-for'],
      req.socket.remoteAddress,
    );
    return this.payments.create(user.id, dto, ip);
  }

  @Get('me')
  @Roles(Role.READER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lịch sử thanh toán của tôi (mới nhất trước)' })
  findMine(@CurrentUser() user: JwtUser, @Query() query: PaginationDto) {
    return this.payments.findMine(user.id, query);
  }

  // Hai route VNPay gọi phải đứng trước ':id'. Công khai, không JWT; xác thực bằng chữ ký HMAC.
  // Bỏ giới hạn tần suất: IPN đến từ vài IP cố định, return có thể đi qua proxy chung một IP.

  @Public()
  @SkipThrottle()
  @Get('vnpay/ipn')
  @ApiOperation({
    summary: 'IPN của VNPay (máy chủ gọi máy chủ): xác nhận kết quả thanh toán',
    description:
      'Trả JSON {RspCode, Message}: 00 xác nhận, 01 không thấy đơn, 02 đã xác nhận, 04 sai số tiền, 97 sai chữ ký, 99 lỗi khác.',
  })
  ipn(@Req() req: Request) {
    return this.payments.handleIpn(req.query);
  }

  @Public()
  @SkipThrottle()
  @Get('vnpay/return')
  @ApiOperation({
    summary:
      'Trình duyệt quay về từ VNPay; xác minh chữ ký rồi chuyển hướng tới trang kết quả của web',
  })
  async vnpayReturn(@Req() req: Request, @Res() res: Response) {
    res.redirect(302, await this.payments.handleReturn(req.query));
  }

  @Get(':id')
  @Roles(Role.READER, Role.LIBRARIAN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Chi tiết giao dịch (chủ giao dịch hoặc thủ thư)',
  })
  findOne(@Param('id', ParseIdPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.payments.findOne(id, user);
  }

  @Post(':id/cancel')
  @Roles(Role.READER, Role.LIBRARIAN)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Huỷ giao dịch đang chờ để chọn lại khoản phạt hoặc nộp tiền mặt (chủ giao dịch hoặc thủ thư)',
  })
  @ApiResponse({ status: 409, description: 'PAYMENT_NOT_PENDING' })
  cancel(@Param('id', ParseIdPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.payments.cancel(id, user);
  }
}
