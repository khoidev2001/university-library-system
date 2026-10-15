import { Module } from '@nestjs/common';
import { CirculationModule } from '../loans/circulation.module';
import { PoliciesModule } from '../policies/policies.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

/** Xuất CSV / Excel cho thủ thư; dùng lại ReportsService (top sách, tồn kho) và chính sách phạt. */
@Module({
  imports: [PoliciesModule, CirculationModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
