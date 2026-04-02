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
import { CustomFieldService } from './custom-field.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';

@Controller('custom-fields')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomFieldController {
  constructor(private customFieldService: CustomFieldService) {}

  @Post()
  @Roles('ADMIN', 'ACCOUNTANT')
  async create(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body()
    body: {
      entityType: string;
      fieldName: string;
      fieldLabel: string;
      fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKBOX' | 'MULTI_SELECT';
      options?: unknown[];
      validation?: Record<string, unknown>;
      sortOrder?: number;
    },
  ) {
    return this.customFieldService.create(req.companyId, body, req.user.sub);
  }

  @Get()
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAll(
    @Request() req: { companyId: string },
    @Query('entityType') entityType?: string,
  ) {
    return this.customFieldService.findAll(req.companyId, entityType);
  }

  @Get(':id')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOne(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.customFieldService.findOne(req.companyId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async update(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
    @Body()
    body: {
      fieldLabel?: string;
      fieldType?: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKBOX' | 'MULTI_SELECT';
      options?: unknown[];
      validation?: Record<string, unknown>;
      sortOrder?: number;
    },
  ) {
    return this.customFieldService.update(
      req.companyId,
      id,
      body,
      req.user.sub,
    );
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN', 'ACCOUNTANT')
  async deactivate(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.customFieldService.deactivate(
      req.companyId,
      id,
      req.user.sub,
    );
  }

  @Post('reorder')
  @Roles('ADMIN', 'ACCOUNTANT')
  async reorder(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body() body: { entityType: string; fieldIds: string[] },
  ) {
    return this.customFieldService.reorder(
      req.companyId,
      body.entityType,
      body.fieldIds,
      req.user.sub,
    );
  }
}
