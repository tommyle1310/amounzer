import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface CreateCompanyData {
  name: string;
  taxCode?: string;
  address?: string;
  legalRepresentative?: string;
  phone?: string;
  accountingStandard?: 'TT200' | 'TT133';
  baseCurrency?: string;
  locale?: string;
}

interface UpdateCompanyData {
  name?: string;
  taxCode?: string;
  address?: string;
  legalRepresentative?: string;
  phone?: string;
  accountingStandard?: 'TT200' | 'TT133';
  baseCurrency?: string;
  locale?: string;
}

interface CreateFiscalYearData {
  name: string;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class CompanyService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(data: CreateCompanyData, userId: string) {
    const company = await this.prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          name: data.name,
          taxCode: data.taxCode,
          address: data.address,
          legalRepresentative: data.legalRepresentative,
          phone: data.phone,
          accountingStandard: data.accountingStandard ?? 'TT200',
          baseCurrency: data.baseCurrency ?? 'VND',
          locale: data.locale ?? 'vi',
        },
      });

      await tx.companyUser.create({
        data: {
          userId,
          companyId: created.id,
          role: 'ADMIN',
        },
      });

      return created;
    });

    await this.auditService.create(
      company.id,
      userId,
      'CREATE',
      'Company',
      company.id,
      undefined,
      company as unknown as Record<string, unknown>,
    );

    return company;
  }

  async findAll(userId: string) {
    const companyUsers = await this.prisma.companyUser.findMany({
      where: { userId, isActive: true },
      include: { company: true },
    });
    return companyUsers.map((cu) => ({
      ...cu.company,
      role: cu.role,
    }));
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async update(id: string, data: UpdateCompanyData) {
    const existing = await this.prisma.company.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    const updated = await this.prisma.company.update({
      where: { id },
      data,
    });

    return updated;
  }

  async createFiscalYear(companyId: string, data: CreateFiscalYearData) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    const fiscalYear = await this.prisma.$transaction(async (tx) => {
      const fy = await tx.fiscalYear.create({
        data: {
          companyId,
          name: data.name,
          startDate,
          endDate,
        },
      });

      // Auto-generate 12 monthly fiscal periods
      const periods: {
        fiscalYearId: string;
        name: string;
        startDate: Date;
        endDate: Date;
        periodNumber: number;
      }[] = [];

      const currentStart = new Date(startDate);
      for (let i = 1; i <= 12; i++) {
        const periodStart = new Date(currentStart);
        // Get last day of month, set to end of day (23:59:59.999) to include full day
        const periodEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 0);
        periodEnd.setHours(23, 59, 59, 999);

        // Clamp the last period to not exceed fiscal year end
        if (periodEnd > endDate) {
          periodEnd.setTime(endDate.getTime());
        }

        periods.push({
          fiscalYearId: fy.id,
          name: `Tháng ${i}`,
          startDate: periodStart,
          endDate: periodEnd,
          periodNumber: i,
        });

        // Move to next month
        currentStart.setMonth(currentStart.getMonth() + 1);
        currentStart.setDate(1);

        // Stop if we've passed the fiscal year end
        if (currentStart > endDate) break;
      }

      await tx.fiscalPeriod.createMany({ data: periods });

      return fy;
    });

    return this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYear.id },
      include: { periods: { orderBy: { periodNumber: 'asc' } } },
    });
  }

  async getFiscalYears(companyId: string) {
    return this.prisma.fiscalYear.findMany({
      where: { companyId },
      orderBy: { startDate: 'desc' },
      include: { periods: { orderBy: { periodNumber: 'asc' } } },
    });
  }

  async getFiscalPeriods(fiscalYearId: string) {
    const fy = await this.prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } });
    if (!fy) {
      throw new NotFoundException('Fiscal year not found');
    }

    return this.prisma.fiscalPeriod.findMany({
      where: { fiscalYearId },
      orderBy: { periodNumber: 'asc' },
    });
  }
}
