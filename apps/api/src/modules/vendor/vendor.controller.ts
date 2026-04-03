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
import { VendorService } from './vendor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';

@Controller('vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorController {
  constructor(private vendorService: VendorService) {}

  @Post()
  @Roles('ADMIN', 'ACCOUNTANT')
  async create(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body()
    body: {
      code: string;
      name: string;
      taxCode?: string;
      address?: string;
      phone?: string;
      email?: string;
      contactPerson?: string;
      contactPhone?: string;
      bankAccount?: string;
      bankName?: string;
      customFieldValues?: Record<string, unknown>;
    },
  ) {
    return this.vendorService.create(req.companyId, body, req.user.sub);
  }

  @Get()
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAll(
    @Request() req: { companyId: string },
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vendorService.findAll(
      req.companyId,
      {
        search,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      },
      { page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined },
    );
  }

  @Get('aging')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async aging(
    @Request() req: { companyId: string },
    @Query('vendorId') vendorId?: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    return this.vendorService.getAgingReport(
      req.companyId,
      vendorId,
      asOfDate,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOne(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.vendorService.findOne(req.companyId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async update(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      taxCode?: string;
      address?: string;
      phone?: string;
      email?: string;
      contactPerson?: string;
      contactPhone?: string;
      bankAccount?: string;
      bankName?: string;
      customFieldValues?: Record<string, unknown>;
    },
  ) {
    return this.vendorService.update(req.companyId, id, body, req.user.sub);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN', 'ACCOUNTANT')
  async deactivate(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.vendorService.deactivate(req.companyId, id, req.user.sub);
  }
}
