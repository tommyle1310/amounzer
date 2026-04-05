import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JournalEntryService } from './journal-entry.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';

@Controller('journal-entries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JournalEntryController {
  constructor(private journalEntryService: JournalEntryService) {}

  @Post()
  @Roles('ADMIN', 'ACCOUNTANT')
  async create(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body()
    body: {
      fiscalYearId: string;
      postingDate: string;
      description: string;
      entryType?: 'STANDARD' | 'ADJUSTMENT' | 'CLOSING' | 'REVERSAL' | 'OPENING';
      lines: Array<{
        accountId: string;
        description?: string;
        note?: string;
        debitAmount: number;
        creditAmount: number;
        lineOrder?: number;
        customerId?: string;
        vendorId?: string;
        inventoryItemId?: string;
        employeeId?: string;
      }>;
      customFieldValues?: Record<string, unknown>;
    },
  ) {
    return this.journalEntryService.create(
      req.companyId,
      body.fiscalYearId,
      body,
      req.user.sub,
    );
  }

  @Get()
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAll(
    @Request() req: { companyId: string },
    @Query('fiscalYearId') fiscalYearId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.journalEntryService.findAll(
      req.companyId,
      { fiscalYearId, status, startDate, endDate },
      { page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined },
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOne(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.journalEntryService.findOne(req.companyId, id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async delete(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.journalEntryService.delete(req.companyId, id);
  }

  @Post(':id/post')
  @Roles('ADMIN', 'ACCOUNTANT')
  async post(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.journalEntryService.post(req.companyId, id, req.user.sub);
  }

  @Post(':id/reverse')
  @Roles('ADMIN', 'ACCOUNTANT')
  async reverse(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.journalEntryService.createReversal(
      req.companyId,
      id,
      req.user.sub,
    );
  }

  @Post(':id/correct')
  @Roles('ADMIN', 'ACCOUNTANT')
  async correct(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.journalEntryService.createCorrection(
      req.companyId,
      id,
      req.user.sub,
    );
  }
}
