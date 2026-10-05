import { Module } from '@nestjs/common';
import { CirculationModule } from '../loans/circulation.module';
import { InternalController } from '../internal/internal.controller';
import { InternalKeyGuard } from '../internal/internal-key.guard';
import { InternalService } from '../internal/internal.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

/** F9 + endpoint nội bộ cấp dữ liệu huấn luyện; AiClient dùng lại từ CirculationModule. */
@Module({
  imports: [CirculationModule],
  controllers: [RecommendationsController, InternalController],
  providers: [RecommendationsService, InternalService, InternalKeyGuard],
})
export class RecommendationsModule {}
