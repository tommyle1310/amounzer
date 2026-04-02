import { Module } from '@nestjs/common';
import { AccountingBooksService } from './accounting-books.service';
import { AccountingBooksController } from './accounting-books.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [AccountingBooksController],
  providers: [AccountingBooksService],
  exports: [AccountingBooksService],
})
export class AccountingBooksModule {}
