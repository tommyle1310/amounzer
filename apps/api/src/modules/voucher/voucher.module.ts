import { Module } from '@nestjs/common';
import { VoucherService } from './voucher.service';
import { VoucherController } from './voucher.controller';
import { AuditModule } from '../audit/audit.module';
import { JournalEntryModule } from '../journal-entry/journal-entry.module';

@Module({
  imports: [AuditModule, JournalEntryModule],
  controllers: [VoucherController],
  providers: [VoucherService],
  exports: [VoucherService],
})
export class VoucherModule {}
