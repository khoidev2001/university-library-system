import {
  Body,
  Controller,
  Get,
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
import { Role } from '@prisma/client';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateStaffDto, QueryUsersDto, UpdateUserDto } from './dto/users.dto';
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

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin tạo tài khoản LIBRARIAN / ADMIN' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'EMAIL_EXISTS' })
  createStaff(@Body() dto: CreateStaffDto) {
    return this.users.createStaff(dto);
  }
}
