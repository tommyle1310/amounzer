import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface CreateVendorData {
  code: string;
  name: string;
  taxCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  bankAccount?: string;
  bankName?: string;
  customFieldValues?: Record<string, unknown>;
}

interface UpdateVendorData {
  name?: string;
  taxCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  bankAccount?: string;
  bankName?: string;
  customFieldValues?: Record<string, unknown>;
}

interface VendorFilters {
  search?: string;
  isActive?: boolean;
}

interface Pagination {
  page?: number;
  limit?: number;
}

@Injectable()
export class VendorService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(companyId: string, data: CreateVendorData, userId: string) {
    const existing = await this.prisma.vendor.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (existing) {
      throw new BadRequestException(`Vendor code ${data.code} already exists`);
    }

    const vendor = await this.prisma.vendor.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        taxCode: data.taxCode,
        address: data.address,
        phone: data.phone,
        email: data.email,
        contactPerson: data.contactPerson,
        bankAccount: data.bankAccount,
        bankName: data.bankName,
        customFieldValues: (data.customFieldValues ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    await this.auditService.create(
      companyId,
      userId,
      'CREATE',
      'Vendor',
      vendor.id,
      undefined,
      vendor as unknown as Record<string, unknown>,
    );

    return vendor;
  }

  async findAll(
    companyId: string,
    filters?: VendorFilters,
    pagination?: Pagination,
  ) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { taxCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(companyId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, companyId },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Calculate outstanding balance from TK331 (Accounts Payable) lines
    const balance = await this.prisma.journalEntryLine.aggregate({
      where: {
        vendorId: id,
        journalEntry: { companyId, status: 'POSTED' },
        account: { code: { startsWith: '331' } },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const totalDebit = Number(balance._sum.debitAmount ?? 0);
    const totalCredit = Number(balance._sum.creditAmount ?? 0);
    // AP: credit increases liability, debit decreases
    const outstandingBalance = totalCredit - totalDebit;

    return { ...vendor, outstandingBalance };
  }

  async update(
    companyId: string,
    id: string,
    data: UpdateVendorData,
    userId: string,
  ) {
    const existing = await this.prisma.vendor.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Vendor not found');
    }

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: {
        name: data.name,
        taxCode: data.taxCode,
        address: data.address,
        phone: data.phone,
        email: data.email,
        contactPerson: data.contactPerson,
        bankAccount: data.bankAccount,
        bankName: data.bankName,
        customFieldValues: (data.customFieldValues ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    await this.auditService.create(
      companyId,
      userId,
      'UPDATE',
      'Vendor',
      id,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );

    return updated;
  }

  async deactivate(companyId: string, id: string, userId: string) {
    const existing = await this.prisma.vendor.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Vendor not found');
    }

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.create(
      companyId,
      userId,
      'DEACTIVATE',
      'Vendor',
      id,
      { isActive: true },
      { isActive: false },
    );

    return updated;
  }

  async getAgingReport(
    companyId: string,
    vendorId?: string,
    asOfDate?: string,
  ) {
    const asOf = asOfDate ? new Date(asOfDate) : new Date();

    const vendorFilter: Record<string, unknown> = vendorId
      ? { id: vendorId, companyId }
      : { companyId, isActive: true };

    const vendors = await this.prisma.vendor.findMany({
      where: vendorFilter,
      select: { id: true, code: true, name: true },
    });

    const aging = [];

    for (const vend of vendors) {
      // Get all posted JE lines for this vendor on TK331
      const lines = await this.prisma.journalEntryLine.findMany({
        where: {
          vendorId: vend.id,
          journalEntry: {
            companyId,
            status: 'POSTED',
            postingDate: { lte: asOf },
          },
          account: { code: { startsWith: '331' } },
        },
        include: {
          journalEntry: { select: { postingDate: true, entryNumber: true } },
        },
      });

      let current = 0;
      let days30 = 0;
      let days60 = 0;
      let days90 = 0;
      let over90 = 0;

      for (const line of lines) {
        // AP: credit increases, debit decreases
        const amount = Number(line.creditAmount) - Number(line.debitAmount);
        const daysDiff = Math.floor(
          (asOf.getTime() - line.journalEntry.postingDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        if (daysDiff <= 0) current += amount;
        else if (daysDiff <= 30) days30 += amount;
        else if (daysDiff <= 60) days60 += amount;
        else if (daysDiff <= 90) days90 += amount;
        else over90 += amount;
      }

      const total = current + days30 + days60 + days90 + over90;
      if (total !== 0) {
        aging.push({
          vendorId: vend.id,
          vendorCode: vend.code,
          vendorName: vend.name,
          current,
          days1to30: days30,
          days31to60: days60,
          days61to90: days90,
          over90,
          total,
        });
      }
    }

    return { asOfDate: asOf.toISOString().split('T')[0], data: aging };
  }
}
