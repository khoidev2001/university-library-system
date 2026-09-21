import { Body, Controller, Param, ParseIntPipe, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CopiesService } from './copies.service';
import { UpdateCopyDto } from './dto/copies.dto';

@ApiTags('copies')
@ApiBearerAuth()
@Controller('copies')
export class CopiesController {
  constructor(private readonly copies: CopiesService) {}

  @Patch(':id')
  @Roles(Role.LIBRARIAN)
  @ApiOperation({ summary: 'Cập nhật trạng thái / vị trí kệ bản sao' })
  @ApiResponse({ status: 409, description: 'COPY_HAS_ACTIVE_LOAN' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCopyDto) {
    return this.copies.update(id, dto);
  }
}
