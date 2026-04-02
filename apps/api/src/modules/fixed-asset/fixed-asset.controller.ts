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
import { FixedAssetService } from './fixed-asset.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('fixed-assets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FixedAssetController {
  constructor(private fixedAssetService: FixedAssetService) {}

  @Post()
  @Roles('ADMIN', 'ACCOUNTANT')
  async create(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body()
    body: {
      code: string;
      name: string;
      category: string;
      acquisitionDate: string;
      acquisitionCost: number;
      usefulLifeMonths: number;
      depreciationMethod?: 'STRAIGHT_LINE' | 'DECLINING_BALANCE';
      residualValue?: number;
      departmentAccount?: string;
      sourceAccountId: string;
      fiscalYearId: string;
    },
  ) {
    return this.fixedAssetService.create(req.companyId, body, req.user.sub);
  }

  @Get()
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAll(
    @Request() req: { companyId: string },
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fixedAssetService.findAll(
      req.companyId,
      { status, category },
      { page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined },
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOne(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.fixedAssetService.findOne(req.companyId, id);
  }

  @Post(':id/dispose')
  @Roles('ADMIN', 'ACCOUNTANT')
  async dispose(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { proceeds: number; date: string; fiscalYearId: string },
  ) {
    return this.fixedAssetService.dispose(req.companyId, id, body, req.user.sub);
  }

  @Post('run-depreciation')
  @Roles('ADMIN', 'ACCOUNTANT')
  async runDepreciation(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body() body: { periodDate: string; fiscalYearId: string },
  ) {
    return this.fixedAssetService.runMonthlyDepreciation(
      req.companyId,
      body.periodDate,
      req.user.sub,
      body.fiscalYearId,
    );
  }

  @Get(':id/schedule')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getSchedule(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.fixedAssetService.getDepreciationSchedule(req.companyId, id);
  }
}
