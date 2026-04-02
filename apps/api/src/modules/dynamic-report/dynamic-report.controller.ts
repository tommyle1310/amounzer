import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DynamicReportService } from './dynamic-report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';

@Controller('dynamic-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DynamicReportController {
  constructor(private dynamicReportService: DynamicReportService) {}

  // ── Template CRUD ──

  @Post('templates')
  @Roles('ADMIN', 'ACCOUNTANT')
  async createTemplate(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body() body: { name: string; description?: string; config: unknown; isShared?: boolean },
  ) {
    return this.dynamicReportService.createTemplate(
      req.companyId,
      body as Parameters<typeof this.dynamicReportService.createTemplate>[1],
      req.user.sub,
    );
  }

  @Get('templates')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAllTemplates(@Request() req: { companyId: string }) {
    return this.dynamicReportService.findAllTemplates(req.companyId);
  }

  @Get('templates/:id')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOneTemplate(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.dynamicReportService.findOneTemplate(req.companyId, id);
  }

  @Put('templates/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async updateTemplate(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; config?: unknown; isShared?: boolean },
  ) {
    return this.dynamicReportService.updateTemplate(
      req.companyId,
      id,
      body as Parameters<typeof this.dynamicReportService.updateTemplate>[2],
      req.user.sub,
    );
  }

  @Delete('templates/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async deleteTemplate(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.dynamicReportService.deleteTemplate(req.companyId, id, req.user.sub);
  }

  // ── Execute ──

  @Post('execute')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async executeReport(
    @Request() req: { companyId: string },
    @Body() body: {
      dimensions: string[];
      measures: string[];
      filters: { field: string; operator: string; value: unknown }[];
      sorting?: { field: string; direction: 'asc' | 'desc' }[];
    },
  ) {
    return this.dynamicReportService.executeReport(req.companyId, body);
  }

  // ── Management Reports ──

  @Get('revenue-by-customer')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async revenueByCustomer(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.dynamicReportService.revenueByCustomer(req.companyId, startDate, endDate);
  }

  @Get('cost-by-department')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async costByDepartment(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.dynamicReportService.costByDepartment(req.companyId, startDate, endDate);
  }

  @Get('aging-report')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async agingReport(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('buckets') buckets?: string,
  ) {
    const bucketArray = buckets ? buckets.split(',').map(Number) : undefined;
    return this.dynamicReportService.agingReport(req.companyId, startDate, endDate, bucketArray);
  }

  @Get('budget-vs-actual')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async budgetVsActual(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.dynamicReportService.budgetVsActual(req.companyId, startDate, endDate);
  }

  @Get('trend-analysis')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async trendAnalysis(
    @Request() req: { companyId: string },
    @Query('months') months?: string,
  ) {
    return this.dynamicReportService.trendAnalysis(
      req.companyId,
      months ? parseInt(months, 10) : undefined,
    );
  }

  @Get('collection-performance')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async collectionPerformance(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.dynamicReportService.collectionPerformance(req.companyId, startDate, endDate);
  }

  @Get('detailed-cash-flow')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async detailedCashFlow(
    @Request() req: { companyId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.dynamicReportService.detailedCashFlow(req.companyId, startDate, endDate);
  }
}
