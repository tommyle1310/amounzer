import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface CreateCustomerData {
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

interface UpdateCustomerData {
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

interface CustomerFilters {
  search?: string;
  isActive?: boolean;
}

interface Pagination {
  page?: number;
  limit?: number;
}

@Injectable()
export class CustomerService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(companyId: string, data: CreateCustomerData, userId: string) {
    const existing = await this.prisma.customer.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (existing) {
      throw new BadRequestException(`Customer code ${data.code} already exists`);
    }

    const customer = await this.prisma.customer.create({
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
      'Customer',
      customer.id,
      undefined,
      customer as unknown as Record<string, unknown>,
    );

    return customer;
  }

  async findAll(
    companyId: string,
    filters?: CustomerFilters,
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
      this.prisma.customer.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Calculate outstanding balance from TK131 (Accounts Receivable) lines
    const balance = await this.prisma.journalEntryLine.aggregate({
      where: {
        customerId: id,
        journalEntry: { companyId, status: 'POSTED' },
        account: { code: { startsWith: '131' } },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const totalDebit = Number(balance._sum.debitAmount ?? 0);
    const totalCredit = Number(balance._sum.creditAmount ?? 0);
    const outstandingBalance = totalDebit - totalCredit;

    return { ...customer, outstandingBalance };
  }

  async update(
    companyId: string,
    id: string,
    data: UpdateCustomerData,
    userId: string,
  ) {
    const existing = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.customer.update({
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
      'Customer',
      id,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );

    return updated;
  }

  async deactivate(companyId: string, id: string, userId: string) {
    const existing = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.create(
      companyId,
      userId,
      'DEACTIVATE',
      'Customer',
      id,
      { isActive: true },
      { isActive: false },
    );

    return updated;
  }

  async getAgingReport(
    companyId: string,
    customerId?: string,
    asOfDate?: string,
  ) {
    const asOf = asOfDate ? new Date(asOfDate) : new Date();

    const customerFilter: Record<string, unknown> = customerId
      ? { id: customerId, companyId }
      : { companyId, isActive: true };

    const customers = await this.prisma.customer.findMany({
      where: customerFilter,
      select: { id: true, code: true, name: true },
    });

    const aging = [];

    for (const cust of customers) {
      // Get all posted JE lines for this customer on TK131
      const lines = await this.prisma.journalEntryLine.findMany({
        where: {
          customerId: cust.id,
          journalEntry: {
            companyId,
            status: 'POSTED',
            postingDate: { lte: asOf },
          },
          account: { code: { startsWith: '131' } },
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
        const amount = Number(line.debitAmount) - Number(line.creditAmount);
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
          customerId: cust.id,
          customerCode: cust.code,
          customerName: cust.name,
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
