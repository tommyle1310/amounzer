import { Module } from '@nestjs/common';
import { BadDebtService } from './bad-debt.service';
import { BadDebtController } from './bad-debt.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [BadDebtController],
  providers: [BadDebtService],
  exports: [BadDebtService],
})
export class BadDebtModule {}
