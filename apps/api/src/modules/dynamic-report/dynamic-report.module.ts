import { Module } from '@nestjs/common';
import { DynamicReportService } from './dynamic-report.service';
import { DynamicReportController } from './dynamic-report.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [DynamicReportController],
  providers: [DynamicReportService],
  exports: [DynamicReportService],
})
export class DynamicReportModule {}
