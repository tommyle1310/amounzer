import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(private payrollService: PayrollService) {}

  // ── Employees ──────────────────────────────────────────────────────

  @Post('employees')
  @Roles('ADMIN', 'ACCOUNTANT')
  async createEmployee(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body()
    body: {
      code: string;
      name: string;
      department?: string;
      position?: string;
      baseSalary: number;
      socialInsuranceSalary: number;
      bankAccount?: string;
      bankName?: string;
      taxCode?: string;
    },
  ) {
    return this.payrollService.createEmployee(req.companyId, body);
  }

  @Get('employees')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAllEmployees(
    @Request() req: { companyId: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.payrollService.findAllEmployees(req.companyId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Get('employees/:id')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOneEmployee(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.payrollService.findOneEmployee(req.companyId, id);
  }

  @Put('employees/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async updateEmployee(
    @Request() req: { companyId: string },
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      department?: string;
      position?: string;
      baseSalary?: number;
      socialInsuranceSalary?: number;
      bankAccount?: string;
      bankName?: string;
      taxCode?: string;
      isActive?: boolean;
    },
  ) {
    return this.payrollService.updateEmployee(req.companyId, id, body);
  }

  // ── Payrolls ───────────────────────────────────────────────────────

  @Post('payrolls')
  @Roles('ADMIN', 'ACCOUNTANT')
  async createPayroll(
    @Request() req: { companyId: string },
    @Body() body: { periodMonth: number; periodYear: number; name: string },
  ) {
    return this.payrollService.createPayroll(req.companyId, body);
  }

  @Get('payrolls')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAllPayrolls(
    @Request() req: { companyId: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payrollService.findAllPayrolls(req.companyId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('payrolls/:id')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOnePayroll(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.payrollService.findOnePayroll(req.companyId, id);
  }

  @Post('payrolls/:id/compute')
  @Roles('ADMIN', 'ACCOUNTANT')
  async computePayroll(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.payrollService.computePayroll(req.companyId, id);
  }

  @Post('payrolls/:id/post')
  @Roles('ADMIN', 'ACCOUNTANT')
  async postPayroll(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { fiscalYearId: string },
  ) {
    return this.payrollService.postPayroll(req.companyId, id, req.user.sub, body.fiscalYearId);
  }
}
