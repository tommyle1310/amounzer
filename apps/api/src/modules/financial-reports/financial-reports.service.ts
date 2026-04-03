import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import * as crypto from 'crypto';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);
const CACHE_TTL = 3600; // 1 hour

interface ReportLineItem {
  code: string;
  name: string;
  amount: Decimal;
  priorAmount?: Decimal;
  children?: ReportLineItem[];
}

@Injectable()
export class FinancialReportsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  private cacheKey(companyId: string, type: string, params: Record<string, unknown>): string {
    const hash = crypto.createHash('md5').update(JSON.stringify(params)).digest('hex');
    return `report:${companyId}:${type}:${hash}`;
  }

  private async getCached<T>(key: string): Promise<T | null> {
    const cached = await this.redisService.get(key);
    if (cached) return JSON.parse(cached) as T;
    return null;
  }

  private async setCache(key: string, data: unknown): Promise<void> {
    await this.redisService.set(key, JSON.stringify(data), CACHE_TTL);
  }

  private async getAccountBalance(
    companyId: string,
    codePrefix: string,
    asOfDate: Date,
  ): Promise<{ accounts: { code: string; name: string; debit: Decimal; credit: Decimal; balance: Decimal }[]; total: Decimal }> {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { companyId, code: { startsWith: codePrefix }, isActive: true },
      orderBy: { code: 'asc' },
    });

    const results: { code: string; name: string; debit: Decimal; credit: Decimal; balance: Decimal }[] = [];
    let total = ZERO;

    for (const account of accounts) {
      const agg = await this.prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: {
            companyId,
            status: 'POSTED',
            postingDate: { lte: asOfDate },
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });

      const debit = agg._sum.debitAmount ?? ZERO;
      const credit = agg._sum.creditAmount ?? ZERO;
      const balance = account.normalBalance === 'DEBIT'
        ? debit.sub(credit)
        : credit.sub(debit);

      results.push({ code: account.code, name: account.name, debit, credit, balance });
      total = total.add(balance);
    }

    return { accounts: results, total };
  }

  private async getPeriodBalance(
    companyId: string,
    codePrefix: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ accounts: { code: string; name: string; debit: Decimal; credit: Decimal; balance: Decimal }[]; total: Decimal }> {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { companyId, code: { startsWith: codePrefix }, isActive: true },
      orderBy: { code: 'asc' },
    });

    const results: { code: string; name: string; debit: Decimal; credit: Decimal; balance: Decimal }[] = [];
    let total = ZERO;

    for (const account of accounts) {
      const agg = await this.prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: {
            companyId,
            status: 'POSTED',
            postingDate: { gte: startDate, lte: endDate },
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });

      const debit = agg._sum.debitAmount ?? ZERO;
      const credit = agg._sum.creditAmount ?? ZERO;
      const balance = account.normalBalance === 'DEBIT'
        ? debit.sub(credit)
        : credit.sub(debit);

      results.push({ code: account.code, name: account.name, debit, credit, balance });
      total = total.add(balance);
    }

    return { accounts: results, total };
  }

  // ── B01-DN: Financial Position Statement (TT99: Báo cáo tình hình tài chính) ──

  async getBalanceSheet(
    companyId: string,
    asOfDate: string,
    comparePriorPeriod?: boolean,
  ) {
    const key = this.cacheKey(companyId, 'balance-sheet', { asOfDate, comparePriorPeriod });
    const cached = await this.getCached(key);
    if (cached) return cached;

    const date = new Date(asOfDate);

    // Assets: TK 1xx (current), TK 2xx (non-current)
    const currentAssets = await this.getAccountBalance(companyId, '1', date);
    const nonCurrentAssets = await this.getAccountBalance(companyId, '2', date);
    
    // TT99: Handle dual-nature accounts (131, 331)
    // TK 131: Debit balance = Receivables (Asset), Credit balance = Advances received (Liability, code 312)
    // TK 331: Credit balance = Payables (Liability), Debit balance = Advances to suppliers (Asset)
    const dualNatureBalances = await this.getDualNatureAccountBalances(companyId, date);
    
    const totalAssets = currentAssets.total
      .add(nonCurrentAssets.total)
      .add(dualNatureBalances.advancesToSuppliers);  // Add debit 331 to assets

    // Liabilities: TK 3xx
    const liabilities = await this.getAccountBalance(companyId, '3', date);

    // Equity: TK 4xx
    const equity = await this.getAccountBalance(companyId, '4', date);
    const totalLiabilitiesAndEquity = liabilities.total
      .add(equity.total)
      .add(dualNatureBalances.advancesReceived);  // Add credit 131 to liabilities

    // Prior period comparison
    let priorPeriod = null;
    if (comparePriorPeriod) {
      const priorDate = new Date(date);
      priorDate.setFullYear(priorDate.getFullYear() - 1);
      const priorCurrentAssets = await this.getAccountBalance(companyId, '1', priorDate);
      const priorNonCurrentAssets = await this.getAccountBalance(companyId, '2', priorDate);
      const priorLiabilities = await this.getAccountBalance(companyId, '3', priorDate);
      const priorEquity = await this.getAccountBalance(companyId, '4', priorDate);
      const priorDualNature = await this.getDualNatureAccountBalances(companyId, priorDate);

      priorPeriod = {
        currentAssets: priorCurrentAssets,
        nonCurrentAssets: priorNonCurrentAssets,
        totalAssets: priorCurrentAssets.total.add(priorNonCurrentAssets.total).add(priorDualNature.advancesToSuppliers),
        liabilities: priorLiabilities,
        equity: priorEquity,
        totalLiabilitiesAndEquity: priorLiabilities.total.add(priorEquity.total).add(priorDualNature.advancesReceived),
        dualNatureBalances: priorDualNature,
      };
    }

    const isBalanced = totalAssets.eq(totalLiabilitiesAndEquity);

    const result = {
      reportType: 'B01-DN',
      // TT99: Updated report name per Circular 99/2025/TT-BTC
      reportName: 'Báo cáo tình hình tài chính',
      reportNameEn: 'Statement of Financial Position',
      asOfDate,
      currentAssets,
      nonCurrentAssets,
      dualNatureBalances,
      totalAssets,
      liabilities,
      equity,
      totalLiabilitiesAndEquity,
      isBalanced,
      priorPeriod,
    };

    await this.setCache(key, result);
    return result;
  }

  /**
   * TT99: Calculate dual-nature account balances
   * Accounts 131 and 331 can have both debit and credit balances that need to be
   * split between Assets and Liabilities on the financial position statement.
   */
  private async getDualNatureAccountBalances(companyId: string, asOfDate: Date) {
    // Get all 131 sub-accounts with their detail balances
    const ar131Accounts = await this.prisma.ledgerAccount.findMany({
      where: { companyId, code: { startsWith: '131' }, isActive: true },
    });
    
    let arDebitTotal = ZERO;  // Receivables (Asset - Code 131)
    let arCreditTotal = ZERO; // Advances received (Liability - Code 312)
    
    for (const account of ar131Accounts) {
      const agg = await this.prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: { companyId, status: 'POSTED', postingDate: { lte: asOfDate } },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });
      
      const debit = agg._sum.debitAmount ?? ZERO;
      const credit = agg._sum.creditAmount ?? ZERO;
      const balance = debit.sub(credit);
      
      if (balance.gt(ZERO)) {
        arDebitTotal = arDebitTotal.add(balance);
      } else if (balance.lt(ZERO)) {
        arCreditTotal = arCreditTotal.add(balance.abs());
      }
    }

    // Get all 331 sub-accounts with their detail balances  
    const ap331Accounts = await this.prisma.ledgerAccount.findMany({
      where: { companyId, code: { startsWith: '331' }, isActive: true },
    });
    
    let apCreditTotal = ZERO;  // Payables (Liability - Code 331)
    let apDebitTotal = ZERO;   // Advances to suppliers (Asset - Code 331 debit)
    
    for (const account of ap331Accounts) {
      const agg = await this.prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: { companyId, status: 'POSTED', postingDate: { lte: asOfDate } },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });
      
      const debit = agg._sum.debitAmount ?? ZERO;
      const credit = agg._sum.creditAmount ?? ZERO;
      const balance = credit.sub(debit);
      
      if (balance.gt(ZERO)) {
        apCreditTotal = apCreditTotal.add(balance);
      } else if (balance.lt(ZERO)) {
        apDebitTotal = apDebitTotal.add(balance.abs());
      }
    }

    return {
      // TK 131 analysis
      accountsReceivable: arDebitTotal,      // Code 131 on Assets
      advancesReceived: arCreditTotal,        // Code 312 on Liabilities (customer prepayments)
      
      // TK 331 analysis  
      accountsPayable: apCreditTotal,         // Code 331 on Liabilities
      advancesToSuppliers: apDebitTotal,      // On Assets (prepayments to vendors)
    };
  }

  // ── B02-DN: Income Statement ──

  async getIncomeStatement(
    companyId: string,
    startDate: string,
    endDate: string,
    comparePriorPeriod?: boolean,
  ) {
    const key = this.cacheKey(companyId, 'income-statement', { startDate, endDate, comparePriorPeriod });
    const cached = await this.getCached(key);
    if (cached) return cached;

    const start = new Date(startDate);
    const end = new Date(endDate);

    const computeStatement = async (s: Date, e: Date) => {
      const revenue = await this.getPeriodBalance(companyId, '511', s, e);
      const cogs = await this.getPeriodBalance(companyId, '632', s, e);
      const grossProfit = revenue.total.sub(cogs.total);

      const financialIncome = await this.getPeriodBalance(companyId, '515', s, e);
      const financialExpense = await this.getPeriodBalance(companyId, '635', s, e);
      const sellingExpense = await this.getPeriodBalance(companyId, '641', s, e);
      const adminExpense = await this.getPeriodBalance(companyId, '642', s, e);

      const operatingProfit = grossProfit
        .add(financialIncome.total)
        .sub(financialExpense.total)
        .sub(sellingExpense.total)
        .sub(adminExpense.total);

      const otherIncome = await this.getPeriodBalance(companyId, '711', s, e);
      const otherExpense = await this.getPeriodBalance(companyId, '811', s, e);
      const otherProfit = otherIncome.total.sub(otherExpense.total);

      const profitBeforeTax = operatingProfit.add(otherProfit);

      const cit = await this.getPeriodBalance(companyId, '821', s, e);
      const netProfit = profitBeforeTax.sub(cit.total);

      return {
        revenue,
        cogs,
        grossProfit,
        financialIncome,
        financialExpense,
        sellingExpense,
        adminExpense,
        operatingProfit,
        otherIncome,
        otherExpense,
        otherProfit,
        profitBeforeTax,
        corporateIncomeTax: cit,
        netProfit,
      };
    };

    const current = await computeStatement(start, end);

    let priorPeriod = null;
    if (comparePriorPeriod) {
      const priorStart = new Date(start);
      priorStart.setFullYear(priorStart.getFullYear() - 1);
      const priorEnd = new Date(end);
      priorEnd.setFullYear(priorEnd.getFullYear() - 1);
      priorPeriod = await computeStatement(priorStart, priorEnd);
    }

    const result = {
      reportType: 'B02-DN',
      reportName: 'Báo cáo kết quả hoạt động kinh doanh',
      startDate,
      endDate,
      ...current,
      priorPeriod,
    };

    await this.setCache(key, result);
    return result;
  }

  // ── B03-DN: Cash Flow Statement ──

  async getCashFlowStatement(
    companyId: string,
    startDate: string,
    endDate: string,
    method: 'direct' | 'indirect' = 'direct',
  ) {
    const key = this.cacheKey(companyId, 'cash-flow', { startDate, endDate, method });
    const cached = await this.getCached(key);
    if (cached) return cached;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Opening cash: TK 111 + TK 112 balance before period
    const cashAccounts = await this.prisma.ledgerAccount.findMany({
      where: {
        companyId,
        OR: [{ code: { startsWith: '111' } }, { code: { startsWith: '112' } }],
      },
    });
    const cashAccountIds = cashAccounts.map((a) => a.id);

    const openingAgg = await this.prisma.journalEntryLine.aggregate({
      where: {
        accountId: { in: cashAccountIds },
        journalEntry: { companyId, status: 'POSTED', postingDate: { lt: start } },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });
    const openingCash = (openingAgg._sum.debitAmount ?? ZERO).sub(openingAgg._sum.creditAmount ?? ZERO);

    let result;

    if (method === 'direct') {
      // Direct: categorize cash transactions by contra account
      const cashLines = await this.prisma.journalEntryLine.findMany({
        where: {
          accountId: { in: cashAccountIds },
          journalEntry: { companyId, status: 'POSTED', postingDate: { gte: start, lte: end } },
        },
        include: {
          journalEntry: {
            include: {
              lines: {
                where: { accountId: { notIn: cashAccountIds } },
                include: { account: true },
              },
            },
          },
        },
      });

      let operating = ZERO;
      let investing = ZERO;
      let financing = ZERO;
      const operatingItems: unknown[] = [];
      const investingItems: unknown[] = [];
      const financingItems: unknown[] = [];

      for (const line of cashLines) {
        const amount = line.debitAmount.sub(line.creditAmount);
        const contraAccounts = line.journalEntry.lines;

        let category: 'operating' | 'investing' | 'financing' = 'operating';
        const contraCode = contraAccounts[0]?.account?.code ?? '';

        // Investing: TK 2xx (fixed assets, long-term investments)
        if (contraCode.startsWith('2')) {
          category = 'investing';
        }
        // Financing: TK 341 (borrowings), TK 411 (equity)
        else if (contraCode.startsWith('341') || contraCode.startsWith('411') || contraCode.startsWith('338')) {
          category = 'financing';
        }

        const item = {
          date: line.journalEntry.postingDate,
          description: line.journalEntry.description,
          amount,
          contraAccounts: contraAccounts.map((c) => ({ code: c.account.code, name: c.account.name })),
        };

        if (category === 'operating') {
          operating = operating.add(amount);
          operatingItems.push(item);
        } else if (category === 'investing') {
          investing = investing.add(amount);
          investingItems.push(item);
        } else {
          financing = financing.add(amount);
          financingItems.push(item);
        }
      }

      const netChange = operating.add(investing).add(financing);

      result = {
        reportType: 'B03-DN',
        reportName: 'Báo cáo lưu chuyển tiền tệ (trực tiếp)',
        method: 'direct',
        startDate,
        endDate,
        openingCash,
        operating: { total: operating, items: operatingItems },
        investing: { total: investing, items: investingItems },
        financing: { total: financing, items: financingItems },
        netChange,
        closingCash: openingCash.add(netChange),
      };
    } else {
      // Indirect: start from net profit, adjust non-cash items
      const incomeStatement = await this.getIncomeStatement(companyId, startDate, endDate) as { netProfit: Decimal };
      const netProfit = incomeStatement.netProfit;

      // Depreciation (non-cash add-back)
      const depreciation = await this.prisma.depreciationSchedule.aggregate({
        where: {
          fixedAsset: { companyId },
          periodDate: { gte: start, lte: end },
          isPosted: true,
        },
        _sum: { amount: true },
      });
      const deprAmount = depreciation._sum.amount ?? ZERO;

      // Working capital changes
      const receivableChange = await this.getAccountBalanceChange(companyId, '131', start, end);
      const inventoryChange = await this.getAccountBalanceChange(companyId, '152', start, end);
      const payableChange = await this.getAccountBalanceChange(companyId, '331', start, end);

      const operatingCashFlow = netProfit
        .add(deprAmount)
        .sub(receivableChange)
        .sub(inventoryChange)
        .add(payableChange);

      // Investing: fixed asset purchases
      const investingChange = await this.getAccountBalanceChange(companyId, '2', start, end);
      const investingCashFlow = investingChange.neg();

      // Financing
      const borrowingChange = await this.getAccountBalanceChange(companyId, '341', start, end);
      const equityChange = await this.getAccountBalanceChange(companyId, '411', start, end);
      const financingCashFlow = borrowingChange.add(equityChange);

      const netChange = operatingCashFlow.add(investingCashFlow).add(financingCashFlow);

      result = {
        reportType: 'B03-DN',
        reportName: 'Báo cáo lưu chuyển tiền tệ (gián tiếp)',
        method: 'indirect',
        startDate,
        endDate,
        openingCash,
        netProfit,
        adjustments: {
          depreciation: deprAmount,
          receivableChange,
          inventoryChange,
          payableChange,
        },
        operatingCashFlow,
        investingCashFlow,
        financingCashFlow,
        netChange,
        closingCash: openingCash.add(netChange),
      };
    }

    await this.setCache(key, result);
    return result;
  }

  // ── Financial Notes ──

  async getFinancialNotes(companyId: string, fiscalYearId: string) {
    const key = this.cacheKey(companyId, 'notes', { fiscalYearId });
    const cached = await this.getCached(key);
    if (cached) return cached;

    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId },
    });
    if (!fiscalYear) throw new BadRequestException('Fiscal year not found');

    const start = fiscalYear.startDate;
    const end = fiscalYear.endDate;

    // Fixed assets breakdown
    const fixedAssets = await this.prisma.fixedAsset.findMany({
      where: { companyId },
      include: {
        depreciationSchedules: {
          where: { periodDate: { gte: start, lte: end } },
        },
      },
    });

    const assetsByCategory: Record<string, { count: number; cost: Decimal; accDepr: Decimal; nbv: Decimal }> = {};
    for (const asset of fixedAssets) {
      if (!assetsByCategory[asset.category]) {
        assetsByCategory[asset.category] = { count: 0, cost: ZERO, accDepr: ZERO, nbv: ZERO };
      }
      const cat = assetsByCategory[asset.category]!;
      cat.count++;
      cat.cost = cat.cost.add(asset.acquisitionCost);
      cat.accDepr = cat.accDepr.add(asset.accumulatedDepr);
      cat.nbv = cat.nbv.add(asset.netBookValue);
    }

    // Employee / payroll summary
    const payrollRecords = await this.prisma.payrollRecord.findMany({
      where: {
        companyId,
        periodYear: start.getFullYear(),
      },
    });

    let totalGross = ZERO;
    let totalNet = ZERO;
    for (const pr of payrollRecords) {
      totalGross = totalGross.add(pr.totalGross);
      totalNet = totalNet.add(pr.totalNet);
    }

    // VAT summary
    const vatInput = await this.prisma.vatRecord.aggregate({
      where: { companyId, direction: 'INPUT', invoiceDate: { gte: start, lte: end } },
      _sum: { vatAmount: true, taxableAmount: true },
    });
    const vatOutput = await this.prisma.vatRecord.aggregate({
      where: { companyId, direction: 'OUTPUT', invoiceDate: { gte: start, lte: end } },
      _sum: { vatAmount: true, taxableAmount: true },
    });

    const result = {
      reportType: 'Notes',
      reportName: 'Thuyết minh báo cáo tài chính',
      fiscalYear: { id: fiscalYear.id, name: fiscalYear.name, startDate: start, endDate: end },
      fixedAssetsSummary: assetsByCategory,
      payrollSummary: { totalGross, totalNet, periodsCount: payrollRecords.length },
      vatSummary: {
        input: { taxable: vatInput._sum.taxableAmount ?? ZERO, vat: vatInput._sum.vatAmount ?? ZERO },
        output: { taxable: vatOutput._sum.taxableAmount ?? ZERO, vat: vatOutput._sum.vatAmount ?? ZERO },
      },
    };

    await this.setCache(key, result);
    return result;
  }

  // ── Depreciation Report ──

  async getDepreciationReport(companyId: string, startDate: string, endDate: string) {
    const key = this.cacheKey(companyId, 'depreciation', { startDate, endDate });
    const cached = await this.getCached(key);
    if (cached) return cached;

    const assets = await this.prisma.fixedAsset.findMany({
      where: { companyId },
      include: {
        depreciationSchedules: {
          where: {
            periodDate: { gte: new Date(startDate), lte: new Date(endDate) },
          },
          orderBy: { periodDate: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    let totalPeriodDepr = ZERO;
    const data = assets.map((asset) => {
      let periodDepr = ZERO;
      for (const sched of asset.depreciationSchedules) {
        periodDepr = periodDepr.add(sched.amount);
      }
      totalPeriodDepr = totalPeriodDepr.add(periodDepr);

      return {
        id: asset.id,
        code: asset.code,
        name: asset.name,
        category: asset.category,
        acquisitionCost: asset.acquisitionCost,
        accumulatedDepr: asset.accumulatedDepr,
        netBookValue: asset.netBookValue,
        periodDepreciation: periodDepr,
        schedules: asset.depreciationSchedules,
      };
    });

    const result = {
      reportName: 'Báo cáo khấu hao tài sản cố định',
      startDate,
      endDate,
      data,
      totalPeriodDepreciation: totalPeriodDepr,
    };

    await this.setCache(key, result);
    return result;
  }

  // ── Annual Package ──

  async getAnnualPackage(companyId: string, fiscalYearId: string) {
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId },
    });
    if (!fiscalYear) throw new BadRequestException('Fiscal year not found');

    const startDate = fiscalYear.startDate.toISOString().slice(0, 10);
    const endDate = fiscalYear.endDate.toISOString().slice(0, 10);

    const [balanceSheet, incomeStatement, cashFlowDirect, cashFlowIndirect, notes] = await Promise.all([
      this.getBalanceSheet(companyId, endDate),
      this.getIncomeStatement(companyId, startDate, endDate),
      this.getCashFlowStatement(companyId, startDate, endDate, 'direct'),
      this.getCashFlowStatement(companyId, startDate, endDate, 'indirect'),
      this.getFinancialNotes(companyId, fiscalYearId),
    ]);

    return {
      fiscalYear: { id: fiscalYear.id, name: fiscalYear.name, startDate, endDate },
      balanceSheet,
      incomeStatement,
      cashFlowDirect,
      cashFlowIndirect,
      notes,
    };
  }

  // ── Private helpers ──

  private async getAccountBalanceChange(
    companyId: string,
    codePrefix: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Decimal> {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { companyId, code: { startsWith: codePrefix } },
    });

    let change = ZERO;
    for (const account of accounts) {
      const agg = await this.prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: {
            companyId,
            status: 'POSTED',
            postingDate: { gte: startDate, lte: endDate },
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });
      const debit = agg._sum.debitAmount ?? ZERO;
      const credit = agg._sum.creditAmount ?? ZERO;
      change = change.add(debit).sub(credit);
    }
    return change;
  }

  // ── Management Reports ──

  async getAgingReport(companyId: string, asOfDate: string, type: 'receivable' | 'payable') {
    const key = this.cacheKey(companyId, `aging-${type}`, { asOfDate });
    const cached = await this.getCached(key);
    if (cached) return cached;

    const date = new Date(asOfDate);
    const entityType = type === 'receivable' ? 'customer' : 'vendor';
    const accountPrefix = type === 'receivable' ? '131' : '331';

    // Get all customers/vendors with balances
    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        account: { companyId, code: { startsWith: accountPrefix } },
        journalEntry: { status: 'POSTED', postingDate: { lte: date } },
        ...(type === 'receivable' ? { customerId: { not: null } } : { vendorId: { not: null } }),
      },
      include: {
        customer: type === 'receivable',
        vendor: type === 'payable',
        journalEntry: { select: { postingDate: true } },
      },
    });

    // Group by entity and calculate aging buckets
    const entities = new Map<string, {
      id: string;
      code: string;
      name: string;
      current: Decimal;
      days30: Decimal;
      days60: Decimal;
      days90: Decimal;
      over90: Decimal;
      total: Decimal;
    }>();

    for (const line of lines) {
      const entity = type === 'receivable' ? line.customer : line.vendor;
      if (!entity) continue;

      const entityKey = entity.id;
      if (!entities.has(entityKey)) {
        entities.set(entityKey, {
          id: entity.id,
          code: entity.code,
          name: entity.name,
          current: ZERO,
          days30: ZERO,
          days60: ZERO,
          days90: ZERO,
          over90: ZERO,
          total: ZERO,
        });
      }

      const entry = entities.get(entityKey)!;
      const amount = type === 'receivable'
        ? line.debitAmount.sub(line.creditAmount)
        : line.creditAmount.sub(line.debitAmount);

      const daysPast = Math.floor((date.getTime() - line.journalEntry.postingDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysPast <= 30) entry.current = entry.current.add(amount);
      else if (daysPast <= 60) entry.days30 = entry.days30.add(amount);
      else if (daysPast <= 90) entry.days60 = entry.days60.add(amount);
      else if (daysPast <= 120) entry.days90 = entry.days90.add(amount);
      else entry.over90 = entry.over90.add(amount);

      entry.total = entry.total.add(amount);
    }

    const result = {
      reportType: type === 'receivable' ? 'AR-Aging' : 'AP-Aging',
      reportName: type === 'receivable' ? 'Phân tích tuổi nợ phải thu' : 'Phân tích tuổi nợ phải trả',
      asOfDate,
      entityType,
      items: Array.from(entities.values()).filter(e => !e.total.eq(ZERO)),
    };

    await this.setCache(key, result);
    return result;
  }

  async getRevenueReport(companyId: string, startDate: string, endDate: string) {
    const key = this.cacheKey(companyId, 'revenue', { startDate, endDate });
    const cached = await this.getCached(key);
    if (cached) return cached;

    const start = new Date(startDate);
    const end = new Date(endDate);

    const revenue = await this.getPeriodBalance(companyId, '511', start, end);
    
    // Group by customer
    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        account: { companyId, code: { startsWith: '511' } },
        journalEntry: { status: 'POSTED', postingDate: { gte: start, lte: end } },
        customerId: { not: null },
      },
      include: { customer: true },
    });

    const byCustomer = new Map<string, { code: string; name: string; amount: Decimal }>();
    for (const line of lines) {
      if (!line.customer) continue;
      const key = line.customer.id;
      if (!byCustomer.has(key)) {
        byCustomer.set(key, { code: line.customer.code, name: line.customer.name, amount: ZERO });
      }
      byCustomer.get(key)!.amount = byCustomer.get(key)!.amount.add(line.creditAmount);
    }

    const result = {
      reportType: 'Revenue',
      reportName: 'Báo cáo doanh thu',
      startDate,
      endDate,
      totalRevenue: revenue.total,
      byCustomer: Array.from(byCustomer.values()).sort((a, b) => b.amount.cmp(a.amount)),
    };

    await this.setCache(key, result);
    return result;
  }

  async getExpensesReport(companyId: string, startDate: string, endDate: string) {
    const key = this.cacheKey(companyId, 'expenses', { startDate, endDate });
    const cached = await this.getCached(key);
    if (cached) return cached;

    const start = new Date(startDate);
    const end = new Date(endDate);

    const cogs = await this.getPeriodBalance(companyId, '632', start, end);
    const financialExp = await this.getPeriodBalance(companyId, '635', start, end);
    const sellingExp = await this.getPeriodBalance(companyId, '641', start, end);
    const adminExp = await this.getPeriodBalance(companyId, '642', start, end);

    const result = {
      reportType: 'Expenses',
      reportName: 'Báo cáo chi phí',
      startDate,
      endDate,
      cogs,
      financialExpense: financialExp,
      sellingExpense: sellingExp,
      adminExpense: adminExp,
      totalExpenses: cogs.total.add(financialExp.total).add(sellingExp.total).add(adminExp.total),
    };

    await this.setCache(key, result);
    return result;
  }

  async getTrendsReport(companyId: string, year: string) {
    const key = this.cacheKey(companyId, 'trends', { year });
    const cached = await this.getCached(key);
    if (cached) return cached;

    const months = [];
    for (let m = 1; m <= 12; m++) {
      const startDate = `${year}-${m.toString().padStart(2, '0')}-01`;
      const endOfMonth = new Date(parseInt(year), m, 0);
      const endDate = endOfMonth.toISOString().slice(0, 10);

      const statement = await this.getIncomeStatement(companyId, startDate, endDate, false);
      
      months.push({
        month: m,
        revenue: (statement as Record<string, { total: Decimal }>).revenue?.total ?? ZERO,
        expenses: (statement as Record<string, { total: Decimal }>).cogs?.total ?? ZERO,
        netProfit: (statement as { netProfit: Decimal }).netProfit ?? ZERO,
      });
    }

    const result = {
      reportType: 'Trends',
      reportName: 'Xu hướng tài chính',
      year,
      months,
    };

    await this.setCache(key, result);
    return result;
  }

  async getCashFlowAnalysis(companyId: string, startDate: string, endDate: string) {
    // Alias to the existing cash flow statement
    return this.getCashFlowStatement(companyId, startDate, endDate, 'direct');
  }

  // ── Debug helper ──

  async debugDataCheck(companyId: string) {
    // Count vouchers
    const voucherCount = await this.prisma.voucher.count({
      where: { companyId },
    });

    const postedVouchers = await this.prisma.voucher.count({
      where: { companyId, status: 'POSTED' },
    });

    // Count journal entries
    const journalEntryCount = await this.prisma.journalEntry.count({
      where: { companyId },
    });

    const postedJournalEntries = await this.prisma.journalEntry.count({
      where: { companyId, status: 'POSTED' },
    });

    // Count journal entry lines
    const journalLineCount = await this.prisma.journalEntryLine.count({
      where: {
        journalEntry: { companyId },
      },
    });

    // Sample journal entries
    const sampleJournalEntries = await this.prisma.journalEntry.findMany({
      where: { companyId },
      take: 5,
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check account balances for common accounts
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: {
        companyId,
        code: { in: ['111', '112', '131', '331', '411', '511', '632', '642'] },
      },
      select: { id: true, code: true, name: true, normalBalance: true },
    });

    const accountBalances = [];
    for (const account of accounts) {
      const agg = await this.prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: {
            companyId,
            status: 'POSTED',
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });

      accountBalances.push({
        code: account.code,
        name: account.name,
        debit: agg._sum.debitAmount,
        credit: agg._sum.creditAmount,
      });
    }

    return {
      companyId,
      summary: {
        totalVouchers: voucherCount,
        postedVouchers,
        totalJournalEntries: journalEntryCount,
        postedJournalEntries,
        totalJournalLines: journalLineCount,
      },
      sampleJournalEntries: sampleJournalEntries.map((je) => ({
        id: je.id,
        entryNumber: je.entryNumber,
        status: je.status,
        postingDate: je.postingDate,
        lines: je.lines.map((l) => ({
          account: `${l.account.code} - ${l.account.name}`,
          debit: l.debitAmount,
          credit: l.creditAmount,
        })),
      })),
      accountBalances,
    };
  }

  // ============================================================================
  // S06-DN: Trial Balance (Bảng cân đối số phát sinh) - TT99/2025 Compliance
  // ============================================================================

  /**
   * Generate Trial Balance report per Circular 99/2025/TT-BTC
   * Shows opening balance, period movements, and closing balance for all accounts
   * Structured as tree with parent-child relationships
   */
  async getTrialBalance(
    companyId: string,
    startDate: string,
    endDate: string,
    options: { showTree?: boolean; accountLevel?: number; showZeroBalance?: boolean } = {},
  ) {
    const key = this.cacheKey(companyId, 'trial-balance', { startDate, endDate, ...options });
    const cached = await this.getCached(key);
    if (cached) return cached;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const { showTree = true, accountLevel, showZeroBalance = false } = options;

    // Get all active accounts
    let accountsWhere: Record<string, unknown> = { companyId, isActive: true };
    if (accountLevel) {
      accountsWhere.level = { lte: accountLevel };
    }

    const accounts = await this.prisma.ledgerAccount.findMany({
      where: accountsWhere,
      orderBy: { code: 'asc' },
      include: {
        parent: { select: { id: true, code: true } },
      },
    });

    interface TrialBalanceLine {
      id: string;
      code: string;
      name: string;
      nameEn: string | null;
      level: number;
      parentId: string | null;
      normalBalance: string;
      openingDebit: Decimal;
      openingCredit: Decimal;
      periodDebit: Decimal;
      periodCredit: Decimal;
      closingDebit: Decimal;
      closingCredit: Decimal;
      children?: TrialBalanceLine[];
    }

    const lines: TrialBalanceLine[] = [];
    
    // Totals for validation
    let totalOpeningDebit = ZERO;
    let totalOpeningCredit = ZERO;
    let totalPeriodDebit = ZERO;
    let totalPeriodCredit = ZERO;
    let totalClosingDebit = ZERO;
    let totalClosingCredit = ZERO;

    for (const account of accounts) {
      // Opening balance (before start date)
      const openingAgg = await this.prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: { companyId, status: 'POSTED', postingDate: { lt: start } },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });

      const openingDebitRaw = openingAgg._sum.debitAmount ?? ZERO;
      const openingCreditRaw = openingAgg._sum.creditAmount ?? ZERO;
      
      let openingDebit: Decimal;
      let openingCredit: Decimal;
      const openingNet = openingDebitRaw.sub(openingCreditRaw);
      
      if (account.normalBalance === 'DEBIT') {
        if (openingNet.gte(ZERO)) {
          openingDebit = openingNet;
          openingCredit = ZERO;
        } else {
          openingDebit = ZERO;
          openingCredit = openingNet.abs();
        }
      } else {
        if (openingNet.lte(ZERO)) {
          openingDebit = ZERO;
          openingCredit = openingNet.abs();
        } else {
          openingDebit = openingNet;
          openingCredit = ZERO;
        }
      }

      // Period movements
      const periodAgg = await this.prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: { companyId, status: 'POSTED', postingDate: { gte: start, lte: end } },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });

      const periodDebit = periodAgg._sum.debitAmount ?? ZERO;
      const periodCredit = periodAgg._sum.creditAmount ?? ZERO;

      // Closing balance
      const closingNet = openingNet.add(periodDebit).sub(periodCredit);
      
      let closingDebit: Decimal;
      let closingCredit: Decimal;
      
      if (account.normalBalance === 'DEBIT') {
        if (closingNet.gte(ZERO)) {
          closingDebit = closingNet;
          closingCredit = ZERO;
        } else {
          closingDebit = ZERO;
          closingCredit = closingNet.abs();
        }
      } else {
        if (closingNet.lte(ZERO)) {
          closingDebit = ZERO;
          closingCredit = closingNet.abs();
        } else {
          closingDebit = closingNet;
          closingCredit = ZERO;
        }
      }

      // Skip zero-balance accounts if not requested
      const hasBalance = !openingDebit.eq(ZERO) || !openingCredit.eq(ZERO) ||
                        !periodDebit.eq(ZERO) || !periodCredit.eq(ZERO) ||
                        !closingDebit.eq(ZERO) || !closingCredit.eq(ZERO);

      if (!showZeroBalance && !hasBalance) continue;

      lines.push({
        id: account.id,
        code: account.code,
        name: account.name,
        nameEn: account.nameEn,
        level: account.level,
        parentId: account.parentId,
        normalBalance: account.normalBalance,
        openingDebit,
        openingCredit,
        periodDebit,
        periodCredit,
        closingDebit,
        closingCredit,
      });

      // Accumulate totals
      totalOpeningDebit = totalOpeningDebit.add(openingDebit);
      totalOpeningCredit = totalOpeningCredit.add(openingCredit);
      totalPeriodDebit = totalPeriodDebit.add(periodDebit);
      totalPeriodCredit = totalPeriodCredit.add(periodCredit);
      totalClosingDebit = totalClosingDebit.add(closingDebit);
      totalClosingCredit = totalClosingCredit.add(closingCredit);
    }

    // Build tree structure if requested
    let treeData: TrialBalanceLine[] | null = null;
    if (showTree) {
      const map = new Map<string, TrialBalanceLine>();
      const roots: TrialBalanceLine[] = [];

      // First pass: create map
      for (const line of lines) {
        map.set(line.id, { ...line, children: [] });
      }

      // Second pass: build tree
      for (const line of lines) {
        const node = map.get(line.id)!;
        if (line.parentId && map.has(line.parentId)) {
          map.get(line.parentId)!.children!.push(node);
        } else {
          roots.push(node);
        }
      }

      treeData = roots;
    }

    // Validation: totals should balance
    const isOpeningBalanced = totalOpeningDebit.eq(totalOpeningCredit);
    const isPeriodBalanced = totalPeriodDebit.eq(totalPeriodCredit);
    const isClosingBalanced = totalClosingDebit.eq(totalClosingCredit);
    const isFullyBalanced = isOpeningBalanced && isPeriodBalanced && isClosingBalanced;

    const result = {
      reportType: 'S06-DN',
      reportName: 'Bảng cân đối số phát sinh',
      reportNameEn: 'Trial Balance',
      startDate,
      endDate,
      totalAccounts: lines.length,
      
      // Flat data (always included)
      lines,
      
      // Tree data (if requested)
      tree: showTree ? treeData : undefined,
      
      // Summary totals
      totals: {
        openingDebit: totalOpeningDebit,
        openingCredit: totalOpeningCredit,
        periodDebit: totalPeriodDebit,
        periodCredit: totalPeriodCredit,
        closingDebit: totalClosingDebit,
        closingCredit: totalClosingCredit,
      },
      
      // Balance validation
      validation: {
        isOpeningBalanced,
        isPeriodBalanced,
        isClosingBalanced,
        isFullyBalanced,
        openingDifference: totalOpeningDebit.sub(totalOpeningCredit),
        periodDifference: totalPeriodDebit.sub(totalPeriodCredit),
        closingDifference: totalClosingDebit.sub(totalClosingCredit),
      },
    };

    await this.setCache(key, result);
    return result;
  }

  /**
   * Get detailed partner ledger for a specific customer or vendor
   * Used for Notes to Financial Statements (B09-DN) disclosure requirements
   */
  async getPartnerLedger(
    companyId: string,
    partnerId: string,
    partnerType: 'customer' | 'vendor',
    startDate: string,
    endDate: string,
  ) {
    const key = this.cacheKey(companyId, `partner-ledger-${partnerType}`, { partnerId, startDate, endDate });
    const cached = await this.getCached(key);
    if (cached) return cached;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const accountPrefix = partnerType === 'customer' ? '131' : '331';

    // Get partner info
    const partner = partnerType === 'customer'
      ? await this.prisma.customer.findFirst({ where: { id: partnerId, companyId } })
      : await this.prisma.vendor.findFirst({ where: { id: partnerId, companyId } });

    if (!partner) {
      throw new BadRequestException(`${partnerType} not found`);
    }

    // Get all transactions for this partner
    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        account: { companyId, code: { startsWith: accountPrefix } },
        journalEntry: { status: 'POSTED', postingDate: { gte: start, lte: end } },
        ...(partnerType === 'customer' ? { customerId: partnerId } : { vendorId: partnerId }),
      },
      include: {
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            postingDate: true,
            documentDate: true,
            description: true,
          },
        },
        account: { select: { code: true, name: true } },
      },
      orderBy: { journalEntry: { postingDate: 'asc' } },
    });

    // Calculate opening balance
    const openingAgg = await this.prisma.journalEntryLine.aggregate({
      where: {
        account: { companyId, code: { startsWith: accountPrefix } },
        journalEntry: { status: 'POSTED', postingDate: { lt: start } },
        ...(partnerType === 'customer' ? { customerId: partnerId } : { vendorId: partnerId }),
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const openingDebit = openingAgg._sum.debitAmount ?? ZERO;
    const openingCredit = openingAgg._sum.creditAmount ?? ZERO;
    const openingBalance = partnerType === 'customer'
      ? openingDebit.sub(openingCredit)
      : openingCredit.sub(openingDebit);

    // Build transaction list with running balance
    let runningBalance = openingBalance;
    const transactions = lines.map((line) => {
      const amount = partnerType === 'customer'
        ? line.debitAmount.sub(line.creditAmount)
        : line.creditAmount.sub(line.debitAmount);
      runningBalance = runningBalance.add(amount);

      return {
        date: line.journalEntry.postingDate,
        documentDate: line.journalEntry.documentDate,
        entryNumber: line.journalEntry.entryNumber,
        description: line.description || line.journalEntry.description,
        accountCode: line.account.code,
        debit: line.debitAmount,
        credit: line.creditAmount,
        balance: runningBalance,
      };
    });

    const closingBalance = runningBalance;

    const result = {
      reportType: partnerType === 'customer' ? 'Customer-Ledger' : 'Vendor-Ledger',
      reportName: partnerType === 'customer' ? 'Sổ chi tiết công nợ khách hàng' : 'Sổ chi tiết công nợ nhà cung cấp',
      partner: {
        id: partner.id,
        code: partner.code,
        name: partner.name,
        taxCode: partner.taxCode,
      },
      startDate,
      endDate,
      openingBalance,
      transactions,
      closingBalance,
      totalDebit: lines.reduce((sum, l) => sum.add(l.debitAmount), ZERO),
      totalCredit: lines.reduce((sum, l) => sum.add(l.creditAmount), ZERO),
    };

    await this.setCache(key, result);
    return result;
  }

  /**
   * Get bank account detail for Notes disclosure (TT99 requires >10% balance disclosure)
   * Used for explaining TK 112 (Tiền gửi không kỳ hạn) balances by bank
   */
  async getBankAccountDetail(companyId: string, asOfDate: string) {
    const key = this.cacheKey(companyId, 'bank-detail', { asOfDate });
    const cached = await this.getCached(key);  
    if (cached) return cached;

    const date = new Date(asOfDate);

    // Get all 112x sub-accounts (demand deposits by bank)
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: {
        companyId,
        code: { startsWith: '112' },
        isActive: true,
        level: { gte: 2 },  // Sub-accounts only
      },
      orderBy: { code: 'asc' },
    });

    const balances: { code: string; name: string; balance: Decimal; percentage?: number }[] = [];
    let totalBalance = ZERO;

    for (const account of accounts) {
      const agg = await this.prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: { companyId, status: 'POSTED', postingDate: { lte: date } },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });

      const balance = (agg._sum.debitAmount ?? ZERO).sub(agg._sum.creditAmount ?? ZERO);
      
      if (!balance.eq(ZERO)) {
        balances.push({
          code: account.code,
          name: account.name,
          balance,
        });
        totalBalance = totalBalance.add(balance);
      }
    }

    // Calculate percentages and flag for disclosure
    const balancesWithPercentage = balances.map((b) => ({
      ...b,
      percentage: totalBalance.eq(ZERO) ? 0 : Number(b.balance.div(totalBalance).mul(100).toFixed(2)),
      requiresDisclosure: totalBalance.eq(ZERO) ? false : b.balance.div(totalBalance).gte(0.1),  // >= 10%
    }));

    const result = {
      reportName: 'Chi tiết tiền gửi không kỳ hạn theo ngân hàng',
      reportNameEn: 'Demand Deposits by Bank',
      asOfDate,
      accounts: balancesWithPercentage,
      totalBalance,
      notesDisclosure: balancesWithPercentage.filter((b) => b.requiresDisclosure),
    };

    await this.setCache(key, result);
    return result;
  }
}
