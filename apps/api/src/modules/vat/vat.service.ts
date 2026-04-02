import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

interface CreateVatData {
  direction: 'INPUT' | 'OUTPUT';
  invoiceNumber: string;
  invoiceDate: string | Date;
  customerId?: string;
  vendorId?: string;
  taxableAmount: number;
  vatRate: number;
  description?: string;
  journalEntryId?: string;
}

interface VatFilters {
  direction?: string;
  startDate?: string;
  endDate?: string;
}

interface Pagination {
  page?: number;
  limit?: number;
}

@Injectable()
export class VatService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(companyId: string, data: CreateVatData, userId: string) {
    const taxableAmount = new Decimal(data.taxableAmount);
    const vatAmount = new Decimal(
      Math.round(data.taxableAmount * data.vatRate / 100),
    );

    const record = await this.prisma.vatRecord.create({
      data: {
        companyId,
        direction: data.direction,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: new Date(data.invoiceDate),
        customerId: data.customerId,
        vendorId: data.vendorId,
        taxableAmount,
        vatRate: data.vatRate,
        vatAmount,
        description: data.description,
        journalEntryId: data.journalEntryId,
      },
    });

    await this.auditService.create(
      companyId,
      userId,
      'CREATE',
      'VatRecord',
      record.id,
      undefined,
      record as unknown as Record<string, unknown>,
    );

    return record;
  }

  async findAll(companyId: string, filters: VatFilters = {}, pagination: Pagination = {}) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };
    if (filters.direction) where.direction = filters.direction;

    if (filters.startDate || filters.endDate) {
      const invoiceDate: Record<string, Date> = {};
      if (filters.startDate) invoiceDate.gte = new Date(filters.startDate);
      if (filters.endDate) invoiceDate.lte = new Date(filters.endDate);
      where.invoiceDate = invoiceDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.vatRecord.findMany({
        where,
        orderBy: { invoiceDate: 'desc' },
        skip,
        take: limit,
        include: {
          customer: { select: { id: true, code: true, name: true, taxCode: true } },
          vendor: { select: { id: true, code: true, name: true, taxCode: true } },
        },
      }),
      this.prisma.vatRecord.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(companyId: string, id: string) {
    const record = await this.prisma.vatRecord.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: { id: true, code: true, name: true, taxCode: true } },
        vendor: { select: { id: true, code: true, name: true, taxCode: true } },
      },
    });
    if (!record) {
      throw new NotFoundException('VAT record not found');
    }
    return record;
  }

  async computeVat(companyId: string, periodStart: string, periodEnd: string) {
    const dateFilter = {
      gte: new Date(periodStart),
      lte: new Date(periodEnd),
    };

    const [outputRecords, inputRecords] = await Promise.all([
      this.prisma.vatRecord.findMany({
        where: { companyId, direction: 'OUTPUT', invoiceDate: dateFilter },
      }),
      this.prisma.vatRecord.findMany({
        where: { companyId, direction: 'INPUT', invoiceDate: dateFilter },
      }),
    ]);

    const totalOutputVat = outputRecords.reduce(
      (sum, r) => sum.add(r.vatAmount),
      new Decimal(0),
    );
    const totalInputVat = inputRecords.reduce(
      (sum, r) => sum.add(r.vatAmount),
      new Decimal(0),
    );
    const netVat = totalOutputVat.sub(totalInputVat);

    return {
      periodStart,
      periodEnd,
      totalOutputVat,
      totalInputVat,
      netVat,
      status: netVat.greaterThanOrEqualTo(0) ? 'PAYABLE' : 'REFUNDABLE',
      outputRecordCount: outputRecords.length,
      inputRecordCount: inputRecords.length,
    };
  }

  async reconcile(companyId: string, periodStart: string, periodEnd: string) {
    const vatComputation = await this.computeVat(companyId, periodStart, periodEnd);

    // Get TK133 (input VAT deductible) and TK3331 (output VAT payable) balances
    const dateFilter = {
      gte: new Date(periodStart),
      lte: new Date(periodEnd),
    };

    const [inputLedgerLines, outputLedgerLines] = await Promise.all([
      this.prisma.journalEntryLine.findMany({
        where: {
          journalEntry: { companyId, status: 'POSTED', postingDate: dateFilter },
          account: { code: '133' },
        },
      }),
      this.prisma.journalEntryLine.findMany({
        where: {
          journalEntry: { companyId, status: 'POSTED', postingDate: dateFilter },
          account: { code: '3331' },
        },
      }),
    ]);

    const ledgerInputVat = inputLedgerLines.reduce(
      (sum, l) => sum.add(l.debitAmount).sub(l.creditAmount),
      new Decimal(0),
    );
    const ledgerOutputVat = outputLedgerLines.reduce(
      (sum, l) => sum.add(l.creditAmount).sub(l.debitAmount),
      new Decimal(0),
    );

    const inputDiscrepancy = vatComputation.totalInputVat.sub(ledgerInputVat);
    const outputDiscrepancy = vatComputation.totalOutputVat.sub(ledgerOutputVat);

    return {
      periodStart,
      periodEnd,
      vatRecords: {
        totalInputVat: vatComputation.totalInputVat,
        totalOutputVat: vatComputation.totalOutputVat,
      },
      ledger: {
        tk133Balance: ledgerInputVat,
        tk3331Balance: ledgerOutputVat,
      },
      discrepancies: {
        inputVat: inputDiscrepancy,
        outputVat: outputDiscrepancy,
        hasDiscrepancy: !inputDiscrepancy.isZero() || !outputDiscrepancy.isZero(),
      },
    };
  }

  async exportHTKK(companyId: string, periodStart: string, periodEnd: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const dateFilter = {
      gte: new Date(periodStart),
      lte: new Date(periodEnd),
    };

    const [inputRecords, outputRecords] = await Promise.all([
      this.prisma.vatRecord.findMany({
        where: { companyId, direction: 'INPUT', invoiceDate: dateFilter },
        include: { vendor: { select: { name: true, taxCode: true } } },
        orderBy: { invoiceDate: 'asc' },
      }),
      this.prisma.vatRecord.findMany({
        where: { companyId, direction: 'OUTPUT', invoiceDate: dateFilter },
        include: { customer: { select: { name: true, taxCode: true } } },
        orderBy: { invoiceDate: 'asc' },
      }),
    ]);

    const totalInputTaxable = inputRecords.reduce((s, r) => s.add(r.taxableAmount), new Decimal(0));
    const totalInputVat = inputRecords.reduce((s, r) => s.add(r.vatAmount), new Decimal(0));
    const totalOutputTaxable = outputRecords.reduce((s, r) => s.add(r.taxableAmount), new Decimal(0));
    const totalOutputVat = outputRecords.reduce((s, r) => s.add(r.vatAmount), new Decimal(0));
    const netVat = totalOutputVat.sub(totalInputVat);

    const escapeXml = (str: string) =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const inputLines = inputRecords
      .map(
        (r) =>
          `    <VatInput>
      <InvoiceNumber>${escapeXml(r.invoiceNumber)}</InvoiceNumber>
      <InvoiceDate>${r.invoiceDate.toISOString().slice(0, 10)}</InvoiceDate>
      <SellerName>${escapeXml(r.vendor?.name ?? '')}</SellerName>
      <SellerTaxCode>${escapeXml(r.vendor?.taxCode ?? '')}</SellerTaxCode>
      <TaxableAmount>${r.taxableAmount}</TaxableAmount>
      <VatRate>${r.vatRate}</VatRate>
      <VatAmount>${r.vatAmount}</VatAmount>
    </VatInput>`,
      )
      .join('\n');

    const outputLines = outputRecords
      .map(
        (r) =>
          `    <VatOutput>
      <InvoiceNumber>${escapeXml(r.invoiceNumber)}</InvoiceNumber>
      <InvoiceDate>${r.invoiceDate.toISOString().slice(0, 10)}</InvoiceDate>
      <BuyerName>${escapeXml(r.customer?.name ?? '')}</BuyerName>
      <BuyerTaxCode>${escapeXml(r.customer?.taxCode ?? '')}</BuyerTaxCode>
      <TaxableAmount>${r.taxableAmount}</TaxableAmount>
      <VatRate>${r.vatRate}</VatRate>
      <VatAmount>${r.vatAmount}</VatAmount>
    </VatOutput>`,
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HTKKData>
  <CompanyInfo>
    <Name>${escapeXml(company.name)}</Name>
    <TaxCode>${escapeXml(company.taxCode ?? '')}</TaxCode>
    <Address>${escapeXml(company.address ?? '')}</Address>
  </CompanyInfo>
  <Period>
    <StartDate>${periodStart}</StartDate>
    <EndDate>${periodEnd}</EndDate>
  </Period>
  <VatInputList>
${inputLines}
  </VatInputList>
  <VatOutputList>
${outputLines}
  </VatOutputList>
  <Summary>
    <TotalInputTaxable>${totalInputTaxable}</TotalInputTaxable>
    <TotalInputVat>${totalInputVat}</TotalInputVat>
    <TotalOutputTaxable>${totalOutputTaxable}</TotalOutputTaxable>
    <TotalOutputVat>${totalOutputVat}</TotalOutputVat>
    <NetVatPayable>${netVat.greaterThanOrEqualTo(0) ? netVat : 0}</NetVatPayable>
    <NetVatRefundable>${netVat.lessThan(0) ? netVat.abs() : 0}</NetVatRefundable>
  </Summary>
</HTKKData>`;

    return { xml, summary: { totalInputVat, totalOutputVat, netVat } };
  }
}
