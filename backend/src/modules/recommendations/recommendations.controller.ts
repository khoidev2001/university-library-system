import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RecommendationsService } from './recommendations.service';

export class RecommendQueryDto {
  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  k = 10;
}

@ApiTags('recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get('me')
  @Roles(Role.READER)
  @ApiOperation({
    summary:
      'Sách gợi ý cho tôi; AI lỗi thì trả sách mượn nhiều (source = POPULAR)',
  })
  forMe(@CurrentUser() user: JwtUser, @Query() query: RecommendQueryDto) {
    return this.recommendations.forUser(user.id, query.k);
  }

  @Post('train')
  @Roles(Role.ADMIN)
  @HttpCode(202)
  @ApiOperation({ summary: 'Yêu cầu AI Service huấn luyện lại mô hình' })
  @ApiResponse({ status: 503, description: 'AI_UNAVAILABLE' })
  train() {
    return this.recommendations.train();
  }

  @Get('metrics')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({
    summary: 'Số đo mô hình (Precision@5, ROC-AUC…) để đưa vào báo cáo',
  })
  metrics() {
    return this.recommendations.metrics();
  }

  @Get('overdue-accuracy')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({
    summary: 'Đối chiếu dự báo trả trễ đã lưu với kết quả thực tế',
  })
  overdueAccuracy() {
    return this.recommendations.overdueAccuracy();
  }
}
