import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiClient } from '../ai/ai.client';
import { FinesController } from '../fines/fines.controller';
import { FinesService } from '../fines/fines.service';
import { CirculationScheduler } from '../notifications/circulation.scheduler';
import { NotificationsController } from '../notifications/notifications.controller';
import { NotificationsService } from '../notifications/notifications.service';
import { ReminderEmailService } from '../notifications/reminder-email.service';
import { PaymentsModule } from '../payments/payments.module';
import { PoliciesModule } from '../policies/policies.module';
import { ReservationsController } from '../reservations/reservations.controller';
import { ReservationsService } from '../reservations/reservations.service';
import { RatingsController } from '../ratings/ratings.controller';
import { RatingsService } from '../ratings/ratings.service';
import { ReportsController } from '../reports/reports.controller';
import { ReportsService } from '../reports/reports.service';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

/** F4 + F6 + F7: mượn/trả/phạt, báo cáo, đánh giá — dùng chung LoanPolicy và AiClient. */
@Module({
  imports: [PoliciesModule, PaymentsModule],
  controllers: [
    LoansController,
    FinesController,
    RatingsController,
    ReportsController,
    ReservationsController,
    NotificationsController,
  ],
  providers: [
    LoansService,
    FinesService,
    RatingsService,
    ReportsService,
    ReservationsService,
    NotificationsService,
    ReminderEmailService,
    CirculationScheduler,
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
    ReservationsService,
    NotificationsService,
    ReminderEmailService,
    AiClient,
  ],
})
export class CirculationModule {}
