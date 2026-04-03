import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FinancialReportsService } from './financial-reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';

@Controller('financial-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialReportsController {
  constructor(private financialReportsService: FinancialReportsService) {}

  @Get('balance-sheet')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getBalanceSheet(
    @Request() req: { companyId: string },
    @Query('asOfDate') asOfDate: string,
    @Query('comparePriorPeriod') comparePriorPeriod?: string,
  ) {
    return this.financialReportsService.getBalanceSheet(
      req.companyId,
      asOfDate,
      comparePriorPeriod === 'true',
    );
  }

  @Get('income-statement')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getIncomeStatement(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('comparePriorPeriod') comparePriorPeriod?: string,
  ) {
    return this.financialReportsService.getIncomeStatement(
      req.companyId,
      startDate,
      endDate,
      comparePriorPeriod === 'true',
    );
  }

  @Get('cash-flow')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getCashFlowStatement(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('method') method?: 'direct' | 'indirect',
  ) {
    return this.financialReportsService.getCashFlowStatement(
      req.companyId,
      startDate,
      endDate,
      method,
    );
  }

  @Get('notes')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getFinancialNotes(
    @Request() req: { companyId: string },
    @Query('fiscalYearId') fiscalYearId: string,
  ) {
    return this.financialReportsService.getFinancialNotes(req.companyId, fiscalYearId);
  }

  @Get('depreciation')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getDepreciationReport(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financialReportsService.getDepreciationReport(req.companyId, startDate, endDate);
  }

  @Get('annual-package')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getAnnualPackage(
    @Request() req: { companyId: string },
    @Query('fiscalYearId') fiscalYearId: string,
  ) {
    return this.financialReportsService.getAnnualPackage(req.companyId, fiscalYearId);
  }

  // ── Management Reports ──

  @Get('aging')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getAgingReport(
    @Request() req: { companyId: string },
    @Query('asOfDate') asOfDate: string,
    @Query('type') type?: 'receivable' | 'payable',
  ) {
    return this.financialReportsService.getAgingReport(req.companyId, asOfDate, type || 'receivable');
  }

  @Get('revenue')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getRevenueReport(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financialReportsService.getRevenueReport(req.companyId, startDate, endDate);
  }

  @Get('expenses')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getExpensesReport(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financialReportsService.getExpensesReport(req.companyId, startDate, endDate);
  }

  @Get('trends')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getTrendsReport(
    @Request() req: { companyId: string },
    @Query('year') year: string,
  ) {
    return this.financialReportsService.getTrendsReport(req.companyId, year);
  }

  @Get('cash-flow-analysis')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getCashFlowAnalysis(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financialReportsService.getCashFlowAnalysis(req.companyId, startDate, endDate);
  }

  // ── TT99/2025 Compliance Reports ──

  /**
   * S06-DN: Trial Balance (Bảng cân đối số phát sinh)
   * Shows opening balance, period movements, and closing balance
   */
  @Get('trial-balance')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getTrialBalance(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('showTree') showTree?: string,
    @Query('accountLevel') accountLevel?: string,
    @Query('showZeroBalance') showZeroBalance?: string,
  ) {
    return this.financialReportsService.getTrialBalance(
      req.companyId,
      startDate,
      endDate,
      {
        showTree: showTree !== 'false',
        accountLevel: accountLevel ? parseInt(accountLevel, 10) : undefined,
        showZeroBalance: showZeroBalance === 'true',
      },
    );
  }

  /**
   * Partner Ledger - detailed transaction history for a customer or vendor
   * Used for B09-DN Notes disclosure requirements
   */
  @Get('partner-ledger/:partnerId')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getPartnerLedger(
    @Request() req: { companyId: string },
    @Param('partnerId') partnerId: string,
    @Query('type') partnerType: 'customer' | 'vendor',
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financialReportsService.getPartnerLedger(
      req.companyId,
      partnerId,
      partnerType || 'customer',
      startDate,
      endDate,
    );
  }

  /**
   * Bank Account Detail - required for Notes disclosure when balance >= 10%
   * TK 112 (Tiền gửi không kỳ hạn) breakdown by bank
   */
  @Get('bank-detail')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getBankAccountDetail(
    @Request() req: { companyId: string },
    @Query('asOfDate') asOfDate: string,
  ) {
    return this.financialReportsService.getBankAccountDetail(req.companyId, asOfDate);
  }

  // ── Debug endpoint ──

  @Get('_debug/data-check')
  @Roles('ADMIN', 'ACCOUNTANT')
  async debugDataCheck(@Request() req: { companyId: string }) {
    return this.financialReportsService.debugDataCheck(req.companyId);
  }
}
