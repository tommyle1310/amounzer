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
import { numberToVietnameseWords } from '@amounzer/shared';

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
  recordingDate?: string | Date;
  voucherBookNo?: string;
  
  // Transaction party info (TT200/TT133)
  counterpartyName?: string;
  counterpartyId?: string;
  counterpartyType?: string;
  partyFullName?: string;       // Họ tên người nộp/nhận tiền
  partyAddress?: string;        // Địa chỉ
  partyIdNumber?: string;       // CMND/CCCD
  
  description: string;
  totalAmount: number;
  amountInWords?: string;       // Manual override, auto-gen if not provided
  
  // Foreign currency
  currency?: string;
  originalAmount?: number;
  exchangeRate?: number;
  
  // Supporting documents
  attachmentCount?: number;
  originalDocRefs?: string;
  
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
    // Validate fiscal year exists BEFORE creating anything
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: data.fiscalYearId, companyId },
    });
    if (!fiscalYear) {
      throw new NotFoundException('Năm tài chính không tồn tại');
    }
    if (fiscalYear.status === 'CLOSED') {
      throw new BadRequestException('Năm tài chính đã đóng');
    }

    const voucherNumber = await this.generateVoucherNumber(
      companyId,
      data.voucherType,
    );

    // Auto-generate amount in words if not provided
    const currency = data.currency || 'VND';
    const amountForWords = currency === 'VND' ? data.totalAmount : (data.originalAmount ?? data.totalAmount);
    const currencyWord = currency === 'VND' ? 'đồng' : currency;
    const amountInWords = data.amountInWords || numberToVietnameseWords(amountForWords, currencyWord);

    // Create the voucher with all legal fields
    const result = await this.prisma.voucher.create({
      data: {
        companyId,
        voucherType: data.voucherType,
        voucherNumber,
        voucherBookNo: data.voucherBookNo,
        date: new Date(data.date),
        recordingDate: data.recordingDate ? new Date(data.recordingDate) : undefined,
        
        // Transaction party info
        counterpartyName: data.counterpartyName,
        counterpartyId: data.counterpartyId,
        counterpartyType: data.counterpartyType,
        partyFullName: data.partyFullName,
        partyAddress: data.partyAddress,
        partyIdNumber: data.partyIdNumber,
        
        description: data.description,
        totalAmount: data.totalAmount,
        amountInWords,
        
        // Foreign currency
        currency,
        originalAmount: data.originalAmount,
        exchangeRate: data.exchangeRate ?? 1,
        
        // Supporting documents
        attachmentCount: data.attachmentCount ?? 0,
        originalDocRefs: data.originalDocRefs,
        
        status: 'DRAFT',
        customFieldValues: (data.customFieldValues ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    // Create a DRAFT journal entry with the voucher lines
    let journalEntry;
    try {
      journalEntry = await this.journalEntryService.create(
        companyId,
        data.fiscalYearId,
        {
          // postingDate uses recordingDate (Ngày ghi sổ) if provided, else falls back to voucher date
          postingDate: data.recordingDate ?? data.date,
          // documentDate is always the original voucher date (Ngày chứng từ)
          documentDate: data.date,
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
    } catch (error) {
      // If journal entry creation fails, delete the voucher to maintain consistency
      await this.prisma.voucher.delete({ where: { id: result.id } });
      throw error;
    }

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
      throw new BadRequestException('Chỉ có thể ghi sổ chứng từ nháp');
    }
    if (!voucher.journalEntryId) {
      throw new BadRequestException('Chứng từ chưa có bút toán liên kết. Vui lòng tạo lại chứng từ.');
    }

    // Hard validation: prevent negative cash balance for cash-out vouchers (PC)
    if (voucher.voucherType === 'PC') {
      const je = await this.prisma.journalEntry.findUnique({
        where: { id: voucher.journalEntryId },
        include: {
          lines: {
            include: { account: { select: { code: true } } },
          },
        },
      });
      if (je) {
        const cashCreditLines = je.lines.filter(
          (l) => l.account.code.startsWith('111') && l.creditAmount.gt(0),
        );
        if (cashCreditLines.length > 0) {
          const totalCashOut = cashCreditLines.reduce(
            (sum, l) => sum.add(l.creditAmount),
            new Prisma.Decimal(0),
          );
          const cashBalance = await this.prisma.journalEntryLine.aggregate({
            where: {
              account: { companyId, code: { startsWith: '111' } },
              journalEntry: { companyId, status: 'POSTED' },
            },
            _sum: { debitAmount: true, creditAmount: true },
          });
          const availableBalance =
            Number(cashBalance._sum.debitAmount ?? 0) - Number(cashBalance._sum.creditAmount ?? 0);
          if (availableBalance < Number(totalCashOut)) {
            throw new BadRequestException(
              `Không đủ tồn quỹ tiền mặt. Tồn quỹ hiện tại: ${availableBalance.toLocaleString('vi-VN')} ₫, cần chi: ${Number(totalCashOut).toLocaleString('vi-VN')} ₫`,
            );
          }
        }
      }
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
      throw new BadRequestException('Chỉ có thể hủy chứng từ đã ghi sổ');
    }
    if (!voucher.journalEntryId) {
      throw new BadRequestException('Chứng từ chưa có bút toán liên kết');
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
