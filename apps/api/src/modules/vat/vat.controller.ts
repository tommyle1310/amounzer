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
import { VatService } from './vat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('vat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VatController {
  constructor(private vatService: VatService) {}

  @Post()
  @Roles('ADMIN', 'ACCOUNTANT')
  async create(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body()
    body: {
      direction: 'INPUT' | 'OUTPUT';
      invoiceNumber: string;
      invoiceDate: string;
      customerId?: string;
      vendorId?: string;
      taxableAmount: number;
      vatRate: number;
      description?: string;
      journalEntryId?: string;
    },
  ) {
    return this.vatService.create(req.companyId, body, req.user.sub);
  }

  @Get()
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAll(
    @Request() req: { companyId: string },
    @Query('direction') direction?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vatService.findAll(
      req.companyId,
      { direction, startDate, endDate },
      { page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined },
    );
  }

  @Get('compute')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async computeVat(
    @Request() req: { companyId: string },
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    return this.vatService.computeVat(req.companyId, periodStart, periodEnd);
  }

  @Get('reconcile')
  @Roles('ADMIN', 'ACCOUNTANT')
  async reconcile(
    @Request() req: { companyId: string },
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    return this.vatService.reconcile(req.companyId, periodStart, periodEnd);
  }

  @Get('export-htkk')
  @Roles('ADMIN', 'ACCOUNTANT')
  async exportHTKK(
    @Request() req: { companyId: string },
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    return this.vatService.exportHTKK(req.companyId, periodStart, periodEnd);
  }

  @Get(':id')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOne(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.vatService.findOne(req.companyId, id);
  }
}
