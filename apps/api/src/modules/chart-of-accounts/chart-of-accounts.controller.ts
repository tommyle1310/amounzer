import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';

@Controller('chart-of-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChartOfAccountsController {
  constructor(private chartService: ChartOfAccountsService) {}

  @Post()
  @Roles('ADMIN', 'ACCOUNTANT')
  async create(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body()
    body: {
      code: string;
      name: string;
      nameEn?: string;
      accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'OFF_BALANCE_SHEET';
      normalBalance: 'DEBIT' | 'CREDIT';
      parentId?: string;
      level?: number;
      description?: string;
    },
  ) {
    return this.chartService.create(req.companyId, body, req.user.sub);
  }

  @Get()
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAll(
    @Request() req: { companyId: string },
    @Query('accountType') accountType?: string,
    @Query('isActive') isActive?: string,
    @Query('level') level?: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.chartService.findAll(req.companyId, {
      accountType,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      level: level ? parseInt(level, 10) : undefined,
      parentId,
    });
  }

  @Get('tree')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findTree(@Request() req: { companyId: string }) {
    return this.chartService.findTree(req.companyId);
  }

  @Get('search')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async search(
    @Request() req: { companyId: string },
    @Query('q') query: string,
  ) {
    return this.chartService.search(req.companyId, query ?? '');
  }

  /**
   * Account suggestion API for debounced autocomplete
   * Frontend should debounce calls by 300ms before hitting this endpoint
   */
  @Get('suggest')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async suggestAccounts(
    @Request() req: { companyId: string },
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.chartService.suggestAccounts(
      req.companyId,
      query ?? '',
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * Get sub-accounts linked to a specific partner (customer/vendor)
   */
  @Get('partner/:partnerId/accounts')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getPartnerSubAccounts(
    @Request() req: { companyId: string },
    @Param('partnerId') partnerId: string,
    @Query('type') partnerType: 'customer' | 'vendor',
  ) {
    return this.chartService.getPartnerSubAccounts(req.companyId, partnerId, partnerType);
  }

  /**
   * Create a sub-account for a partner (TT99 compliance - flexible sub-accounts)
   */
  @Post('partner-subaccount')
  @Roles('ADMIN', 'ACCOUNTANT')
  async createSubAccountForPartner(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body()
    body: {
      parentAccountCode: string;
      partnerCode: string;
      partnerName: string;
      partnerType: 'customer' | 'vendor';
      partnerId: string;
    },
  ) {
    return this.chartService.createSubAccountForPartner(
      req.companyId,
      body.parentAccountCode,
      body.partnerCode,
      body.partnerName,
      body.partnerType,
      body.partnerId,
      req.user.sub,
    );
  }

  /**
   * Create a manual sub-account (not linked to partner)
   * For accounts like 333 > 3338 > 33381, 33382
   */
  @Post('manual-subaccount')
  @Roles('ADMIN', 'ACCOUNTANT')
  async createManualSubAccount(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body()
    body: {
      parentAccountCode: string;
      codeSuffix: string;
      name: string;
      nameEn?: string;
      description?: string;
    },
  ) {
    return this.chartService.createManualSubAccount(
      req.companyId,
      body.parentAccountCode,
      body.codeSuffix,
      body.name,
      body.nameEn,
      body.description,
      req.user.sub,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOne(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.chartService.findOne(req.companyId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async update(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      nameEn?: string;
      description?: string;
      parentId?: string;
    },
  ) {
    return this.chartService.update(req.companyId, id, body, req.user.sub);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN', 'ACCOUNTANT')
  async deactivate(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.chartService.deactivate(req.companyId, id, req.user.sub);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async delete(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.chartService.delete(req.companyId, id, req.user.sub);
  }

  @Post('seed')
  @Roles('ADMIN')
  async seed(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body() body: { standard: 'TT200' | 'TT133' | 'TT99' },
  ) {
    return this.chartService.seedChart(req.companyId, body.standard, req.user.sub);
  }
}
