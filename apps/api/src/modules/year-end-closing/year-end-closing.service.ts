import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

// Revenue accounts to close to TK 911
const REVENUE_ACCOUNTS = ['511', '515', '711'];
// Expense accounts to close to TK 911
const EXPENSE_ACCOUNTS = ['632', '635', '641', '642', '811', '821'];
// TK 911 = Xác định kết quả kinh doanh (Income Summary)
const INCOME_SUMMARY_CODE = '911';
// TK 421 = Lợi nhuận chưa phân phối (Retained Earnings)
const RETAINED_EARNINGS_CODE = '421';

interface ChecklistItem {
  check: string;
  passed: boolean;
  details?: string;
}

@Injectable()
export class YearEndClosingService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getPreClosingChecklist(
    companyId: string,
    fiscalYearId: string,
  ): Promise<{ fiscalYear: unknown; checklist: ChecklistItem[]; canClose: boolean }> {
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId },
      include: { periods: true },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');

    const checklist: ChecklistItem[] = [];

    // 1. Check fiscal year is not already closed
    const notClosed = fiscalYear.status !== 'CLOSED';
    checklist.push({
      check: 'Năm tài chính chưa đóng',
      passed: notClosed,
      details: notClosed ? undefined : 'Fiscal year is already closed',
    });

    // 2. Check no draft journal entries
    const draftCount = await this.prisma.journalEntry.count({
      where: { companyId, fiscalYearId, status: 'DRAFT' },
    });
    checklist.push({
      check: 'Không có bút toán nháp',
      passed: draftCount === 0,
      details: draftCount > 0 ? `${draftCount} draft entries remaining` : undefined,
    });

    // 3. Check all periods are balanced (debits = credits)
    const entries = await this.prisma.journalEntry.findMany({
      where: { companyId, fiscalYearId, status: 'POSTED' },
      select: { totalDebit: true, totalCredit: true },
    });
    const allBalanced = entries.every((e) => e.totalDebit.eq(e.totalCredit));
    checklist.push({
      check: 'Tất cả bút toán cân bằng',
      passed: allBalanced,
      details: allBalanced ? undefined : 'Some entries have debit/credit imbalance',
    });

    // 4. Check depreciation run for all months
    const activeAssets = await this.prisma.fixedAsset.count({
      where: { companyId, status: 'ACTIVE' },
    });
    const periodsCount = fiscalYear.periods.length;
    const deprScheduleCount = await this.prisma.depreciationSchedule.count({
      where: {
        fixedAsset: { companyId },
        periodDate: { gte: fiscalYear.startDate, lte: fiscalYear.endDate },
        isPosted: true,
      },
    });
    const expectedDepr = activeAssets * periodsCount;
    const deprComplete = expectedDepr === 0 || deprScheduleCount >= expectedDepr;
    checklist.push({
      check: 'Khấu hao đã chạy đầy đủ',
      passed: deprComplete,
      details: deprComplete ? undefined : `${deprScheduleCount}/${expectedDepr} depreciation entries posted`,
    });

    // 5. Check VAT reconciled
    const vatInputSum = await this.prisma.vatRecord.aggregate({
      where: {
        companyId,
        direction: 'INPUT',
        invoiceDate: { gte: fiscalYear.startDate, lte: fiscalYear.endDate },
      },
      _sum: { vatAmount: true },
    });
    const vatOutputSum = await this.prisma.vatRecord.aggregate({
      where: {
        companyId,
        direction: 'OUTPUT',
        invoiceDate: { gte: fiscalYear.startDate, lte: fiscalYear.endDate },
      },
      _sum: { vatAmount: true },
    });
    checklist.push({
      check: 'Thuế GTGT đã đối chiếu',
      passed: true,
      details: `VAT đầu vào: ${vatInputSum._sum.vatAmount ?? 0}, VAT đầu ra: ${vatOutputSum._sum.vatAmount ?? 0}`,
    });

    const canClose = checklist.every((item) => item.passed);

    return { fiscalYear, checklist, canClose };
  }

  async executeClosing(
    companyId: string,
    fiscalYearId: string,
    userId: string,
  ) {
    const { canClose, checklist } = await this.getPreClosingChecklist(companyId, fiscalYearId);
    if (!canClose) {
      throw new BadRequestException({
        message: 'Pre-closing checklist has failures',
        checklist: checklist.filter((c) => !c.passed),
      });
    }

    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId },
      include: { periods: true },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');

    // Get TK 911 (Income Summary) account
    const incomeSummaryAccount = await this.prisma.ledgerAccount.findFirst({
      where: { companyId, code: INCOME_SUMMARY_CODE },
    });
    if (!incomeSummaryAccount) throw new BadRequestException('Account TK 911 not found');

    // Get TK 421 (Retained Earnings) account
    const retainedEarningsAccount = await this.prisma.ledgerAccount.findFirst({
      where: { companyId, code: RETAINED_EARNINGS_CODE },
    });
    if (!retainedEarningsAccount) throw new BadRequestException('Account TK 421 not found');

    const closingDate = fiscalYear.endDate;
    const createdEntries: string[] = [];

    // Generate unique entry number
    const lastEntry = await this.prisma.journalEntry.findFirst({
      where: { companyId },
      orderBy: { entryNumber: 'desc' },
      select: { entryNumber: true },
    });
    let entrySeq = lastEntry ? parseInt(lastEntry.entryNumber.replace(/\D/g, ''), 10) + 1 : 1;

    // ── Step 1: Close revenue accounts to TK 911 ──
    for (const code of REVENUE_ACCOUNTS) {
      const accounts = await this.prisma.ledgerAccount.findMany({
        where: { companyId, code: { startsWith: code } },
      });

      for (const account of accounts) {
        const agg = await this.prisma.journalEntryLine.aggregate({
          where: {
            accountId: account.id,
            journalEntry: {
              companyId,
              fiscalYearId,
              status: 'POSTED',
              entryType: { not: 'CLOSING' },
            },
          },
          _sum: { debitAmount: true, creditAmount: true },
        });

        const balance = (agg._sum.creditAmount ?? ZERO).sub(agg._sum.debitAmount ?? ZERO);
        if (balance.eq(ZERO)) continue;

        const entryNumber = `CL${String(entrySeq++).padStart(6, '0')}`;
        const entry = await this.prisma.journalEntry.create({
          data: {
            companyId,
            fiscalYearId,
            entryNumber,
            postingDate: closingDate,
            description: `Kết chuyển ${account.name} (${account.code}) sang TK 911`,
            status: 'POSTED',
            entryType: 'CLOSING',
            totalDebit: balance.abs(),
            totalCredit: balance.abs(),
            postedAt: new Date(),
            postedById: userId,
            createdById: userId,
            lines: {
              create: [
                {
                  accountId: account.id,
                  debitAmount: balance,
                  creditAmount: ZERO,
                  lineOrder: 1,
                  description: `Close ${account.code} to 911`,
                },
                {
                  accountId: incomeSummaryAccount.id,
                  debitAmount: ZERO,
                  creditAmount: balance,
                  lineOrder: 2,
                  description: `Revenue from ${account.code}`,
                },
              ],
            },
          },
        });
        createdEntries.push(entry.id);
      }
    }

    // ── Step 2: Close expense accounts to TK 911 ──
    for (const code of EXPENSE_ACCOUNTS) {
      const accounts = await this.prisma.ledgerAccount.findMany({
        where: { companyId, code: { startsWith: code } },
      });

      for (const account of accounts) {
        const agg = await this.prisma.journalEntryLine.aggregate({
          where: {
            accountId: account.id,
            journalEntry: {
              companyId,
              fiscalYearId,
              status: 'POSTED',
              entryType: { not: 'CLOSING' },
            },
          },
          _sum: { debitAmount: true, creditAmount: true },
        });

        const balance = (agg._sum.debitAmount ?? ZERO).sub(agg._sum.creditAmount ?? ZERO);
        if (balance.eq(ZERO)) continue;

        const entryNumber = `CL${String(entrySeq++).padStart(6, '0')}`;
        const entry = await this.prisma.journalEntry.create({
          data: {
            companyId,
            fiscalYearId,
            entryNumber,
            postingDate: closingDate,
            description: `Kết chuyển ${account.name} (${account.code}) sang TK 911`,
            status: 'POSTED',
            entryType: 'CLOSING',
            totalDebit: balance.abs(),
            totalCredit: balance.abs(),
            postedAt: new Date(),
            postedById: userId,
            createdById: userId,
            lines: {
              create: [
                {
                  accountId: incomeSummaryAccount.id,
                  debitAmount: balance,
                  creditAmount: ZERO,
                  lineOrder: 1,
                  description: `Expense from ${account.code}`,
                },
                {
                  accountId: account.id,
                  debitAmount: ZERO,
                  creditAmount: balance,
                  lineOrder: 2,
                  description: `Close ${account.code} to 911`,
                },
              ],
            },
          },
        });
        createdEntries.push(entry.id);
      }
    }

    // ── Step 3: Transfer TK 911 balance to TK 421 ──
    const tk911Agg = await this.prisma.journalEntryLine.aggregate({
      where: {
        accountId: incomeSummaryAccount.id,
        journalEntry: { companyId, fiscalYearId, status: 'POSTED' },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const tk911Balance = (tk911Agg._sum.creditAmount ?? ZERO).sub(tk911Agg._sum.debitAmount ?? ZERO);

    if (!tk911Balance.eq(ZERO)) {
      const entryNumber = `CL${String(entrySeq++).padStart(6, '0')}`;
      const isProfit = tk911Balance.gt(ZERO);

      const entry = await this.prisma.journalEntry.create({
        data: {
          companyId,
          fiscalYearId,
          entryNumber,
          postingDate: closingDate,
          description: isProfit
            ? 'Kết chuyển lãi sang TK 421 - Lợi nhuận chưa phân phối'
            : 'Kết chuyển lỗ sang TK 421 - Lợi nhuận chưa phân phối',
          status: 'POSTED',
          entryType: 'CLOSING',
          totalDebit: tk911Balance.abs(),
          totalCredit: tk911Balance.abs(),
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          lines: {
            create: isProfit
              ? [
                  { accountId: incomeSummaryAccount.id, debitAmount: tk911Balance, creditAmount: ZERO, lineOrder: 1 },
                  { accountId: retainedEarningsAccount.id, debitAmount: ZERO, creditAmount: tk911Balance, lineOrder: 2 },
                ]
              : [
                  { accountId: retainedEarningsAccount.id, debitAmount: tk911Balance.abs(), creditAmount: ZERO, lineOrder: 1 },
                  { accountId: incomeSummaryAccount.id, debitAmount: ZERO, creditAmount: tk911Balance.abs(), lineOrder: 2 },
                ],
          },
        },
      });
      createdEntries.push(entry.id);
    }

    // ── Step 4: Lock all periods & close fiscal year ──
    await this.prisma.fiscalPeriod.updateMany({
      where: { fiscalYearId },
      data: { status: 'LOCKED' },
    });

    await this.prisma.fiscalYear.update({
      where: { id: fiscalYearId },
      data: { status: 'CLOSED' },
    });

    // Emit event for cache invalidation
    this.eventEmitter.emit('journal.posted', { companyId });

    await this.auditService.create(
      companyId,
      userId,
      'CLOSE',
      'FiscalYear',
      fiscalYearId,
      undefined,
      { closingEntries: createdEntries, netIncome: tk911Balance.toString() },
    );

    return {
      message: 'Year-end closing completed successfully',
      closingEntries: createdEntries.length,
      netIncome: tk911Balance,
      fiscalYearStatus: 'CLOSED',
    };
  }

  async lockPeriod(companyId: string, periodId: string, userId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id: periodId, fiscalYear: { companyId } },
      include: { fiscalYear: true },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');
    if (period.status === 'LOCKED') throw new BadRequestException('Period is already locked');

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: { status: 'LOCKED' },
    });

    await this.auditService.create(
      companyId,
      userId,
      'LOCK',
      'FiscalPeriod',
      periodId,
      { status: 'OPEN' },
      { status: 'LOCKED' },
    );

    return updated;
  }

  async unlockPeriod(companyId: string, periodId: string, userId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id: periodId, fiscalYear: { companyId } },
      include: { fiscalYear: true },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');
    if (period.status === 'OPEN') throw new BadRequestException('Period is already open');
    if (period.fiscalYear.status === 'CLOSED') {
      throw new BadRequestException('Cannot unlock period in a closed fiscal year');
    }

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: { status: 'OPEN' },
    });

    await this.auditService.create(
      companyId,
      userId,
      'UNLOCK',
      'FiscalPeriod',
      periodId,
      { status: 'LOCKED' },
      { status: 'OPEN' },
    );

    return updated;
  }

  async carryForwardBalances(
    companyId: string,
    fromFiscalYearId: string,
    toFiscalYearId: string,
    userId: string,
  ) {
    const fromYear = await this.prisma.fiscalYear.findFirst({
      where: { id: fromFiscalYearId, companyId },
    });
    if (!fromYear) throw new NotFoundException('Source fiscal year not found');
    if (fromYear.status !== 'CLOSED') throw new BadRequestException('Source fiscal year must be closed');

    const toYear = await this.prisma.fiscalYear.findFirst({
      where: { id: toFiscalYearId, companyId },
    });
    if (!toYear) throw new NotFoundException('Target fiscal year not found');

    // Get all balance sheet accounts (1xx, 2xx, 3xx, 4xx)
    const balanceSheetAccounts = await this.prisma.ledgerAccount.findMany({
      where: {
        companyId,
        OR: [
          { code: { startsWith: '1' } },
          { code: { startsWith: '2' } },
          { code: { startsWith: '3' } },
          { code: { startsWith: '4' } },
        ],
        isActive: true,
      },
    });

    const lastEntry = await this.prisma.journalEntry.findFirst({
      where: { companyId },
      orderBy: { entryNumber: 'desc' },
      select: { entryNumber: true },
    });
    let entrySeq = lastEntry ? parseInt(lastEntry.entryNumber.replace(/\D/g, ''), 10) + 1 : 1;

    const openingLines: { accountId: string; debitAmount: Decimal; creditAmount: Decimal; lineOrder: number; description: string }[] = [];
    let lineOrder = 1;
    let totalDebit = ZERO;
    let totalCredit = ZERO;

    for (const account of balanceSheetAccounts) {
      const agg = await this.prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: {
            companyId,
            status: 'POSTED',
            postingDate: { lte: fromYear.endDate },
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });

      const debit = agg._sum.debitAmount ?? ZERO;
      const credit = agg._sum.creditAmount ?? ZERO;
      const balance = debit.sub(credit);

      if (balance.eq(ZERO)) continue;

      if (balance.gt(ZERO)) {
        openingLines.push({
          accountId: account.id,
          debitAmount: balance,
          creditAmount: ZERO,
          lineOrder: lineOrder++,
          description: `Số dư đầu kỳ ${account.code} - ${account.name}`,
        });
        totalDebit = totalDebit.add(balance);
      } else {
        openingLines.push({
          accountId: account.id,
          debitAmount: ZERO,
          creditAmount: balance.abs(),
          lineOrder: lineOrder++,
          description: `Số dư đầu kỳ ${account.code} - ${account.name}`,
        });
        totalCredit = totalCredit.add(balance.abs());
      }
    }

    if (openingLines.length === 0) {
      return { message: 'No balances to carry forward', entriesCreated: 0 };
    }

    const entryNumber = `OP${String(entrySeq).padStart(6, '0')}`;
    const entry = await this.prisma.journalEntry.create({
      data: {
        companyId,
        fiscalYearId: toFiscalYearId,
        entryNumber,
        postingDate: toYear.startDate,
        description: `Bút toán đầu kỳ - Kết chuyển số dư từ ${fromYear.name}`,
        status: 'POSTED',
        entryType: 'OPENING',
        totalDebit,
        totalCredit,
        postedAt: new Date(),
        postedById: userId,
        createdById: userId,
        lines: { create: openingLines },
      },
    });

    this.eventEmitter.emit('journal.posted', { companyId });

    await this.auditService.create(
      companyId,
      userId,
      'CARRY_FORWARD',
      'FiscalYear',
      toFiscalYearId,
      { fromFiscalYearId },
      { openingEntryId: entry.id, accountsCarried: openingLines.length },
    );

    return {
      message: 'Balances carried forward successfully',
      openingEntryId: entry.id,
      accountsCarried: openingLines.length,
      totalDebit,
      totalCredit,
    };
  }
}
