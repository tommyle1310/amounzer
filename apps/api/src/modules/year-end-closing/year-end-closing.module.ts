import { Module } from '@nestjs/common';
import { YearEndClosingService } from './year-end-closing.service';
import { YearEndClosingController } from './year-end-closing.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [YearEndClosingController],
  providers: [YearEndClosingService],
  exports: [YearEndClosingService],
})
export class YearEndClosingModule {}
