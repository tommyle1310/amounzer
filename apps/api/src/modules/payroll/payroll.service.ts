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

interface CreateEmployeeData {
  code: string;
  name: string;
  department?: string;
  position?: string;
  baseSalary: number;
  socialInsuranceSalary: number;
  bankAccount?: string;
  bankName?: string;
  taxCode?: string;
}

interface UpdateEmployeeData {
  name?: string;
  department?: string;
  position?: string;
  baseSalary?: number;
  socialInsuranceSalary?: number;
  bankAccount?: string;
  bankName?: string;
  taxCode?: string;
  isActive?: boolean;
}

interface CreatePayrollData {
  periodMonth: number;
  periodYear: number;
  name: string;
}

interface Pagination {
  page?: number;
  limit?: number;
}

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ── Employees ──────────────────────────────────────────────────────

  async createEmployee(companyId: string, data: CreateEmployeeData) {
    return this.prisma.employee.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        department: data.department,
        position: data.position,
        baseSalary: data.baseSalary,
        socialInsuranceSalary: data.socialInsuranceSalary,
        bankAccount: data.bankAccount,
        bankName: data.bankName,
        taxCode: data.taxCode,
      },
    });
  }

  async findAllEmployees(companyId: string, pagination: Pagination = {}) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where: { companyId },
        orderBy: { code: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.employee.count({ where: { companyId } }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneEmployee(companyId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId },
      include: {
        salarySlips: {
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: { payrollRecord: { select: { id: true, name: true, periodMonth: true, periodYear: true } } },
        },
      },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  async updateEmployee(companyId: string, id: string, data: UpdateEmployeeData) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.prisma.employee.update({
      where: { id },
      data,
    });
  }

  // ── Payrolls ───────────────────────────────────────────────────────

  async createPayroll(companyId: string, data: CreatePayrollData) {
    return this.prisma.payrollRecord.create({
      data: {
        companyId,
        periodMonth: data.periodMonth,
        periodYear: data.periodYear,
        name: data.name,
        status: 'DRAFT',
      },
    });
  }

  async computePayroll(companyId: string, payrollId: string) {
    const payroll = await this.prisma.payrollRecord.findFirst({
      where: { id: payrollId, companyId },
    });
    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }
    if (payroll.status === 'POSTED') {
      throw new BadRequestException('Cannot recompute a posted payroll');
    }

    const employees = await this.prisma.employee.findMany({
      where: { companyId, isActive: true },
    });

    if (employees.length === 0) {
      throw new BadRequestException('No active employees found');
    }

    // Delete existing slips for recompute
    await this.prisma.salarySlip.deleteMany({
      where: { payrollRecordId: payrollId },
    });

    let totalGross = new Decimal(0);
    let totalNet = new Decimal(0);
    let totalDeductions = new Decimal(0);
    let totalPit = new Decimal(0);

    const slips = employees.map((emp) => {
      const base = emp.baseSalary;
      const allowances = new Decimal(0);
      const overtime = new Decimal(0);
      const gross = base.add(allowances).add(overtime);

      const siSalary = emp.socialInsuranceSalary;
      // BHXH 8%, BHYT 1.5%, BHTN 1%
      const bhxh = new Decimal(Math.round(siSalary.toNumber() * 0.08));
      const bhyt = new Decimal(Math.round(siSalary.toNumber() * 0.015));
      const bhtn = new Decimal(Math.round(siSalary.toNumber() * 0.01));

      // PIT simplified: flat 10% on taxable income for MVP
      const taxableIncome = gross.sub(bhxh).sub(bhyt).sub(bhtn);
      const pit = taxableIncome.greaterThan(0)
        ? new Decimal(Math.round(taxableIncome.toNumber() * 0.1))
        : new Decimal(0);

      const otherDeductions = new Decimal(0);
      const net = gross.sub(bhxh).sub(bhyt).sub(bhtn).sub(pit).sub(otherDeductions);

      totalGross = totalGross.add(gross);
      totalNet = totalNet.add(net);
      totalDeductions = totalDeductions.add(bhxh).add(bhyt).add(bhtn).add(otherDeductions);
      totalPit = totalPit.add(pit);

      return {
        payrollRecordId: payrollId,
        employeeId: emp.id,
        baseSalary: base,
        allowances,
        overtime,
        grossSalary: gross,
        bhxh,
        bhyt,
        bhtn,
        personalIncomeTax: pit,
        otherDeductions,
        netSalary: net,
      };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.salarySlip.createMany({ data: slips });

      await tx.payrollRecord.update({
        where: { id: payrollId },
        data: {
          status: 'COMPUTED',
          totalGross,
          totalNet,
          totalDeductions,
          totalPit,
        },
      });
    });

    return this.findOnePayroll(companyId, payrollId);
  }

  async postPayroll(companyId: string, payrollId: string, userId: string, fiscalYearId: string) {
    const payroll = await this.prisma.payrollRecord.findFirst({
      where: { id: payrollId, companyId },
      include: { salarySlips: { include: { employee: true } } },
    });
    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }
    if (payroll.status !== 'COMPUTED') {
      throw new BadRequestException('Payroll must be computed before posting');
    }

    // Build JE lines grouped by department
    const deptTotals = new Map<string, Decimal>();
    let totalInsurance = new Decimal(0);
    let totalPitAmount = new Decimal(0);
    let totalNetAmount = new Decimal(0);

    for (const slip of payroll.salarySlips) {
      const dept = slip.employee.department ?? 'general';
      // Map department to account: production=622, overhead=627, sales=641, admin=642
      const acct = this.getDepartmentAccount(dept);
      const current = deptTotals.get(acct) ?? new Decimal(0);
      deptTotals.set(acct, current.add(slip.grossSalary));

      totalInsurance = totalInsurance.add(slip.bhxh).add(slip.bhyt).add(slip.bhtn);
      totalPitAmount = totalPitAmount.add(slip.personalIncomeTax);
      totalNetAmount = totalNetAmount.add(slip.netSalary);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const jeLines: Array<{ accountId: string; debitAmount: Decimal; creditAmount: Decimal; lineOrder: number; description: string }> = [];
      let lineOrder = 1;
      let totalDebit = new Decimal(0);

      // Dr department expense accounts
      for (const [acct, amount] of deptTotals) {
        jeLines.push({
          accountId: acct,
          debitAmount: amount,
          creditAmount: new Decimal(0),
          lineOrder: lineOrder++,
          description: `Salary expense - ${acct}`,
        });
        totalDebit = totalDebit.add(amount);
      }

      // Cr TK334 net payable
      jeLines.push({
        accountId: '334',
        debitAmount: new Decimal(0),
        creditAmount: totalNetAmount,
        lineOrder: lineOrder++,
        description: 'Net salary payable',
      });

      // Cr TK338 insurance payable
      if (totalInsurance.greaterThan(0)) {
        jeLines.push({
          accountId: '338',
          debitAmount: new Decimal(0),
          creditAmount: totalInsurance,
          lineOrder: lineOrder++,
          description: 'Insurance payable (BHXH+BHYT+BHTN)',
        });
      }

      // Cr TK3335 PIT payable
      if (totalPitAmount.greaterThan(0)) {
        jeLines.push({
          accountId: '3335',
          debitAmount: new Decimal(0),
          creditAmount: totalPitAmount,
          lineOrder: lineOrder++,
          description: 'Personal income tax payable',
        });
      }

      const count = await tx.journalEntry.count({
        where: { companyId, fiscalYearId },
      });
      const entryNumber = `JE-${String(count + 1).padStart(6, '0')}`;

      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          fiscalYearId,
          entryNumber,
          postingDate: new Date(`${payroll.periodYear}-${String(payroll.periodMonth).padStart(2, '0')}-28`),
          description: `Payroll: ${payroll.name}`,
          status: 'POSTED',
          entryType: 'STANDARD',
          totalDebit,
          totalCredit: totalDebit,
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          lines: { create: jeLines },
        },
      });

      await tx.accountingTransaction.create({
        data: {
          journalEntryId: journalEntry.id,
          sourceType: 'payroll',
          sourceId: payrollId,
          description: `Payroll: ${payroll.name}`,
        },
      });

      await tx.payrollRecord.update({
        where: { id: payrollId },
        data: {
          status: 'POSTED',
          journalEntryId: journalEntry.id,
          postedAt: new Date(),
        },
      });

      return journalEntry;
    });

    await this.auditService.create(
      companyId,
      userId,
      'POST',
      'PayrollRecord',
      payrollId,
      { status: 'COMPUTED' },
      { status: 'POSTED' },
    );

    this.eventEmitter.emit('journal.posted', {
      companyId,
      journalEntryId: result.id,
      entryNumber: result.entryNumber,
      userId,
    });

    return this.findOnePayroll(companyId, payrollId);
  }

  async findAllPayrolls(companyId: string, pagination: Pagination = {}) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.payrollRecord.findMany({
        where: { companyId },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.payrollRecord.count({ where: { companyId } }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOnePayroll(companyId: string, id: string) {
    const payroll = await this.prisma.payrollRecord.findFirst({
      where: { id, companyId },
      include: {
        salarySlips: {
          include: {
            employee: { select: { id: true, code: true, name: true, department: true } },
          },
          orderBy: { employee: { code: 'asc' } },
        },
      },
    });
    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }
    return payroll;
  }

  private getDepartmentAccount(department: string): string {
    const dept = department.toLowerCase();
    if (dept.includes('production') || dept.includes('sản xuất')) return '622';
    if (dept.includes('overhead') || dept.includes('phân xưởng')) return '627';
    if (dept.includes('sales') || dept.includes('bán hàng')) return '641';
    return '642'; // default: admin/management
  }
}
