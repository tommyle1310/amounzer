import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  // ── Items ──────────────────────────────────────────────────────────

  @Post('items')
  @Roles('ADMIN', 'ACCOUNTANT')
  async createItem(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body() body: { code: string; name: string; unit: string; accountCode?: string; valuationMethod?: 'WEIGHTED_AVERAGE' | 'FIFO' | 'SPECIFIC' },
  ) {
    return this.inventoryService.createItem(req.companyId, body);
  }

  @Get('items')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAllItems(
    @Request() req: { companyId: string },
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.findAllItems(
      req.companyId,
      {
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        search,
      },
      { page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined },
    );
  }

  @Get('items/:id')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findOneItem(
    @Request() req: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.inventoryService.findOneItem(req.companyId, id);
  }

  @Put('items/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async updateItem(
    @Request() req: { companyId: string },
    @Param('id') id: string,
    @Body() body: { name?: string; unit?: string; accountCode?: string; isActive?: boolean },
  ) {
    return this.inventoryService.updateItem(req.companyId, id, body);
  }

  // ── Warehouses ─────────────────────────────────────────────────────

  @Post('warehouses')
  @Roles('ADMIN', 'ACCOUNTANT')
  async createWarehouse(
    @Request() req: { companyId: string },
    @Body() body: { code: string; name: string; address?: string },
  ) {
    return this.inventoryService.createWarehouse(req.companyId, body);
  }

  @Get('warehouses')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async findAllWarehouses(@Request() req: { companyId: string }) {
    return this.inventoryService.findAllWarehouses(req.companyId);
  }

  // ── Movements ──────────────────────────────────────────────────────

  @Post('movements')
  @Roles('ADMIN', 'ACCOUNTANT')
  async createMovement(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body()
    body: {
      inventoryItemId: string;
      warehouseId: string;
      movementType: 'RECEIPT' | 'ISSUE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';
      date: string;
      quantity: number;
      unitCost: number;
      reference?: string;
      description?: string;
      fiscalYearId: string;
    },
  ) {
    return this.inventoryService.createMovement(req.companyId, body, req.user.sub);
  }

  @Get('movements')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async getMovements(
    @Request() req: { companyId: string },
    @Query('itemId') itemId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.getMovements(
      req.companyId,
      { itemId, warehouseId, startDate, endDate },
      { page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined },
    );
  }
}
