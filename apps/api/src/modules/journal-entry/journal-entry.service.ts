import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface JournalEntryLineData {
  accountId: string;
  description?: string;
  note?: string;
  debitAmount: number;
  creditAmount: number;
  lineOrder?: number;
  customerId?: string;
  vendorId?: string;
  inventoryItemId?: string;
  employeeId?: string;
}

interface CreateJournalEntryData {
  postingDate: string | Date;
  documentDate?: string | Date;  // Ngày chứng từ (original document date)
  description: string;
  entryType?: 'STANDARD' | 'ADJUSTMENT' | 'CLOSING' | 'REVERSAL' | 'OPENING';
  lines: JournalEntryLineData[];
  customFieldValues?: Record<string, unknown>;
}

interface JournalEntryFilters {
  fiscalYearId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

interface Pagination {
  page?: number;
  limit?: number;
}

@Injectable()
export class JournalEntryService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(
    companyId: string,
    fiscalYearId: string,
    data: CreateJournalEntryData,
    userId: string,
  ) {
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId },
    });
    if (!fiscalYear) {
      throw new NotFoundException('Fiscal year not found');
    }
    if (fiscalYear.status === 'CLOSED') {
      throw new BadRequestException('Fiscal year is closed');
    }

    if (!data.lines || data.lines.length === 0) {
      throw new BadRequestException('At least one line is required');
    }

    const totalDebit = data.lines.reduce(
      (sum, line) => sum + (line.debitAmount || 0),
      0,
    );
    const totalCredit = data.lines.reduce(
      (sum, line) => sum + (line.creditAmount || 0),
      0,
    );

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Total debit (${totalDebit}) must equal total credit (${totalCredit})`,
      );
    }

    if (totalDebit === 0) {
      throw new BadRequestException('Total amounts cannot be zero');
    }

    const entryNumber = await this.generateEntryNumber(companyId, fiscalYearId);

    const entry = await this.prisma.journalEntry.create({
      data: {
        companyId,
        fiscalYearId,
        entryNumber,
        postingDate: new Date(data.postingDate),
        documentDate: data.documentDate ? new Date(data.documentDate) : new Date(data.postingDate),
        description: data.description,
        status: 'DRAFT',
        entryType: data.entryType ?? 'STANDARD',
        totalDebit: totalDebit,
        totalCredit: totalCredit,
        createdById: userId,
        customFieldValues: (data.customFieldValues ?? undefined) as Prisma.InputJsonValue | undefined,
        lines: {
          create: data.lines.map((line, index) => ({
            accountId: line.accountId,
            description: line.description,
            note: line.note,
            debitAmount: line.debitAmount || 0,
            creditAmount: line.creditAmount || 0,
            lineOrder: line.lineOrder ?? index + 1,
            customerId: line.customerId,
            vendorId: line.vendorId,
            inventoryItemId: line.inventoryItemId,
            employeeId: line.employeeId,
          })),
        },
      },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true } } },
          orderBy: { lineOrder: 'asc' },
        },
      },
    });

    await this.auditService.create(
      companyId,
      userId,
      'CREATE',
      'JournalEntry',
      entry.id,
      undefined,
      entry as unknown as Record<string, unknown>,
    );

    return entry;
  }

  async findAll(
    companyId: string,
    filters: JournalEntryFilters,
    pagination: Pagination,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };

    if (filters.fiscalYearId) where.fiscalYearId = filters.fiscalYearId;
    if (filters.status) where.status = filters.status;

    if (filters.startDate || filters.endDate) {
      const postingDate: Record<string, Date> = {};
      if (filters.startDate) postingDate.gte = new Date(filters.startDate);
      if (filters.endDate) postingDate.lte = new Date(filters.endDate);
      where.postingDate = postingDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        orderBy: { postingDate: 'desc' },
        skip,
        take: limit,
        include: {
          lines: {
            include: { account: { select: { id: true, code: true, name: true } } },
            orderBy: { lineOrder: 'asc' },
          },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(companyId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, accountType: true } },
            customer: { select: { id: true, code: true, name: true } },
            vendor: { select: { id: true, code: true, name: true } },
          },
          orderBy: { lineOrder: 'asc' },
        },
        reversalOf: { select: { id: true, entryNumber: true } },
        reversals: { select: { id: true, entryNumber: true, status: true } },
      },
    });
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }
    return entry;
  }

  async post(companyId: string, id: string, userId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: { lines: true },
    });
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }
    if (entry.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT entries can be posted');
    }

    await this.validatePeriodOpen(companyId, entry.postingDate);

    const posted = await this.prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        postedById: userId,
      },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true } } },
          orderBy: { lineOrder: 'asc' },
        },
      },
    });

    await this.auditService.create(
      companyId,
      userId,
      'POST',
      'JournalEntry',
      id,
      { status: 'DRAFT' },
      { status: 'POSTED' },
    );

    this.eventEmitter.emit('journal.posted', {
      companyId,
      journalEntryId: id,
      entryNumber: posted.entryNumber,
      userId,
    });

    return posted;
  }

  async createReversal(companyId: string, id: string, userId: string) {
    const original = await this.prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: { lines: true },
    });
    if (!original) {
      throw new NotFoundException('Journal entry not found');
    }
    if (original.status !== 'POSTED') {
      throw new BadRequestException('Only POSTED entries can be reversed');
    }

    const entryNumber = await this.generateEntryNumber(
      companyId,
      original.fiscalYearId,
    );

    const reversal = await this.prisma.journalEntry.create({
      data: {
        companyId,
        fiscalYearId: original.fiscalYearId,
        entryNumber,
        postingDate: new Date(),
        description: `Reversal of ${original.entryNumber}: ${original.description}`,
        status: 'POSTED',
        entryType: 'REVERSAL',
        totalDebit: original.totalCredit,
        totalCredit: original.totalDebit,
        reversalOfId: original.id,
        postedAt: new Date(),
        postedById: userId,
        createdById: userId,
        lines: {
          create: original.lines.map((line, index) => ({
            accountId: line.accountId,
            description: `Reversal: ${line.description ?? ''}`,
            debitAmount: line.creditAmount,
            creditAmount: line.debitAmount,
            lineOrder: index + 1,
            customerId: line.customerId,
            vendorId: line.vendorId,
            inventoryItemId: line.inventoryItemId,
            employeeId: line.employeeId,
          })),
        },
      },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true } } },
          orderBy: { lineOrder: 'asc' },
        },
      },
    });

    await this.auditService.create(
      companyId,
      userId,
      'REVERSE',
      'JournalEntry',
      original.id,
      undefined,
      { reversalEntryId: reversal.id, reversalEntryNumber: reversal.entryNumber },
    );

    this.eventEmitter.emit('journal.posted', {
      companyId,
      journalEntryId: reversal.id,
      entryNumber: reversal.entryNumber,
      userId,
    });

    return reversal;
  }

  async createCorrection(companyId: string, id: string, userId: string) {
    const reversal = await this.createReversal(companyId, id, userId);

    const original = await this.prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: { lines: true },
    });

    const entryNumber = await this.generateEntryNumber(
      companyId,
      original!.fiscalYearId,
    );

    const correctionDraft = await this.prisma.journalEntry.create({
      data: {
        companyId,
        fiscalYearId: original!.fiscalYearId,
        entryNumber,
        postingDate: original!.postingDate,
        description: `Correction of ${original!.entryNumber}: ${original!.description}`,
        status: 'DRAFT',
        entryType: 'STANDARD',
        totalDebit: original!.totalDebit,
        totalCredit: original!.totalCredit,
        correctedById: original!.id,
        createdById: userId,
        lines: {
          create: original!.lines.map((line, index) => ({
            accountId: line.accountId,
            description: line.description,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            lineOrder: index + 1,
            customerId: line.customerId,
            vendorId: line.vendorId,
            inventoryItemId: line.inventoryItemId,
            employeeId: line.employeeId,
          })),
        },
      },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true } } },
          orderBy: { lineOrder: 'asc' },
        },
      },
    });

    await this.auditService.create(
      companyId,
      userId,
      'CORRECT',
      'JournalEntry',
      original!.id,
      undefined,
      {
        reversalEntryId: reversal.id,
        correctionDraftId: correctionDraft.id,
      },
    );

    return { reversal, correctionDraft };
  }

  async delete(companyId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, companyId },
    });
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }
    if (entry.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT entries can be deleted');
    }

    await this.prisma.journalEntry.delete({ where: { id } });

    return { message: 'Journal entry deleted' };
  }

  private async generateEntryNumber(
    companyId: string,
    fiscalYearId: string,
  ): Promise<string> {
    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId },
    });
    const year = fiscalYear
      ? new Date(fiscalYear.startDate).getFullYear()
      : new Date().getFullYear();

    const lastEntry = await this.prisma.journalEntry.findFirst({
      where: { companyId, fiscalYearId },
      orderBy: { entryNumber: 'desc' },
    });

    let sequence = 1;
    if (lastEntry) {
      const parts = lastEntry.entryNumber.split('-');
      const lastSeq = parseInt(parts[2] ?? '0', 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `JE-${year}-${String(sequence).padStart(5, '0')}`;
  }

  private async validatePeriodOpen(
    companyId: string,
    postingDate: Date,
  ): Promise<void> {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: {
        fiscalYear: { companyId },
        startDate: { lte: postingDate },
        endDate: { gte: postingDate },
      },
    });

    if (!period) {
      throw new BadRequestException(
        'No fiscal period found for the posting date',
      );
    }

    if (period.status === 'LOCKED') {
      throw new BadRequestException('The fiscal period is locked');
    }
  }
}
