import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

interface BookFilters {
  startDate: string;
  endDate: string;
  accountId?: string;
  customerId?: string;
  vendorId?: string;
  employeeId?: string;
  itemId?: string;
}

interface Pagination {
  page?: number;
  limit?: number;
}

interface BookResult {
  data: unknown[];
  openingBalance: { debit: Decimal; credit: Decimal; balance: Decimal };
  closingBalance: { debit: Decimal; credit: Decimal; balance: Decimal };
  totals: { totalDebit: Decimal; totalCredit: Decimal };
}

// TT200/TT133 compliant header for Cash Book and Bank Book
interface CashBookHeader {
  companyName: string;
  companyAddress: string;
  accountCode: string;      // e.g., "1111", "1112"
  accountName: string;      // e.g., "Tiền mặt VNĐ"
  fundType: string;         // e.g., "VNĐ", "USD", "Ngoại tệ"
  currencyUnit: string;     // e.g., "VNĐ"
  fiscalYear: number;       // e.g., 2026
  periodStart: string;
  periodEnd: string;
}

const ZERO = new Decimal(0);

@Injectable()
export class AccountingBooksService {
  constructor(private prisma: PrismaService) {}

  private getPagination(pagination: Pagination) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    return { skip: (page - 1) * limit, take: limit, page, limit };
  }

  private computeBalance(lines: { debitAmount: Decimal; creditAmount: Decimal }[]) {
    let totalDebit = ZERO;
    let totalCredit = ZERO;
    for (const line of lines) {
      totalDebit = totalDebit.add(line.debitAmount);
      totalCredit = totalCredit.add(line.creditAmount);
    }
    return { totalDebit, totalCredit, balance: totalDebit.sub(totalCredit) };
  }

  private async getAccountOpeningBalance(
    companyId: string,
    accountCode: string,
    beforeDate: string,
    extraWhere?: Record<string, unknown>,
  ) {
    const account = await this.prisma.ledgerAccount.findFirst({
      where: { companyId, code: accountCode },
    });
    if (!account) return { debit: ZERO, credit: ZERO, balance: ZERO };

    const where: Record<string, unknown> = {
      accountId: account.id,
      journalEntry: {
        companyId,
        status: 'POSTED',
        postingDate: { lt: new Date(beforeDate) },
      },
      ...extraWhere,
    };

    const agg = await this.prisma.journalEntryLine.aggregate({
      where,
      _sum: { debitAmount: true, creditAmount: true },
    });

    const debit = agg._sum.debitAmount ?? ZERO;
    const credit = agg._sum.creditAmount ?? ZERO;
    return { debit, credit, balance: debit.sub(credit) };
  }

  private async getAccountIdOpeningBalance(
    companyId: string,
    accountId: string,
    beforeDate: string,
    extraWhere?: Record<string, unknown>,
  ) {
    const where: Record<string, unknown> = {
      accountId,
      journalEntry: {
        companyId,
        status: 'POSTED',
        postingDate: { lt: new Date(beforeDate) },
      },
      ...extraWhere,
    };

    const agg = await this.prisma.journalEntryLine.aggregate({
      where,
      _sum: { debitAmount: true, creditAmount: true },
    });

    const debit = agg._sum.debitAmount ?? ZERO;
    const credit = agg._sum.creditAmount ?? ZERO;
    return { debit, credit, balance: debit.sub(credit) };
  }

  async getGeneralJournal(
    companyId: string,
    filters: BookFilters,
    pagination: Pagination,
  ): Promise<BookResult> {
    const { skip, take } = this.getPagination(pagination);

    const where = {
      companyId,
      status: 'POSTED' as const,
      postingDate: {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      },
    };

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: { account: { select: { code: true, name: true } } },
          orderBy: { lineOrder: 'asc' },
        },
      },
      orderBy: { postingDate: 'asc' },
      skip,
      take,
    });

    let totalDebit = ZERO;
    let totalCredit = ZERO;
    for (const entry of entries) {
      totalDebit = totalDebit.add(entry.totalDebit);
      totalCredit = totalCredit.add(entry.totalCredit);
    }

    return {
      data: entries,
      openingBalance: { debit: ZERO, credit: ZERO, balance: ZERO },
      closingBalance: { debit: totalDebit, credit: totalCredit, balance: totalDebit.sub(totalCredit) },
      totals: { totalDebit, totalCredit },
    };
  }

  async getGeneralLedger(
    companyId: string,
    filters: BookFilters & { accountId: string },
    pagination: Pagination,
  ): Promise<BookResult> {
    const { skip, take } = this.getPagination(pagination);
    const { accountId, startDate, endDate } = filters;

    const opening = await this.getAccountIdOpeningBalance(companyId, accountId, startDate);

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId,
        journalEntry: {
          companyId,
          status: 'POSTED',
          postingDate: { gte: new Date(startDate), lte: new Date(endDate) },
        },
      },
      include: {
        journalEntry: {
          select: {
            entryNumber: true,
            postingDate: true,
            description: true,
            lines: {
              where: { accountId: { not: accountId } },
              include: { account: { select: { code: true, name: true } } },
            },
          },
        },
        account: { select: { code: true, name: true } },
      },
      orderBy: { journalEntry: { postingDate: 'asc' } },
      skip,
      take,
    });

    // Compute global STT (row number in General Journal) for each line in the period
    const allPeriodLineIds = await this.prisma.journalEntryLine.findMany({
      where: {
        journalEntry: {
          companyId,
          status: 'POSTED',
          postingDate: { gte: new Date(startDate), lte: new Date(endDate) },
        },
      },
      select: { id: true },
      orderBy: [{ journalEntry: { postingDate: 'asc' } }, { lineOrder: 'asc' }],
    });
    const sttMap = new Map<string, number>();
    allPeriodLineIds.forEach((l, idx) => sttMap.set(l.id, idx + 1));

    // Compute running balance per line
    let runningBalance = opening.balance;
    const dataWithContra = (lines as typeof lines & { journalEntry: { lines: { account: { code: string; name: string } }[] } }[]).map((line) => {
      runningBalance = runningBalance.add(line.debitAmount).sub(line.creditAmount);
      const jeLines = (line as unknown as { journalEntry: { lines: Array<{ account: { code: string; name: string } }> } }).journalEntry.lines;
      return {
        ...line,
        sttNkc: sttMap.get(line.id) ?? null,
        runningBalance,
        isNegativeBalance: runningBalance.lt(ZERO),
        contraAccounts: jeLines.map((l) => ({
          code: l.account.code,
          name: l.account.name,
        })),
      };
    });

    const period = this.computeBalance(lines);
    const closingBalance = opening.balance.add(period.balance);

    return {
      data: dataWithContra,
      openingBalance: opening,
      closingBalance: { debit: ZERO, credit: ZERO, balance: closingBalance },
      totals: { totalDebit: period.totalDebit, totalCredit: period.totalCredit },
    };
  }

  async getCashBook(
    companyId: string,
    filters: BookFilters & { subAccountCode?: string },
    pagination: Pagination,
  ): Promise<BookResult & { header: CashBookHeader }> {
    // Get company info for header
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, address: true, baseCurrency: true },
    });

    // Determine account code (default 111 or specific sub-account like 1111, 1112)
    const accountCode = filters.subAccountCode || '111';
    
    // Get account info for header
    const account = await this.prisma.ledgerAccount.findFirst({
      where: { companyId, code: { startsWith: accountCode } },
      select: { code: true, name: true },
    });

    const result = await this.getLedgerByAccountCode(companyId, accountCode, filters, pagination);
    
    // Determine currency/fund type from account code
    const fundType = accountCode === '1112' ? 'Ngoại tệ' : 'VNĐ';
    const currencyUnit = company?.baseCurrency || 'VNĐ';
    
    // Extract fiscal year from date range
    const year = new Date(filters.startDate).getFullYear();

    return {
      ...result,
      header: {
        companyName: company?.name || '',
        companyAddress: company?.address || '',
        accountCode: account?.code || accountCode,
        accountName: account?.name || 'Tiền mặt',
        fundType,
        currencyUnit,
        fiscalYear: year,
        periodStart: filters.startDate,
        periodEnd: filters.endDate,
      },
    };
  }

  async getBankBook(
    companyId: string,
    filters: BookFilters & { subAccountId?: string; subAccountCode?: string },
    pagination: Pagination,
  ): Promise<BookResult & { header: CashBookHeader }> {
    // Get company info for header
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, address: true, baseCurrency: true },
    });

    // Determine account code
    const accountCode = filters.subAccountCode || '112';
    
    // Get account info for header
    const account = filters.subAccountId
      ? await this.prisma.ledgerAccount.findUnique({
          where: { id: filters.subAccountId },
          select: { code: true, name: true },
        })
      : await this.prisma.ledgerAccount.findFirst({
          where: { companyId, code: { startsWith: accountCode } },
          select: { code: true, name: true },
        });

    const result = filters.subAccountId
      ? await this.getLedgerByAccountId(companyId, filters.subAccountId, filters, pagination)
      : await this.getLedgerByAccountCode(companyId, accountCode, filters, pagination);

    const currencyUnit = company?.baseCurrency || 'VNĐ';
    const year = new Date(filters.startDate).getFullYear();

    return {
      ...result,
      header: {
        companyName: company?.name || '',
        companyAddress: company?.address || '',
        accountCode: account?.code || accountCode,
        accountName: account?.name || 'Tiền gửi ngân hàng',
        fundType: currencyUnit,
        currencyUnit,
        fiscalYear: year,
        periodStart: filters.startDate,
        periodEnd: filters.endDate,
      },
    };
  }

  async getCustomerLedger(
    companyId: string,
    filters: BookFilters & { customerId: string },
    pagination: Pagination,
  ): Promise<BookResult> {
    return this.getLedgerByAccountCode(companyId, '131', filters, pagination, {
      customerId: filters.customerId,
    });
  }

  async getVendorLedger(
    companyId: string,
    filters: BookFilters & { vendorId: string },
    pagination: Pagination,
  ): Promise<BookResult> {
    return this.getLedgerByAccountCode(companyId, '331', filters, pagination, {
      vendorId: filters.vendorId,
    });
  }

  async getInventoryLedger(
    companyId: string,
    filters: BookFilters & { itemId: string },
    pagination: Pagination,
  ): Promise<BookResult> {
    const { skip, take } = this.getPagination(pagination);
    const { itemId, startDate, endDate } = filters;

    const account = await this.prisma.ledgerAccount.findFirst({
      where: { companyId, code: { startsWith: '152' } },
    });

    const opening = account
      ? await this.getAccountOpeningBalance(companyId, '152', startDate, { inventoryItemId: itemId })
      : { debit: ZERO, credit: ZERO, balance: ZERO };

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        inventoryItemId: itemId,
        account: { companyId, code: { startsWith: '152' } },
        journalEntry: {
          companyId,
          status: 'POSTED',
          postingDate: { gte: new Date(startDate), lte: new Date(endDate) },
        },
      },
      include: {
        journalEntry: { select: { entryNumber: true, postingDate: true, description: true } },
        account: { select: { code: true, name: true } },
        inventoryItem: { select: { code: true, name: true, unit: true } },
      },
      orderBy: { journalEntry: { postingDate: 'asc' } },
      skip,
      take,
    });

    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        companyId,
        inventoryItemId: itemId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      orderBy: { date: 'asc' },
    });

    const period = this.computeBalance(lines);
    const closingBalance = opening.balance.add(period.balance);

    return {
      data: lines.map((line, idx) => ({
        ...line,
        movement: movements[idx] ?? null,
      })),
      openingBalance: opening,
      closingBalance: { debit: ZERO, credit: ZERO, balance: closingBalance },
      totals: { totalDebit: period.totalDebit, totalCredit: period.totalCredit },
    };
  }

  async getFixedAssetLedger(
    companyId: string,
    filters: BookFilters,
    pagination: Pagination,
  ): Promise<BookResult> {
    const { skip, take } = this.getPagination(pagination);

    const assets = await this.prisma.fixedAsset.findMany({
      where: { companyId },
      include: {
        depreciationSchedules: {
          where: {
            periodDate: {
              gte: new Date(filters.startDate),
              lte: new Date(filters.endDate),
            },
          },
          orderBy: { periodDate: 'asc' },
        },
      },
      skip,
      take,
    });

    let totalDepr = ZERO;
    for (const asset of assets) {
      for (const sched of asset.depreciationSchedules) {
        totalDepr = totalDepr.add(sched.amount);
      }
    }

    return {
      data: assets,
      openingBalance: { debit: ZERO, credit: ZERO, balance: ZERO },
      closingBalance: { debit: ZERO, credit: ZERO, balance: totalDepr },
      totals: { totalDebit: ZERO, totalCredit: totalDepr },
    };
  }

  async getPayrollLedger(
    companyId: string,
    filters: BookFilters & { employeeId?: string },
    pagination: Pagination,
  ): Promise<BookResult> {
    return this.getLedgerByAccountCode(companyId, '334', filters, pagination, {
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    });
  }

  async getAdvanceLedger(
    companyId: string,
    filters: BookFilters & { employeeId?: string },
    pagination: Pagination,
  ): Promise<BookResult> {
    return this.getLedgerByAccountCode(companyId, '141', filters, pagination, {
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    });
  }

  async getVatInputLedger(
    companyId: string,
    filters: BookFilters,
    pagination: Pagination,
  ): Promise<BookResult> {
    const result = await this.getLedgerByAccountCode(companyId, '133', filters, pagination);

    const vatRecords = await this.prisma.vatRecord.findMany({
      where: {
        companyId,
        direction: 'INPUT',
        invoiceDate: {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate),
        },
      },
      include: {
        vendor: { select: { code: true, name: true, taxCode: true } },
      },
      orderBy: { invoiceDate: 'asc' },
    });

    return {
      ...result,
      data: result.data.map((line, idx) => ({
        ...(line as Record<string, unknown>),
        vatInfo: vatRecords[idx] ?? null,
      })),
    };
  }

  async getVatOutputLedger(
    companyId: string,
    filters: BookFilters,
    pagination: Pagination,
  ): Promise<BookResult> {
    const result = await this.getLedgerByAccountCode(companyId, '333', filters, pagination);

    const vatRecords = await this.prisma.vatRecord.findMany({
      where: {
        companyId,
        direction: 'OUTPUT',
        invoiceDate: {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate),
        },
      },
      include: {
        customer: { select: { code: true, name: true, taxCode: true } },
      },
      orderBy: { invoiceDate: 'asc' },
    });

    return {
      ...result,
      data: result.data.map((line, idx) => ({
        ...(line as Record<string, unknown>),
        vatInfo: vatRecords[idx] ?? null,
      })),
    };
  }

  async getPurchaseJournal(
    companyId: string,
    filters: BookFilters,
    pagination: Pagination,
  ): Promise<BookResult> {
    const { skip, take } = this.getPagination(pagination);

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        status: 'POSTED',
        postingDate: { gte: new Date(filters.startDate), lte: new Date(filters.endDate) },
        lines: {
          some: {
            account: { code: { startsWith: '331' } },
            creditAmount: { gt: 0 },
          },
        },
      },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true } },
            vendor: { select: { code: true, name: true } },
          },
          orderBy: { lineOrder: 'asc' },
        },
      },
      orderBy: { postingDate: 'asc' },
      skip,
      take,
    });

    let totalDebit = ZERO;
    let totalCredit = ZERO;
    for (const entry of entries) {
      totalDebit = totalDebit.add(entry.totalDebit);
      totalCredit = totalCredit.add(entry.totalCredit);
    }

    return {
      data: entries,
      openingBalance: { debit: ZERO, credit: ZERO, balance: ZERO },
      closingBalance: { debit: totalDebit, credit: totalCredit, balance: totalDebit.sub(totalCredit) },
      totals: { totalDebit, totalCredit },
    };
  }

  async getSalesJournal(
    companyId: string,
    filters: BookFilters,
    pagination: Pagination,
  ): Promise<BookResult> {
    const { skip, take } = this.getPagination(pagination);

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        status: 'POSTED',
        postingDate: { gte: new Date(filters.startDate), lte: new Date(filters.endDate) },
        lines: {
          some: {
            account: { code: { startsWith: '511' } },
            creditAmount: { gt: 0 },
          },
        },
      },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true } },
            customer: { select: { code: true, name: true } },
          },
          orderBy: { lineOrder: 'asc' },
        },
      },
      orderBy: { postingDate: 'asc' },
      skip,
      take,
    });

    let totalDebit = ZERO;
    let totalCredit = ZERO;
    for (const entry of entries) {
      totalDebit = totalDebit.add(entry.totalDebit);
      totalCredit = totalCredit.add(entry.totalCredit);
    }

    return {
      data: entries,
      openingBalance: { debit: ZERO, credit: ZERO, balance: ZERO },
      closingBalance: { debit: totalDebit, credit: totalCredit, balance: totalDebit.sub(totalCredit) },
      totals: { totalDebit, totalCredit },
    };
  }

  async getRevenueByCategory(
    companyId: string,
    filters: BookFilters,
    pagination: Pagination,
  ): Promise<BookResult> {
    const revenueCodes = ['511', '515', '711'];
    const results: unknown[] = [];
    let totalDebit = ZERO;
    let totalCredit = ZERO;

    for (const code of revenueCodes) {
      const accounts = await this.prisma.ledgerAccount.findMany({
        where: { companyId, code: { startsWith: code } },
      });

      for (const account of accounts) {
        const agg = await this.prisma.journalEntryLine.aggregate({
          where: {
            accountId: account.id,
            journalEntry: {
              companyId,
              status: 'POSTED',
              postingDate: { gte: new Date(filters.startDate), lte: new Date(filters.endDate) },
            },
          },
          _sum: { debitAmount: true, creditAmount: true },
        });

        const debit = agg._sum.debitAmount ?? ZERO;
        const credit = agg._sum.creditAmount ?? ZERO;
        totalDebit = totalDebit.add(debit);
        totalCredit = totalCredit.add(credit);

        results.push({
          accountCode: account.code,
          accountName: account.name,
          debit,
          credit,
          balance: credit.sub(debit),
        });
      }
    }

    return {
      data: results,
      openingBalance: { debit: ZERO, credit: ZERO, balance: ZERO },
      closingBalance: { debit: totalDebit, credit: totalCredit, balance: totalCredit.sub(totalDebit) },
      totals: { totalDebit, totalCredit },
    };
  }

  async getEquitySummary(
    companyId: string,
    filters: BookFilters,
    pagination: Pagination,
  ): Promise<BookResult> {
    const equityCodes = ['411', '421'];
    const results: unknown[] = [];
    let totalDebit = ZERO;
    let totalCredit = ZERO;

    for (const code of equityCodes) {
      const accounts = await this.prisma.ledgerAccount.findMany({
        where: { companyId, code: { startsWith: code } },
      });

      for (const account of accounts) {
        const opening = await this.getAccountIdOpeningBalance(companyId, account.id, filters.startDate);

        const agg = await this.prisma.journalEntryLine.aggregate({
          where: {
            accountId: account.id,
            journalEntry: {
              companyId,
              status: 'POSTED',
              postingDate: { gte: new Date(filters.startDate), lte: new Date(filters.endDate) },
            },
          },
          _sum: { debitAmount: true, creditAmount: true },
        });

        const debit = agg._sum.debitAmount ?? ZERO;
        const credit = agg._sum.creditAmount ?? ZERO;
        totalDebit = totalDebit.add(debit);
        totalCredit = totalCredit.add(credit);

        results.push({
          accountCode: account.code,
          accountName: account.name,
          openingBalance: opening.balance,
          debit,
          credit,
          movement: credit.sub(debit),
          closingBalance: opening.balance.add(credit).sub(debit),
        });
      }
    }

    return {
      data: results,
      openingBalance: { debit: ZERO, credit: ZERO, balance: ZERO },
      closingBalance: { debit: totalDebit, credit: totalCredit, balance: totalCredit.sub(totalDebit) },
      totals: { totalDebit, totalCredit },
    };
  }

  // ── Private helpers ──

  private async getLedgerByAccountCode(
    companyId: string,
    accountCode: string,
    filters: BookFilters,
    pagination: Pagination,
    extraWhere?: Record<string, unknown>,
  ): Promise<BookResult> {
    const account = await this.prisma.ledgerAccount.findFirst({
      where: { companyId, code: { startsWith: accountCode } },
    });
    if (!account) {
      return {
        data: [],
        openingBalance: { debit: ZERO, credit: ZERO, balance: ZERO },
        closingBalance: { debit: ZERO, credit: ZERO, balance: ZERO },
        totals: { totalDebit: ZERO, totalCredit: ZERO },
      };
    }
    return this.getLedgerByAccountId(companyId, account.id, filters, pagination, extraWhere);
  }

  private async getLedgerByAccountId(
    companyId: string,
    accountId: string,
    filters: BookFilters,
    pagination: Pagination,
    extraWhere?: Record<string, unknown>,
  ): Promise<BookResult> {
    const { skip, take } = this.getPagination(pagination);
    const { startDate, endDate } = filters;

    const opening = await this.getAccountIdOpeningBalance(companyId, accountId, startDate, extraWhere);

    const where = {
      accountId,
      journalEntry: {
        companyId,
        status: 'POSTED' as const,
        postingDate: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      ...extraWhere,
    };

    const lines = await this.prisma.journalEntryLine.findMany({
      where,
      include: {
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            postingDate: true,
            description: true,
            createdAt: true,
            lines: {
              where: { accountId: { not: accountId } },
              include: { account: { select: { code: true, name: true } } },
            },
            // Include accounting transaction to get voucher reference (one-to-one)
            accountingTransaction: {
              select: { sourceType: true, sourceId: true },
            },
          },
        },
        account: { select: { code: true, name: true } },
        customer: { select: { code: true, name: true } },
        vendor: { select: { code: true, name: true } },
        employee: { select: { code: true, name: true } },
        inventoryItem: { select: { code: true, name: true } },
      },
      orderBy: { journalEntry: { postingDate: 'asc' } },
      skip,
      take,
    });

    // Fetch voucher data for all lines that have voucher references
    const voucherIds = lines
      .map((l) => l.journalEntry.accountingTransaction)
      .filter((t): t is NonNullable<typeof t> => t !== null && t.sourceType === 'voucher')
      .map((t) => t.sourceId);
    
    const vouchers = voucherIds.length > 0
      ? await this.prisma.voucher.findMany({
          where: { id: { in: voucherIds } },
          select: {
            id: true,
            voucherType: true,
            voucherNumber: true,
            date: true,
            partyFullName: true,
            counterpartyName: true,
          },
        })
      : [];
    
    const voucherMap = new Map(vouchers.map((v) => [v.id, v]));

    let runningBalance = opening.balance;
    const dataWithBalance = lines.map((line) => {
      runningBalance = runningBalance.add(line.debitAmount).sub(line.creditAmount);
      
      // Get voucher info if available
      const txn = line.journalEntry.accountingTransaction;
      const voucher = txn?.sourceType === 'voucher' ? voucherMap.get(txn.sourceId) : null;
      
      return {
        ...line,
        contraAccounts: line.journalEntry.lines.map((l: { account: { code: string; name: string }; debitAmount: unknown; creditAmount: unknown }) => ({
          code: l.account.code,
          name: l.account.name,
          debitAmount: l.debitAmount,
          creditAmount: l.creditAmount,
        })),
        runningBalance,
        isNegativeBalance: runningBalance.lt(ZERO),
        // Enhanced voucher info for Cash Book (TT200/TT133 compliance)
        voucher: voucher ? {
          voucherType: voucher.voucherType,
          voucherNumber: voucher.voucherNumber,
          voucherDate: voucher.date,
          recordingDate: line.journalEntry.createdAt,
          partyName: voucher.partyFullName ?? voucher.counterpartyName,
          // Separate PT/PC numbers for cash book columns
          receiptNo: voucher.voucherType === 'PT' ? voucher.voucherNumber : null,
          paymentNo: voucher.voucherType === 'PC' ? voucher.voucherNumber : null,
        } : null,
      };
    });

    const period = this.computeBalance(lines);

    return {
      data: dataWithBalance,
      openingBalance: opening,
      closingBalance: { debit: ZERO, credit: ZERO, balance: opening.balance.add(period.balance) },
      totals: { totalDebit: period.totalDebit, totalCredit: period.totalCredit },
    };
  }
}
