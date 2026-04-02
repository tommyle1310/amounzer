import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JournalEntryService } from '../journal-entry/journal-entry.service';

interface VoucherLineData {
  accountId: string;
  description?: string;
  debitAmount: number;
  creditAmount: number;
  customerId?: string;
  vendorId?: string;
}

interface CreateVoucherData {
  voucherType: 'PT' | 'PC' | 'BDN' | 'BCN' | 'BT';
  date: string | Date;
  counterpartyName?: string;
  counterpartyId?: string;
  counterpartyType?: string;
  description: string;
  totalAmount: number;
  fiscalYearId: string;
  lines: VoucherLineData[];
  customFieldValues?: Record<string, unknown>;
}

interface VoucherFilters {
  voucherType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  counterpartyName?: string;
}

interface Pagination {
  page?: number;
  limit?: number;
}

@Injectable()
export class VoucherService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private journalEntryService: JournalEntryService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(companyId: string, data: CreateVoucherData, userId: string) {
    const voucherNumber = await this.generateVoucherNumber(
      companyId,
      data.voucherType,
    );

    // Create the voucher + DRAFT journal entry in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          companyId,
          voucherType: data.voucherType,
          voucherNumber,
          date: new Date(data.date),
          counterpartyName: data.counterpartyName,
          counterpartyId: data.counterpartyId,
          counterpartyType: data.counterpartyType,
          description: data.description,
          totalAmount: data.totalAmount,
          status: 'DRAFT',
          customFieldValues: (data.customFieldValues ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      return voucher;
    });

    // Create a DRAFT journal entry with the voucher lines
    const journalEntry = await this.journalEntryService.create(
      companyId,
      data.fiscalYearId,
      {
        postingDate: data.date,
        description: `${data.voucherType} ${voucherNumber}: ${data.description}`,
        entryType: 'STANDARD',
        lines: data.lines.map((line, index) => ({
          accountId: line.accountId,
          description: line.description,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          lineOrder: index + 1,
          customerId: line.customerId,
          vendorId: line.vendorId,
        })),
      },
      userId,
    );

    // Link voucher to JE and create accounting transaction
    const voucher = await this.prisma.voucher.update({
      where: { id: result.id },
      data: { journalEntryId: journalEntry.id },
    });

    await this.prisma.accountingTransaction.create({
      data: {
        journalEntryId: journalEntry.id,
        sourceType: 'voucher',
        sourceId: voucher.id,
        description: `${data.voucherType} ${voucherNumber}`,
      },
    });

    await this.auditService.create(
      companyId,
      userId,
      'CREATE',
      'Voucher',
      voucher.id,
      undefined,
      { ...voucher, journalEntryId: journalEntry.id } as unknown as Record<string, unknown>,
    );

    return { ...voucher, journalEntry };
  }

  async findAll(
    companyId: string,
    filters: VoucherFilters,
    pagination: Pagination,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };

    if (filters.voucherType) where.voucherType = filters.voucherType;
    if (filters.status) where.status = filters.status;
    if (filters.counterpartyName) {
      where.counterpartyName = { contains: filters.counterpartyName, mode: 'insensitive' };
    }

    if (filters.startDate || filters.endDate) {
      const date: Record<string, Date> = {};
      if (filters.startDate) date.gte = new Date(filters.startDate);
      if (filters.endDate) date.lte = new Date(filters.endDate);
      where.date = date;
    }

    const [data, total] = await Promise.all([
      this.prisma.voucher.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.voucher.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(companyId: string, id: string) {
    const voucher = await this.prisma.voucher.findFirst({
      where: { id, companyId },
    });
    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    let journalEntry = null;
    if (voucher.journalEntryId) {
      journalEntry = await this.prisma.journalEntry.findUnique({
        where: { id: voucher.journalEntryId },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true } },
              customer: { select: { id: true, code: true, name: true } },
              vendor: { select: { id: true, code: true, name: true } },
            },
            orderBy: { lineOrder: 'asc' },
          },
        },
      });
    }

    return { ...voucher, journalEntry };
  }

  async post(companyId: string, id: string, userId: string) {
    const voucher = await this.prisma.voucher.findFirst({
      where: { id, companyId },
    });
    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }
    if (voucher.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT vouchers can be posted');
    }
    if (!voucher.journalEntryId) {
      throw new BadRequestException('Voucher has no linked journal entry');
    }

    // Post the linked journal entry
    const journalEntry = await this.journalEntryService.post(
      companyId,
      voucher.journalEntryId,
      userId,
    );

    // Update voucher status
    const updated = await this.prisma.voucher.update({
      where: { id },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        postedById: userId,
      },
    });

    await this.auditService.create(
      companyId,
      userId,
      'POST',
      'Voucher',
      id,
      { status: 'DRAFT' },
      { status: 'POSTED' },
    );

    return { ...updated, journalEntry };
  }

  async batchPost(companyId: string, ids: string[], userId: string) {
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of ids) {
      try {
        await this.post(companyId, id, userId);
        results.push({ id, success: true });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      total: ids.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  async void(companyId: string, id: string, userId: string) {
    const voucher = await this.prisma.voucher.findFirst({
      where: { id, companyId },
    });
    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }
    if (voucher.status !== 'POSTED') {
      throw new BadRequestException('Only POSTED vouchers can be voided');
    }
    if (!voucher.journalEntryId) {
      throw new BadRequestException('Voucher has no linked journal entry');
    }

    // Create reversal of the journal entry
    const reversalJE = await this.journalEntryService.createReversal(
      companyId,
      voucher.journalEntryId,
      userId,
    );

    // Mark voucher as VOIDED
    const updated = await this.prisma.voucher.update({
      where: { id },
      data: { status: 'VOIDED' },
    });

    await this.auditService.create(
      companyId,
      userId,
      'VOID',
      'Voucher',
      id,
      { status: 'POSTED' },
      { status: 'VOIDED', reversalJournalEntryId: reversalJE.id },
    );

    return { ...updated, reversalJournalEntry: reversalJE };
  }

  private async generateVoucherNumber(
    companyId: string,
    voucherType: string,
  ): Promise<string> {
    const year = new Date().getFullYear();

    const lastVoucher = await this.prisma.voucher.findFirst({
      where: {
        companyId,
        voucherType: voucherType as 'PT' | 'PC' | 'BDN' | 'BCN' | 'BT',
        voucherNumber: { startsWith: `${voucherType}-${year}-` },
      },
      orderBy: { voucherNumber: 'desc' },
    });

    let sequence = 1;
    if (lastVoucher) {
      const parts = lastVoucher.voucherNumber.split('-');
      const lastSeq = parseInt(parts[2] ?? '0', 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `${voucherType}-${year}-${String(sequence).padStart(5, '0')}`;
  }
}
