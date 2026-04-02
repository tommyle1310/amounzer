import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { ChartOfAccountsModule } from './modules/chart-of-accounts/chart-of-accounts.module';
import { JournalEntryModule } from './modules/journal-entry/journal-entry.module';
import { AuditModule } from './modules/audit/audit.module';
import { CustomFieldModule } from './modules/custom-field/custom-field.module';
import { VoucherModule } from './modules/voucher/voucher.module';
import { CustomerModule } from './modules/customer/customer.module';
import { VendorModule } from './modules/vendor/vendor.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { FixedAssetModule } from './modules/fixed-asset/fixed-asset.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { VatModule } from './modules/vat/vat.module';
import { BadDebtModule } from './modules/bad-debt/bad-debt.module';
import { AccountingBooksModule } from './modules/accounting-books/accounting-books.module';
import { FinancialReportsModule } from './modules/financial-reports/financial-reports.module';
import { DynamicReportModule } from './modules/dynamic-report/dynamic-report.module';
import { ImportExportModule } from './modules/import-export/import-export.module';
import { YearEndClosingModule } from './modules/year-end-closing/year-end-closing.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    CompanyModule,
    ChartOfAccountsModule,
    JournalEntryModule,
    AuditModule,
    CustomFieldModule,
    VoucherModule,
    CustomerModule,
    VendorModule,
    InventoryModule,
    FixedAssetModule,
    PayrollModule,
    VatModule,
    BadDebtModule,
    AccountingBooksModule,
    FinancialReportsModule,
    DynamicReportModule,
    ImportExportModule,
    YearEndClosingModule,
    HealthModule,
  ],
})
export class AppModule {}
