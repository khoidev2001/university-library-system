import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiClient } from '../ai/ai.client';
import { FinesController } from '../fines/fines.controller';
import { FinesService } from '../fines/fines.service';
import { PoliciesModule } from '../policies/policies.module';
import { RatingsController } from '../ratings/ratings.controller';
import { RatingsService } from '../ratings/ratings.service';
import { ReportsController } from '../reports/reports.controller';
import { ReportsService } from '../reports/reports.service';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

/** F4 + F6 + F7: mượn/trả/phạt, báo cáo, đánh giá — dùng chung LoanPolicy và AiClient. */
@Module({
  imports: [PoliciesModule],
  controllers: [
    LoansController,
    FinesController,
    RatingsController,
    ReportsController,
  ],
  providers: [
    LoansService,
    FinesService,
    RatingsService,
    ReportsService,
    {
      provide: AiClient,
      useFactory: (config: ConfigService) => new AiClient(config),
      inject: [ConfigService],
    },
  ],
  exports: [
    LoansService,
    FinesService,
    RatingsService,
    ReportsService,
    AiClient,
  ],
})
export class CirculationModule {}
