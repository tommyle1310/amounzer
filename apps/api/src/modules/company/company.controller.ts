import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';

@Controller()
export class CompanyController {
  constructor(private companyService: CompanyService) {}

  @Post('companies')
  @UseGuards(JwtAuthGuard)
  async create(
    @Request() req: { user: { sub: string } },
    @Body()
    body: {
      name: string;
      taxCode?: string;
      address?: string;
      legalRepresentative?: string;
      phone?: string;
      accountingStandard?: 'TT200' | 'TT133';
      baseCurrency?: string;
      locale?: string;
    },
  ) {
    return this.companyService.create(body, req.user.sub);
  }

  @Get('companies')
  @UseGuards(JwtAuthGuard)
  async findAll(@Request() req: { user: { sub: string } }) {
    return this.companyService.findAll(req.user.sub);
  }

  @Get('companies/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOne(@Param('id') id: string) {
    return this.companyService.findOne(id);
  }

  @Patch('companies/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      taxCode?: string;
      address?: string;
      legalRepresentative?: string;
      phone?: string;
      accountingStandard?: 'TT200' | 'TT133';
      baseCurrency?: string;
      locale?: string;
    },
  ) {
    return this.companyService.update(id, body);
  }

  @Post('companies/:id/fiscal-years')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createFiscalYear(
    @Param('id') companyId: string,
    @Body() body: { name: string; startDate: string; endDate: string },
  ) {
    return this.companyService.createFiscalYear(companyId, {
      name: body.name,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
    });
  }

  @Get('companies/:id/fiscal-years')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getFiscalYears(@Param('id') companyId: string) {
    return this.companyService.getFiscalYears(companyId);
  }

  @Get('fiscal-years/:id/periods')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getFiscalPeriods(@Param('id') fiscalYearId: string) {
    return this.companyService.getFiscalPeriods(fiscalYearId);
  }
}
