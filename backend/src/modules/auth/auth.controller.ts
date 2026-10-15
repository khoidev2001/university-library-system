import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { AllowWhenPasswordChangeRequired } from '../../common/decorators/allow-password-change.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto/account.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordResetService } from './password-reset.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản bạn đọc (role READER)' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({
    status: 409,
    description: 'EMAIL_EXISTS | MEMBER_CODE_EXISTS',
  })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Đăng nhập, nhận JWT hạn 24h (tối đa 10 lần/phút)' })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS' })
  @ApiResponse({ status: 403, description: 'ACCOUNT_LOCKED' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @AllowWhenPasswordChangeRequired()
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Thông tin tài khoản hiện tại (kèm mustChangePassword, emailReminders, lần đăng nhập)',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  me(@CurrentUser() user: JwtUser) {
    return this.auth.me(user.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tự sửa hồ sơ: chỉ fullName và emailReminders',
    description:
      'Vai trò, email, mã thẻ không tự sửa được: gửi các trường đó trả 400.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  updateMe(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateMe(user.id, dto);
  }

  @Post('change-password')
  @HttpCode(200)
  @AllowWhenPasswordChangeRequired()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Đổi mật khẩu (tối đa 5 lần/phút)',
    description:
      'Mật khẩu mới theo cùng chính sách với đăng ký (8-72 ký tự) và phải khác mật khẩu hiện tại. Thành công thì tắt cờ mustChangePassword.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({
    status: 400,
    description: 'WRONG_CURRENT_PASSWORD | PASSWORD_UNCHANGED',
  })
  changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Quên mật khẩu: gửi liên kết đặt lại qua email (tối đa 5 lần/phút)',
    description:
      'Luôn trả 200 cùng một nội dung dù email có tồn tại hay không, để không lộ email nào đã đăng ký. Tài khoản bị khoá không nhận thư. Cách nhau ít nhất 60 giây cho mỗi tài khoản.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.passwordReset.requestReset(dto.email);
    return {
      message:
        'Nếu email này đã đăng ký, chúng tôi vừa gửi hướng dẫn đặt lại mật khẩu. Hãy kiểm tra hộp thư (cả mục thư rác).',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Đặt lại mật khẩu bằng token trong email (tối đa 10 lần/phút)',
    description:
      'Token dùng một lần, hạn 1 giờ. Thành công thì mọi phiên đăng nhập cũ bị thu hồi.',
  })
  @ApiResponse({ status: 400, description: 'INVALID_RESET_TOKEN' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordReset.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }
}
