import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

interface CreateBadDebtData {
  customerId: string;
  amount: number;
  reason: string;
  provisionDate: string | Date;
  fiscalYearId: string;
}

interface BadDebtFilters {
  status?: string;
  customerId?: string;
}

interface Pagination {
  page?: number;
  limit?: number;
}

@Injectable()
export class BadDebtService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(companyId: string, data: CreateBadDebtData, userId: string) {
    const amount = new Decimal(data.amount);

    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, companyId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const provision = await tx.badDebtProvision.create({
        data: {
          companyId,
          customerId: data.customerId,
          amount,
          reason: data.reason,
          provisionDate: new Date(data.provisionDate),
          status: 'PROVISIONED',
        },
      });

      // JE: Dr TK642 (admin expense) Cr TK229 (provision for bad debts)
      const count = await tx.journalEntry.count({
        where: { companyId, fiscalYearId: data.fiscalYearId },
      });
      const entryNumber = `JE-${String(count + 1).padStart(6, '0')}`;

      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          fiscalYearId: data.fiscalYearId,
          entryNumber,
          postingDate: new Date(data.provisionDate),
          description: `Bad debt provision: ${customer.code} - ${customer.name}`,
          status: 'POSTED',
          entryType: 'STANDARD',
          totalDebit: amount,
          totalCredit: amount,
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          lines: {
            create: [
              { accountId: '642', debitAmount: amount, creditAmount: 0, lineOrder: 1, description: `Bad debt expense - ${customer.name}`, customerId: data.customerId },
              { accountId: '229', debitAmount: 0, creditAmount: amount, lineOrder: 2, description: `Provision for bad debts - ${customer.name}`, customerId: data.customerId },
            ],
          },
        },
      });

      await tx.badDebtProvision.update({
        where: { id: provision.id },
        data: { journalEntryId: journalEntry.id },
      });

      await tx.accountingTransaction.create({
        data: {
          journalEntryId: journalEntry.id,
          sourceType: 'bad_debt',
          sourceId: provision.id,
          description: `Bad debt provision: ${customer.code}`,
        },
      });

      return { provision, journalEntry };
    });

    await this.auditService.create(
      companyId,
      userId,
      'CREATE',
      'BadDebtProvision',
      result.provision.id,
      undefined,
      result.provision as unknown as Record<string, unknown>,
    );

    this.eventEmitter.emit('journal.posted', {
      companyId,
      journalEntryId: result.journalEntry.id,
      entryNumber: result.journalEntry.entryNumber,
      userId,
    });

    return result;
  }

  async findAll(companyId: string, filters: BadDebtFilters = {}, pagination: Pagination = {}) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };
    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = filters.customerId;

    const [data, total] = await Promise.all([
      this.prisma.badDebtProvision.findMany({
        where,
        orderBy: { provisionDate: 'desc' },
        skip,
        take: limit,
        include: {
          customer: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.badDebtProvision.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(companyId: string, id: string) {
    const provision = await this.prisma.badDebtProvision.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: { id: true, code: true, name: true, taxCode: true } },
      },
    });
    if (!provision) {
      throw new NotFoundException('Bad debt provision not found');
    }
    return provision;
  }

  async reverse(companyId: string, id: string, userId: string, fiscalYearId: string) {
    const provision = await this.prisma.badDebtProvision.findFirst({
      where: { id, companyId },
      include: { customer: true },
    });
    if (!provision) {
      throw new NotFoundException('Bad debt provision not found');
    }
    if (provision.status !== 'PROVISIONED') {
      throw new BadRequestException('Only PROVISIONED records can be reversed');
    }

    const amount = provision.amount;

    const result = await this.prisma.$transaction(async (tx) => {
      // Reversal JE: Dr TK229 Cr TK642
      const count = await tx.journalEntry.count({
        where: { companyId, fiscalYearId },
      });
      const entryNumber = `JE-${String(count + 1).padStart(6, '0')}`;

      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          fiscalYearId,
          entryNumber,
          postingDate: new Date(),
          description: `Bad debt reversal: ${provision.customer.code} - ${provision.customer.name}`,
          status: 'POSTED',
          entryType: 'REVERSAL',
          totalDebit: amount,
          totalCredit: amount,
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          lines: {
            create: [
              { accountId: '229', debitAmount: amount, creditAmount: 0, lineOrder: 1, description: `Reverse provision - ${provision.customer.name}`, customerId: provision.customerId },
              { accountId: '642', debitAmount: 0, creditAmount: amount, lineOrder: 2, description: `Reverse bad debt expense - ${provision.customer.name}`, customerId: provision.customerId },
            ],
          },
        },
      });

      const updated = await tx.badDebtProvision.update({
        where: { id },
        data: {
          status: 'REVERSED',
          reversalDate: new Date(),
          reversalEntryId: journalEntry.id,
        },
      });

      await tx.accountingTransaction.create({
        data: {
          journalEntryId: journalEntry.id,
          sourceType: 'bad_debt',
          sourceId: id,
          description: `Bad debt reversal: ${provision.customer.code}`,
        },
      });

      return { provision: updated, journalEntry };
    });

    await this.auditService.create(
      companyId,
      userId,
      'REVERSE',
      'BadDebtProvision',
      id,
      { status: 'PROVISIONED' },
      { status: 'REVERSED' },
    );

    this.eventEmitter.emit('journal.posted', {
      companyId,
      journalEntryId: result.journalEntry.id,
      entryNumber: result.journalEntry.entryNumber,
      userId,
    });

    return result;
  }

  async writeOff(companyId: string, id: string, userId: string, fiscalYearId: string) {
    const provision = await this.prisma.badDebtProvision.findFirst({
      where: { id, companyId },
      include: { customer: true },
    });
    if (!provision) {
      throw new NotFoundException('Bad debt provision not found');
    }
    if (provision.status !== 'PROVISIONED') {
      throw new BadRequestException('Only PROVISIONED records can be written off');
    }

    const amount = provision.amount;

    const result = await this.prisma.$transaction(async (tx) => {
      // Write-off JE: Dr TK229 Cr TK131, record in TK004 (off-balance-sheet)
      const count = await tx.journalEntry.count({
        where: { companyId, fiscalYearId },
      });
      const entryNumber = `JE-${String(count + 1).padStart(6, '0')}`;

      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          fiscalYearId,
          entryNumber,
          postingDate: new Date(),
          description: `Bad debt write-off: ${provision.customer.code} - ${provision.customer.name}`,
          status: 'POSTED',
          entryType: 'STANDARD',
          totalDebit: amount,
          totalCredit: amount,
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          lines: {
            create: [
              { accountId: '229', debitAmount: amount, creditAmount: 0, lineOrder: 1, description: `Write off provision - ${provision.customer.name}`, customerId: provision.customerId },
              { accountId: '131', debitAmount: 0, creditAmount: amount, lineOrder: 2, description: `Write off receivable - ${provision.customer.name}`, customerId: provision.customerId },
            ],
          },
        },
      });

      // Also record in off-balance-sheet TK004
      const obsEntryNumber = `JE-${String(count + 2).padStart(6, '0')}`;
      await tx.journalEntry.create({
        data: {
          companyId,
          fiscalYearId,
          entryNumber: obsEntryNumber,
          postingDate: new Date(),
          description: `Off-balance-sheet: written-off receivable ${provision.customer.code}`,
          status: 'POSTED',
          entryType: 'STANDARD',
          totalDebit: amount,
          totalCredit: 0,
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          lines: {
            create: [
              { accountId: '004', debitAmount: amount, creditAmount: 0, lineOrder: 1, description: `Written-off receivable - ${provision.customer.name}`, customerId: provision.customerId },
            ],
          },
        },
      });

      const updated = await tx.badDebtProvision.update({
        where: { id },
        data: {
          status: 'WRITTEN_OFF',
          writeOffDate: new Date(),
          writeOffEntryId: journalEntry.id,
        },
      });

      await tx.accountingTransaction.create({
        data: {
          journalEntryId: journalEntry.id,
          sourceType: 'bad_debt',
          sourceId: id,
          description: `Bad debt write-off: ${provision.customer.code}`,
        },
      });

      return { provision: updated, journalEntry };
    });

    await this.auditService.create(
      companyId,
      userId,
      'WRITE_OFF',
      'BadDebtProvision',
      id,
      { status: 'PROVISIONED' },
      { status: 'WRITTEN_OFF' },
    );

    this.eventEmitter.emit('journal.posted', {
      companyId,
      journalEntryId: result.journalEntry.id,
      entryNumber: result.journalEntry.entryNumber,
      userId,
    });

    return result;
  }

  async getReport(companyId: string, periodStart?: string, periodEnd?: string) {
    const where: Record<string, unknown> = { companyId };

    if (periodStart || periodEnd) {
      const provisionDate: Record<string, Date> = {};
      if (periodStart) provisionDate.gte = new Date(periodStart);
      if (periodEnd) provisionDate.lte = new Date(periodEnd);
      where.provisionDate = provisionDate;
    }

    const provisions = await this.prisma.badDebtProvision.findMany({
      where,
      include: {
        customer: { select: { id: true, code: true, name: true } },
      },
      orderBy: { provisionDate: 'asc' },
    });

    // Group by customer
    const customerMap = new Map<
      string,
      {
        customer: { id: string; code: string; name: string };
        opening: Decimal;
        additions: Decimal;
        reversals: Decimal;
        writeOffs: Decimal;
        closing: Decimal;
      }
    >();

    for (const p of provisions) {
      const key = p.customerId;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          customer: p.customer,
          opening: new Decimal(0),
          additions: new Decimal(0),
          reversals: new Decimal(0),
          writeOffs: new Decimal(0),
          closing: new Decimal(0),
        });
      }
      const entry = customerMap.get(key)!;

      if (p.status === 'PROVISIONED') {
        entry.additions = entry.additions.add(p.amount);
        entry.closing = entry.closing.add(p.amount);
      } else if (p.status === 'REVERSED') {
        entry.additions = entry.additions.add(p.amount);
        entry.reversals = entry.reversals.add(p.amount);
      } else if (p.status === 'WRITTEN_OFF') {
        entry.additions = entry.additions.add(p.amount);
        entry.writeOffs = entry.writeOffs.add(p.amount);
      }
    }

    const report = Array.from(customerMap.values());

    const totals = report.reduce(
      (acc, r) => ({
        opening: acc.opening.add(r.opening),
        additions: acc.additions.add(r.additions),
        reversals: acc.reversals.add(r.reversals),
        writeOffs: acc.writeOffs.add(r.writeOffs),
        closing: acc.closing.add(r.closing),
      }),
      {
        opening: new Decimal(0),
        additions: new Decimal(0),
        reversals: new Decimal(0),
        writeOffs: new Decimal(0),
        closing: new Decimal(0),
      },
    );

    return { details: report, totals };
  }
}
