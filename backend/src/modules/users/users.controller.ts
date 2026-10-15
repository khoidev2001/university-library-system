import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserResponseDto } from './dto/user-response.dto';
import {
  CreateReaderDto,
  CreateReaderResultDto,
  CreateStaffDto,
  QueryUsersDto,
  TemporaryPasswordResultDto,
  UpdateUserDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Danh sách người dùng / bạn đọc (thủ thư)' })
  findAll(@Query() query: QueryUsersDto) {
    return this.users.findAll(query);
  }

  @Get(':id')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({
    summary: 'Hồ sơ bạn đọc: sách đang mượn, quá hạn, phạt chưa trả',
  })
  findOne(@Param('id', ParseIdPipe) id: number) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Khoá/mở thẻ, đổi loại bạn đọc, sửa tên' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({
    status: 403,
    description: 'STAFF_ACCOUNT_PROTECTED (thủ thư sửa tài khoản nhân sự)',
  })
  @ApiResponse({ status: 409, description: 'NOT_A_READER | CANNOT_LOCK_SELF' })
  update(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Post('readers')
  @Roles(Role.LIBRARIAN)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Thủ thư tạo bạn đọc tại quầy, nhận mật khẩu tạm một lần',
    description:
      'memberCode bỏ trống thì tự sinh. Tài khoản có mustChangePassword = true. Nếu đã cấu hình Resend, gửi email chào mừng (không chứa mật khẩu).',
  })
  @ApiResponse({ status: 201, type: CreateReaderResultDto })
  @ApiResponse({
    status: 409,
    description: 'EMAIL_EXISTS | MEMBER_CODE_EXISTS',
  })
  createReader(@Body() dto: CreateReaderDto) {
    return this.users.createReader(dto);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @Roles(Role.LIBRARIAN)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Cấp lại mật khẩu tạm (thủ thư: bạn đọc; quản trị viên: mọi tài khoản)',
    description:
      'Trả mật khẩu tạm đúng một lần, bắt đổi ở lần đăng nhập sau, thu hồi phiên cũ. Dùng khi email chưa cấu hình hoặc người dùng không nhận được thư.',
  })
  @ApiResponse({ status: 200, type: TemporaryPasswordResultDto })
  @ApiResponse({
    status: 403,
    description: 'STAFF_ACCOUNT_PROTECTED (thủ thư cấp lại cho nhân sự)',
  })
  @ApiResponse({ status: 409, description: 'CANNOT_RESET_SELF' })
  resetPassword(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.users.resetPasswordByStaff(id, actor);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin tạo tài khoản LIBRARIAN / ADMIN' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'EMAIL_EXISTS' })
  createStaff(@Body() dto: CreateStaffDto) {
    return this.users.createStaff(dto);
  }
}
