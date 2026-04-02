import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

interface CreateItemData {
  code: string;
  name: string;
  unit: string;
  accountCode?: string;
  valuationMethod?: 'WEIGHTED_AVERAGE' | 'FIFO' | 'SPECIFIC';
}

interface UpdateItemData {
  name?: string;
  unit?: string;
  accountCode?: string;
  isActive?: boolean;
}

interface CreateWarehouseData {
  code: string;
  name: string;
  address?: string;
}

interface CreateMovementData {
  inventoryItemId: string;
  warehouseId: string;
  movementType: 'RECEIPT' | 'ISSUE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';
  date: string | Date;
  quantity: number;
  unitCost: number;
  reference?: string;
  description?: string;
  fiscalYearId: string;
}

interface MovementFilters {
  itemId?: string;
  warehouseId?: string;
  startDate?: string;
  endDate?: string;
}

interface ItemFilters {
  isActive?: boolean;
  search?: string;
}

interface Pagination {
  page?: number;
  limit?: number;
}

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private eventEmitter: EventEmitter2,
  ) {}

  async createItem(companyId: string, data: CreateItemData) {
    const item = await this.prisma.inventoryItem.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        unit: data.unit,
        accountCode: data.accountCode ?? '152',
        valuationMethod: data.valuationMethod ?? 'WEIGHTED_AVERAGE',
        currentQty: 0,
        currentValue: 0,
        avgUnitCost: 0,
      },
    });

    return item;
  }

  async findAllItems(companyId: string, filters: ItemFilters = {}, pagination: Pagination = {}) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneItem(companyId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, companyId },
      include: {
        movements: {
          orderBy: { date: 'desc' },
          take: 20,
          include: { warehouse: { select: { id: true, code: true, name: true } } },
        },
      },
    });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    return item;
  }

  async updateItem(companyId: string, id: string, data: UpdateItemData) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, companyId },
    });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data,
    });

    return updated;
  }

  async createWarehouse(companyId: string, data: CreateWarehouseData) {
    const warehouse = await this.prisma.warehouse.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        address: data.address,
      },
    });

    return warehouse;
  }

  async findAllWarehouses(companyId: string) {
    return this.prisma.warehouse.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
  }

  async createMovement(companyId: string, data: CreateMovementData, userId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: data.inventoryItemId, companyId },
    });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: data.warehouseId, companyId },
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    const quantity = new Decimal(data.quantity);
    const unitCost = new Decimal(data.unitCost);
    const totalCost = new Decimal(Math.round(data.quantity * data.unitCost));

    // Validate issue has enough stock
    if (data.movementType === 'ISSUE' || data.movementType === 'TRANSFER_OUT') {
      if (item.currentQty.lessThan(quantity)) {
        throw new BadRequestException(
          `Insufficient stock. Current: ${item.currentQty}, Requested: ${quantity}`,
        );
      }
    }

    // Determine new qty/value/avgCost
    let newQty: Decimal;
    let newValue: Decimal;
    let newAvgCost: Decimal;
    let movementTotalCost: Decimal;

    if (data.movementType === 'RECEIPT' || data.movementType === 'TRANSFER_IN') {
      newQty = item.currentQty.add(quantity);
      newValue = item.currentValue.add(totalCost);
      newAvgCost = newQty.isZero() ? new Decimal(0) : newValue.div(newQty);
      movementTotalCost = totalCost;
    } else if (data.movementType === 'ISSUE' || data.movementType === 'TRANSFER_OUT') {
      // Use weighted average cost for issues
      movementTotalCost = new Decimal(
        Math.round(item.avgUnitCost.toNumber() * data.quantity),
      );
      newQty = item.currentQty.sub(quantity);
      newValue = item.currentValue.sub(movementTotalCost);
      newAvgCost = newQty.isZero() ? new Decimal(0) : newValue.div(newQty);
    } else {
      // ADJUSTMENT
      newQty = item.currentQty.add(quantity);
      newValue = item.currentValue.add(totalCost);
      newAvgCost = newQty.isZero() ? new Decimal(0) : newValue.div(newQty);
      movementTotalCost = totalCost;
    }

    // Build journal entry lines based on movement type
    const journalLines = this.buildMovementJournalLines(
      data.movementType,
      movementTotalCost,
      item.accountCode,
      data.inventoryItemId,
    );

    // Create movement, update item, create JE in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryMovement.create({
        data: {
          companyId,
          inventoryItemId: data.inventoryItemId,
          warehouseId: data.warehouseId,
          movementType: data.movementType,
          date: new Date(data.date),
          quantity,
          unitCost: data.movementType === 'ISSUE' || data.movementType === 'TRANSFER_OUT'
            ? item.avgUnitCost
            : unitCost,
          totalCost: movementTotalCost,
          reference: data.reference,
          description: data.description,
        },
      });

      await tx.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: {
          currentQty: newQty,
          currentValue: newValue,
          avgUnitCost: newAvgCost,
        },
      });

      // Find active fiscal year
      const fiscalYear = await tx.fiscalYear.findFirst({
        where: { id: data.fiscalYearId, companyId },
      });
      if (!fiscalYear || fiscalYear.status === 'CLOSED') {
        throw new BadRequestException('Fiscal year not found or closed');
      }

      // Generate entry number
      const count = await tx.journalEntry.count({
        where: { companyId, fiscalYearId: data.fiscalYearId },
      });
      const entryNumber = `JE-${String(count + 1).padStart(6, '0')}`;

      const totalAmount = movementTotalCost;

      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          fiscalYearId: data.fiscalYearId,
          entryNumber,
          postingDate: new Date(data.date),
          description: `Inventory ${data.movementType}: ${item.code} - ${item.name}`,
          status: 'POSTED',
          entryType: 'STANDARD',
          totalDebit: totalAmount,
          totalCredit: totalAmount,
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          lines: {
            create: journalLines.map((line, index) => ({
              ...line,
              lineOrder: index + 1,
              inventoryItemId: data.inventoryItemId,
            })),
          },
        },
      });

      // Link via AccountingTransaction
      await tx.accountingTransaction.create({
        data: {
          journalEntryId: journalEntry.id,
          sourceType: 'inventory',
          sourceId: movement.id,
          description: `Inventory ${data.movementType}: ${item.code}`,
        },
      });

      return { movement, journalEntry };
    });

    await this.auditService.create(
      companyId,
      userId,
      'CREATE',
      'InventoryMovement',
      result.movement.id,
      undefined,
      result.movement as unknown as Record<string, unknown>,
    );

    this.eventEmitter.emit('journal.posted', {
      companyId,
      journalEntryId: result.journalEntry.id,
      entryNumber: result.journalEntry.entryNumber,
      userId,
    });

    return result;
  }

  async getMovements(
    companyId: string,
    filters: MovementFilters = {},
    pagination: Pagination = {},
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };
    if (filters.itemId) where.inventoryItemId = filters.itemId;
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;

    if (filters.startDate || filters.endDate) {
      const date: Record<string, Date> = {};
      if (filters.startDate) date.gte = new Date(filters.startDate);
      if (filters.endDate) date.lte = new Date(filters.endDate);
      where.date = date;
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: {
          inventoryItem: { select: { id: true, code: true, name: true, unit: true } },
          warehouse: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async recalculateWeightedAverage(itemId: string) {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { inventoryItemId: itemId },
      orderBy: { date: 'asc' },
    });

    let qty = new Decimal(0);
    let value = new Decimal(0);

    for (const m of movements) {
      if (m.movementType === 'RECEIPT' || m.movementType === 'TRANSFER_IN') {
        qty = qty.add(m.quantity);
        value = value.add(m.totalCost);
      } else if (m.movementType === 'ISSUE' || m.movementType === 'TRANSFER_OUT') {
        const avgCost = qty.isZero() ? new Decimal(0) : value.div(qty);
        const issueCost = new Decimal(Math.round(avgCost.toNumber() * m.quantity.toNumber()));
        qty = qty.sub(m.quantity);
        value = value.sub(issueCost);
      } else {
        qty = qty.add(m.quantity);
        value = value.add(m.totalCost);
      }
    }

    const avgUnitCost = qty.isZero() ? new Decimal(0) : value.div(qty);

    await this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: { currentQty: qty, currentValue: value, avgUnitCost },
    });

    return { currentQty: qty, currentValue: value, avgUnitCost };
  }

  private buildMovementJournalLines(
    movementType: string,
    totalCost: Decimal,
    accountCode: string,
    _inventoryItemId: string,
  ) {
    // Vietnamese accounting:
    // Receipt: Dr TK152 (inventory) Cr TK331 (payables)
    // Issue:   Dr TK632 (COGS)      Cr TK152 (inventory)
    if (movementType === 'RECEIPT' || movementType === 'TRANSFER_IN') {
      return [
        { accountId: accountCode, debitAmount: totalCost, creditAmount: new Decimal(0), description: 'Inventory receipt' },
        { accountId: '331', debitAmount: new Decimal(0), creditAmount: totalCost, description: 'Payables for inventory' },
      ];
    } else if (movementType === 'ISSUE' || movementType === 'TRANSFER_OUT') {
      return [
        { accountId: '632', debitAmount: totalCost, creditAmount: new Decimal(0), description: 'Cost of goods sold' },
        { accountId: accountCode, debitAmount: new Decimal(0), creditAmount: totalCost, description: 'Inventory issued' },
      ];
    }
    // ADJUSTMENT: Dr/Cr inventory vs TK632
    return [
      { accountId: accountCode, debitAmount: totalCost, creditAmount: new Decimal(0), description: 'Inventory adjustment' },
      { accountId: '632', debitAmount: new Decimal(0), creditAmount: totalCost, description: 'Adjustment contra' },
    ];
  }
}
