import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { VoucherService } from './voucher.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';

@Controller('vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoucherController {
  constructor(private voucherService: VoucherService) {}

  @Post()
  @Roles('ADMIN', 'ACCOUNTANT')
  async create(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body()
    body: {
      voucherType: 'PT' | 'PC' | 'BDN' | 'BCN' | 'BT' | 'CTGS';
      date: string;
      recordingDate?: string;
      voucherBookNo?: string;
      
      // Transaction party info (TT200/TT133)
      counterpartyName?: string;
      counterpartyId?: string;
      counterpartyType?: string;
      partyFullName?: string;
      partyAddress?: string;
      partyTaxCode?: string;
      partyIdNumber?: string;
      
      description: string;
      totalAmount: number;
      amountInWords?: string;
      
      // Foreign currency
      currency?: string;
      originalAmount?: number;
      exchangeRate?: number;
      
      // Supporting documents
      attachmentCount?: number;
      originalDocRefs?: string;
      
      fiscalYearId: string;
      lines: Array<{
        accountId: string;
        description?: string;
        debitAmount: number;
        creditAmount: number;
        customerId?: string;
        vendorId?: string;
      }>;
      customFieldValues?: Record<string, unknown>;
    },
  ) {
    return this.voucherService.create(req.companyId, body, req.user.sub);
  }

  @Patch(':id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async update(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
    @Body()
    body: {
      voucherType?: 'PT' | 'PC' | 'BDN' | 'BCN' | 'BT' | 'CTGS';
      date?: string;
      recordingDate?: string;
      voucherBookNo?: string;
      
      // Transaction party info (TT200/TT133)
      counterpartyName?: string;
      counterpartyId?: string;
      counterpartyType?: string;
      partyFullName?: string;
      partyAddress?: string;
      partyTaxCode?: string;
      partyIdNumber?: string;
      
      description?: string;
      totalAmount?: number;
      amountInWords?: string;
      
      // Foreign currency
      currency?: string;
      originalAmount?: number;
      exchangeRate?: number;
      
      // Supporting documents
      attachmentCount?: number;
      originalDocRefs?: string;
      
      fiscalYearId?: string;
      lines?: Array<{
        accountId: string;
        description?: string;
        debitAmount: number;
        creditAmount: number;
        customerId?: string;
        vendorId?: string;
      }>;
      customFieldValues?: Record<string, unknown>;
    },
  ) {
    return this.voucherService.update(req.companyId, id, body, req.user.sub);
  }

  @Get()
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAll(
    @Request() req: { companyId: string },
    @Query('voucherType') voucherType?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('counterpartyName') counterpartyName?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.voucherService.findAll(
      req.companyId,
      { voucherType, status, startDate, endDate, counterpartyName },
      { page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined },
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOne(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.voucherService.findOne(req.companyId, id);
  }

  @Post(':id/post')
  @Roles('ADMIN', 'ACCOUNTANT')
  async post(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.voucherService.post(req.companyId, id, req.user.sub);
  }

  @Post('batch-post')
  @Roles('ADMIN', 'ACCOUNTANT')
  async batchPost(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body() body: { ids: string[] },
  ) {
    return this.voucherService.batchPost(
      req.companyId,
      body.ids,
      req.user.sub,
    );
  }

  @Post(':id/void')
  @Roles('ADMIN', 'ACCOUNTANT')
  async voidVoucher(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.voucherService.void(req.companyId, id, req.user.sub);
  }
}
