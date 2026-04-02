import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../../redis/redis.service';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

const ALLOWED_DIMENSIONS = [
  'account_code',
  'account_name',
  'account_type',
  'customer_code',
  'customer_name',
  'vendor_code',
  'vendor_name',
  'employee_code',
  'employee_name',
  'posting_date',
  'entry_type',
  'department',
];

const ALLOWED_MEASURES = ['sum_debit', 'sum_credit', 'count', 'balance'];

const DIMENSION_TO_COLUMN: Record<string, string> = {
  account_code: 'la.code',
  account_name: 'la.name',
  account_type: 'la."accountType"',
  customer_code: 'c.code',
  customer_name: 'c.name',
  vendor_code: 'v.code',
  vendor_name: 'v.name',
  employee_code: 'e.code',
  employee_name: 'e.name',
  posting_date: 'je."postingDate"',
  entry_type: 'je."entryType"',
  department: 'e.department',
};

interface ReportConfig {
  dimensions: string[];
  measures: string[];
  filters: { field: string; operator: string; value: unknown }[];
  sorting?: { field: string; direction: 'asc' | 'desc' }[];
}

interface CreateTemplateData {
  name: string;
  description?: string;
  config: ReportConfig;
  isShared?: boolean;
}

interface Pagination {
  page?: number;
  limit?: number;
}

@Injectable()
export class DynamicReportService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private redisService: RedisService,
  ) {}

  // ── Template CRUD ──

  async createTemplate(companyId: string, data: CreateTemplateData, userId: string) {
    const template = await this.prisma.dynamicReportTemplate.create({
      data: {
        companyId,
        name: data.name,
        description: data.description,
        config: data.config as unknown as Prisma.InputJsonValue,
        isShared: data.isShared ?? false,
        createdById: userId,
      },
    });

    await this.auditService.create(companyId, userId, 'CREATE', 'DynamicReportTemplate', template.id, undefined, data as unknown as Record<string, unknown>);
    return template;
  }

  async findAllTemplates(companyId: string) {
    return this.prisma.dynamicReportTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneTemplate(companyId: string, id: string) {
    const template = await this.prisma.dynamicReportTemplate.findFirst({
      where: { id, companyId },
    });
    if (!template) throw new NotFoundException('Report template not found');
    return template;
  }

  async updateTemplate(companyId: string, id: string, data: Partial<CreateTemplateData>, userId: string) {
    const existing = await this.findOneTemplate(companyId, id);

    const updated = await this.prisma.dynamicReportTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        config: data.config as unknown as Prisma.InputJsonValue,
        isShared: data.isShared,
      },
    });

    await this.auditService.create(
      companyId, userId, 'UPDATE', 'DynamicReportTemplate', id,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );
    return updated;
  }

  async deleteTemplate(companyId: string, id: string, userId: string) {
    const existing = await this.findOneTemplate(companyId, id);

    await this.prisma.dynamicReportTemplate.delete({ where: { id } });

    await this.auditService.create(
      companyId, userId, 'DELETE', 'DynamicReportTemplate', id,
      existing as unknown as Record<string, unknown>,
    );
    return { deleted: true };
  }

  // ── Execute Dynamic Report ──

  async executeReport(companyId: string, config: ReportConfig) {
    // Validate dimensions and measures
    for (const dim of config.dimensions) {
      if (!ALLOWED_DIMENSIONS.includes(dim)) {
        throw new BadRequestException(`Invalid dimension: ${dim}`);
      }
    }
    for (const measure of config.measures) {
      if (!ALLOWED_MEASURES.includes(measure)) {
        throw new BadRequestException(`Invalid measure: ${measure}`);
      }
    }

    // Build SELECT clause
    const selectParts: string[] = [];
    const groupByParts: string[] = [];

    for (const dim of config.dimensions) {
      const col = DIMENSION_TO_COLUMN[dim];
      if (!col) throw new BadRequestException(`Unknown dimension: ${dim}`);
      selectParts.push(`${col} AS "${dim}"`);
      groupByParts.push(col);
    }

    for (const measure of config.measures) {
      switch (measure) {
        case 'sum_debit':
          selectParts.push('SUM(jel."debitAmount") AS "sum_debit"');
          break;
        case 'sum_credit':
          selectParts.push('SUM(jel."creditAmount") AS "sum_credit"');
          break;
        case 'count':
          selectParts.push('COUNT(jel.id) AS "count"');
          break;
        case 'balance':
          selectParts.push('SUM(jel."debitAmount") - SUM(jel."creditAmount") AS "balance"');
          break;
      }
    }

    // Build FROM / JOINs
    const from = `
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel."journalEntryId"
      LEFT JOIN ledger_accounts la ON la.id = jel."accountId"
      LEFT JOIN customers c ON c.id = jel."customerId"
      LEFT JOIN vendors v ON v.id = jel."vendorId"
      LEFT JOIN employees e ON e.id = jel."employeeId"
    `;

    // Build WHERE clause with parameterized queries
    const whereParts: string[] = ['je."companyId" = $1', 'je.status = \'POSTED\''];
    const params: unknown[] = [companyId];
    let paramIdx = 2;

    const ALLOWED_FILTER_FIELDS: Record<string, string> = {
      startDate: 'je."postingDate"',
      endDate: 'je."postingDate"',
      accountId: 'jel."accountId"',
      accountCode: 'la.code',
      customerId: 'jel."customerId"',
      vendorId: 'jel."vendorId"',
      employeeId: 'jel."employeeId"',
      entryType: 'je."entryType"',
      accountType: 'la."accountType"',
    };

    const ALLOWED_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN'];

    for (const filter of config.filters) {
      const col = ALLOWED_FILTER_FIELDS[filter.field];
      if (!col) {
        throw new BadRequestException(`Invalid filter field: ${filter.field}`);
      }

      const op = filter.operator.toUpperCase();
      if (!ALLOWED_OPERATORS.includes(op)) {
        throw new BadRequestException(`Invalid operator: ${filter.operator}`);
      }

      if (filter.field === 'startDate') {
        whereParts.push(`je."postingDate" >= $${paramIdx}`);
        params.push(new Date(filter.value as string));
        paramIdx++;
      } else if (filter.field === 'endDate') {
        whereParts.push(`je."postingDate" <= $${paramIdx}`);
        params.push(new Date(filter.value as string));
        paramIdx++;
      } else if (op === 'IN' && Array.isArray(filter.value)) {
        const placeholders = filter.value.map(() => `$${paramIdx++}`);
        whereParts.push(`${col} IN (${placeholders.join(', ')})`);
        params.push(...filter.value);
      } else {
        whereParts.push(`${col} ${op} $${paramIdx}`);
        params.push(filter.value);
        paramIdx++;
      }
    }

    // Build ORDER BY
    let orderBy = '';
    if (config.sorting && config.sorting.length > 0) {
      const validSortFields = [...config.dimensions, ...config.measures];
      const sortParts = config.sorting
        .filter((s) => validSortFields.includes(s.field))
        .map((s) => `"${s.field}" ${s.direction === 'desc' ? 'DESC' : 'ASC'}`);
      if (sortParts.length) orderBy = `ORDER BY ${sortParts.join(', ')}`;
    }

    const sql = `
      SELECT ${selectParts.join(', ')}
      ${from}
      WHERE ${whereParts.join(' AND ')}
      ${groupByParts.length ? `GROUP BY ${groupByParts.join(', ')}` : ''}
      ${orderBy}
      LIMIT 10000
    `;

    const results = await this.prisma.$queryRawUnsafe(sql, ...params);
    return { data: results, query: { dimensions: config.dimensions, measures: config.measures } };
  }

  // ── Management Reports ──

  async revenueByCustomer(companyId: string, startDate: string, endDate: string) {
    const results = await this.prisma.journalEntryLine.groupBy({
      by: ['customerId'],
      where: {
        customerId: { not: null },
        account: { companyId, code: { startsWith: '511' } },
        journalEntry: {
          companyId,
          status: 'POSTED',
          postingDate: { gte: new Date(startDate), lte: new Date(endDate) },
        },
      },
      _sum: { creditAmount: true },
      orderBy: { _sum: { creditAmount: 'desc' } },
    });

    const customerIds = results.map((r) => r.customerId).filter(Boolean) as string[];
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, code: true, name: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    return results.map((r) => ({
      customer: customerMap.get(r.customerId!) ?? null,
      revenue: r._sum.creditAmount ?? ZERO,
    }));
  }

  async costByDepartment(companyId: string, startDate: string, endDate: string) {
    const results = await this.prisma.journalEntryLine.groupBy({
      by: ['employeeId'],
      where: {
        employeeId: { not: null },
        account: {
          companyId,
          accountType: 'EXPENSE',
        },
        journalEntry: {
          companyId,
          status: 'POSTED',
          postingDate: { gte: new Date(startDate), lte: new Date(endDate) },
        },
      },
      _sum: { debitAmount: true },
    });

    const employeeIds = results.map((r) => r.employeeId).filter(Boolean) as string[];
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, department: true },
    });
    const empMap = new Map(employees.map((e) => [e.id, e.department ?? 'Unassigned']));

    const deptTotals: Record<string, Decimal> = {};
    for (const r of results) {
      const dept = empMap.get(r.employeeId!) ?? 'Unassigned';
      deptTotals[dept] = (deptTotals[dept] ?? ZERO).add(r._sum.debitAmount ?? ZERO);
    }

    return Object.entries(deptTotals).map(([department, total]) => ({ department, total }));
  }

  async agingReport(
    companyId: string,
    startDate: string,
    endDate: string,
    buckets: number[] = [30, 60, 90, 120],
  ) {
    const customers = await this.prisma.customer.findMany({
      where: { companyId, isActive: true },
      select: { id: true, code: true, name: true },
    });

    const today = new Date(endDate);
    const result: unknown[] = [];

    for (const customer of customers) {
      const lines = await this.prisma.journalEntryLine.findMany({
        where: {
          customerId: customer.id,
          account: { companyId, code: { startsWith: '131' } },
          journalEntry: {
            companyId,
            status: 'POSTED',
            postingDate: { lte: today },
          },
        },
        include: {
          journalEntry: { select: { postingDate: true } },
        },
      });

      const aging: Record<string, Decimal> = { current: ZERO };
      for (const bucket of buckets) aging[`${bucket}d`] = ZERO;
      aging['overdue'] = ZERO;

      for (const line of lines) {
        const balance = line.debitAmount.sub(line.creditAmount);
        if (balance.lte(ZERO)) continue;

        const daysDiff = Math.floor(
          (today.getTime() - line.journalEntry.postingDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        let placed = false;
        for (let i = 0; i < buckets.length; i++) {
          const lower = i === 0 ? 0 : buckets[i - 1]!;
          if (daysDiff >= lower && daysDiff < buckets[i]!) {
            aging[i === 0 ? 'current' : `${buckets[i]}d`] = aging[i === 0 ? 'current' : `${buckets[i]}d`]!.add(balance);
            placed = true;
            break;
          }
        }
        if (!placed) {
          aging['overdue'] = aging['overdue']!.add(balance);
        }
      }

      const total = Object.values(aging).reduce((sum, v) => sum.add(v), ZERO);
      if (total.gt(ZERO)) {
        result.push({ customer, aging, total });
      }
    }

    return result;
  }

  async budgetVsActual(companyId: string, startDate: string, endDate: string) {
    // Budget comparison—uses account-level actual balances since budget model is not yet defined
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { companyId, accountType: { in: ['EXPENSE', 'REVENUE'] } },
      orderBy: { code: 'asc' },
    });

    const results: unknown[] = [];
    for (const account of accounts) {
      const agg = await this.prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: {
            companyId,
            status: 'POSTED',
            postingDate: { gte: new Date(startDate), lte: new Date(endDate) },
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });

      const actual = account.normalBalance === 'DEBIT'
        ? (agg._sum.debitAmount ?? ZERO).sub(agg._sum.creditAmount ?? ZERO)
        : (agg._sum.creditAmount ?? ZERO).sub(agg._sum.debitAmount ?? ZERO);

      results.push({
        accountCode: account.code,
        accountName: account.name,
        accountType: account.accountType,
        actual,
        budget: null, // Budget model not implemented yet
        variance: null,
      });
    }

    return results;
  }

  async trendAnalysis(companyId: string, months: number = 12) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        status: 'POSTED',
        postingDate: { gte: startDate, lte: endDate },
      },
      select: {
        postingDate: true,
        totalDebit: true,
        lines: {
          select: {
            debitAmount: true,
            creditAmount: true,
            account: { select: { code: true, accountType: true } },
          },
        },
      },
      orderBy: { postingDate: 'asc' },
    });

    const monthlyData: Record<string, { revenue: Decimal; expense: Decimal; profit: Decimal }> = {};

    for (const entry of entries) {
      const monthKey = `${entry.postingDate.getFullYear()}-${String(entry.postingDate.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: ZERO, expense: ZERO, profit: ZERO };
      }
      const monthEntry = monthlyData[monthKey]!;

      for (const line of entry.lines) {
        if (line.account.accountType === 'REVENUE') {
          monthEntry.revenue = monthEntry.revenue.add(line.creditAmount);
        } else if (line.account.accountType === 'EXPENSE') {
          monthEntry.expense = monthEntry.expense.add(line.debitAmount);
        }
      }
    }

    for (const key of Object.keys(monthlyData)) {
      const entry = monthlyData[key]!;
      entry.profit = entry.revenue.sub(entry.expense);
    }

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));
  }

  async collectionPerformance(companyId: string, startDate: string, endDate: string) {
    const customers = await this.prisma.customer.findMany({
      where: { companyId, isActive: true },
      select: { id: true, code: true, name: true },
    });

    const results: unknown[] = [];

    for (const customer of customers) {
      // Total invoiced (debit to TK 131)
      const invoicedAgg = await this.prisma.journalEntryLine.aggregate({
        where: {
          customerId: customer.id,
          account: { companyId, code: { startsWith: '131' } },
          debitAmount: { gt: 0 },
          journalEntry: {
            companyId,
            status: 'POSTED',
            postingDate: { gte: new Date(startDate), lte: new Date(endDate) },
          },
        },
        _sum: { debitAmount: true },
      });

      // Total collected (credit to TK 131)
      const collectedAgg = await this.prisma.journalEntryLine.aggregate({
        where: {
          customerId: customer.id,
          account: { companyId, code: { startsWith: '131' } },
          creditAmount: { gt: 0 },
          journalEntry: {
            companyId,
            status: 'POSTED',
            postingDate: { gte: new Date(startDate), lte: new Date(endDate) },
          },
        },
        _sum: { creditAmount: true },
      });

      const invoiced = invoicedAgg._sum.debitAmount ?? ZERO;
      const collected = collectedAgg._sum.creditAmount ?? ZERO;
      const outstanding = invoiced.sub(collected);
      const collectionRate = invoiced.gt(ZERO)
        ? collected.div(invoiced).mul(100).toDecimalPlaces(2)
        : ZERO;

      if (invoiced.gt(ZERO)) {
        results.push({
          customer,
          invoiced,
          collected,
          outstanding,
          collectionRate,
        });
      }
    }

    return results;
  }

  async detailedCashFlow(companyId: string, startDate: string, endDate: string) {
    const cashAccounts = await this.prisma.ledgerAccount.findMany({
      where: {
        companyId,
        OR: [{ code: { startsWith: '111' } }, { code: { startsWith: '112' } }],
      },
    });
    const cashAccountIds = cashAccounts.map((a) => a.id);

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: cashAccountIds },
        journalEntry: {
          companyId,
          status: 'POSTED',
          postingDate: { gte: new Date(startDate), lte: new Date(endDate) },
        },
      },
      include: {
        account: { select: { code: true, name: true } },
        journalEntry: {
          select: {
            entryNumber: true,
            postingDate: true,
            description: true,
            lines: {
              include: { account: { select: { code: true, name: true } } },
            },
          },
        },
        customer: { select: { code: true, name: true } },
        vendor: { select: { code: true, name: true } },
      },
      orderBy: { journalEntry: { postingDate: 'asc' } },
    });

    return lines.map((line) => ({
      date: line.journalEntry.postingDate,
      entryNumber: line.journalEntry.entryNumber,
      description: line.journalEntry.description,
      cashAccount: { code: line.account.code, name: line.account.name },
      debit: line.debitAmount,
      credit: line.creditAmount,
      net: line.debitAmount.sub(line.creditAmount),
      counterparty: line.customer ?? line.vendor ?? null,
      contraAccounts: line.journalEntry.lines
        .filter((l) => !cashAccountIds.includes(l.accountId))
        .map((l) => ({ code: l.account.code, name: l.account.name })),
    }));
  }

  // ── Event handler: invalidate cache on journal posting ──

  @OnEvent('journal.posted')
  async handleJournalPosted(payload: { companyId: string }) {
    await this.redisService.delByPattern(`report:${payload.companyId}:*`);
  }
}
