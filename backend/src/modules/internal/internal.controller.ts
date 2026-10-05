import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { InternalKeyGuard } from './internal-key.guard';
import { InternalService } from './internal.service';

@ApiTags('internal')
@Public() // không dùng JWT; bảo vệ bằng InternalKeyGuard
@UseGuards(InternalKeyGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly internal: InternalService) {}

  @Get('training-data')
  @ApiHeader({ name: 'X-Internal-Key', required: true })
  @ApiOperation({ summary: 'Dữ liệu huấn luyện cho AI Service (sách, bạn đọc, lượt mượn, đánh giá)' })
  trainingData() {
    return this.internal.trainingData();
  }
}
