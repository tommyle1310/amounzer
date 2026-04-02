import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BadDebtService } from './bad-debt.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('bad-debts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BadDebtController {
  constructor(private badDebtService: BadDebtService) {}

  @Post()
  @Roles('ADMIN', 'ACCOUNTANT')
  async create(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body()
    body: {
      customerId: string;
      amount: number;
      reason: string;
      provisionDate: string;
      fiscalYearId: string;
    },
  ) {
    return this.badDebtService.create(req.companyId, body, req.user.sub);
  }

  @Get()
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAll(
    @Request() req: { companyId: string },
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.badDebtService.findAll(
      req.companyId,
      { status, customerId },
      { page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined },
    );
  }

  @Get('report')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getReport(
    @Request() req: { companyId: string },
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
  ) {
    return this.badDebtService.getReport(req.companyId, periodStart, periodEnd);
  }

  @Get(':id')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOne(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.badDebtService.findOne(req.companyId, id);
  }

  @Post(':id/reverse')
  @Roles('ADMIN', 'ACCOUNTANT')
  async reverse(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { fiscalYearId: string },
  ) {
    return this.badDebtService.reverse(req.companyId, id, req.user.sub, body.fiscalYearId);
  }

  @Post(':id/write-off')
  @Roles('ADMIN', 'ACCOUNTANT')
  async writeOff(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { fiscalYearId: string },
  ) {
    return this.badDebtService.writeOff(req.companyId, id, req.user.sub, body.fiscalYearId);
  }
}
