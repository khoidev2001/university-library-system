import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { CopiesService } from './copies.service';
import { LabelCopiesQueryDto, UpdateCopyDto } from './dto/copies.dto';

@ApiTags('copies')
@ApiBearerAuth()
@Controller('copies')
export class CopiesController {
  constructor(private readonly copies: CopiesService) {}

  @Get('labels')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({
    summary:
      'Bản sao kèm tiêu đề sách để in nhãn mã vạch (lọc theo bookIds và / hoặc copyIds, tối đa 2000 bản)',
  })
  labels(@Query() query: LabelCopiesQueryDto) {
    return this.copies.findForLabels(query);
  }

  @Patch(':id')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Cập nhật trạng thái / vị trí kệ bản sao' })
  @ApiResponse({ status: 409, description: 'COPY_HAS_ACTIVE_LOAN' })
  update(@Param('id', ParseIdPipe) id: number, @Body() dto: UpdateCopyDto) {
    return this.copies.update(id, dto);
  }
}
