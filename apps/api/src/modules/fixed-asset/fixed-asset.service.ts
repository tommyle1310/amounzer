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

interface CreateAssetData {
  code: string;
  name: string;
  category: string;
  acquisitionDate: string | Date;
  acquisitionCost: number;
  usefulLifeMonths: number;
  depreciationMethod?: 'STRAIGHT_LINE' | 'DECLINING_BALANCE';
  residualValue?: number;
  departmentAccount?: string;
  sourceAccountId: string; // Credit account for acquisition (e.g. 111, 112, 331)
  fiscalYearId: string;
}

interface AssetFilters {
  status?: string;
  category?: string;
}

interface DisposeData {
  proceeds: number;
  date: string | Date;
  fiscalYearId: string;
}

interface Pagination {
  page?: number;
  limit?: number;
}

@Injectable()
export class FixedAssetService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(companyId: string, data: CreateAssetData, userId: string) {
    const cost = new Decimal(data.acquisitionCost);
    const residual = new Decimal(data.residualValue ?? 0);
    const depreciableAmount = cost.sub(residual);

    let monthlyDeprAmount: Decimal;
    if ((data.depreciationMethod ?? 'STRAIGHT_LINE') === 'STRAIGHT_LINE') {
      // Straight-line: (cost - residual) / usefulLifeMonths
      monthlyDeprAmount = new Decimal(
        Math.round(depreciableAmount.toNumber() / data.usefulLifeMonths),
      );
    } else {
      // Declining balance: (2 / usefulLifeYears) * NBV — first month approximation
      const usefulLifeYears = data.usefulLifeMonths / 12;
      const annualRate = 2 / usefulLifeYears;
      const annualDepr = Math.round(cost.toNumber() * annualRate);
      monthlyDeprAmount = new Decimal(Math.round(annualDepr / 12));
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.fixedAsset.create({
        data: {
          companyId,
          code: data.code,
          name: data.name,
          category: data.category,
          acquisitionDate: new Date(data.acquisitionDate),
          acquisitionCost: cost,
          usefulLifeMonths: data.usefulLifeMonths,
          depreciationMethod: data.depreciationMethod ?? 'STRAIGHT_LINE',
          residualValue: residual,
          accumulatedDepr: 0,
          netBookValue: cost,
          monthlyDeprAmount,
          departmentAccount: data.departmentAccount ?? '627',
          status: 'ACTIVE',
        },
      });

      // Generate acquisition JE: Dr TK211 Cr source account
      const count = await tx.journalEntry.count({
        where: { companyId, fiscalYearId: data.fiscalYearId },
      });
      const entryNumber = `JE-${String(count + 1).padStart(6, '0')}`;

      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          fiscalYearId: data.fiscalYearId,
          entryNumber,
          postingDate: new Date(data.acquisitionDate),
          description: `Fixed asset acquisition: ${data.code} - ${data.name}`,
          status: 'POSTED',
          entryType: 'STANDARD',
          totalDebit: cost,
          totalCredit: cost,
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          lines: {
            create: [
              { accountId: '211', debitAmount: cost, creditAmount: 0, lineOrder: 1, description: 'Fixed asset acquisition' },
              { accountId: data.sourceAccountId, debitAmount: 0, creditAmount: cost, lineOrder: 2, description: `Payment for ${data.code}` },
            ],
          },
        },
      });

      await tx.accountingTransaction.create({
        data: {
          journalEntryId: journalEntry.id,
          sourceType: 'fixed_asset',
          sourceId: asset.id,
          description: `Acquisition: ${data.code}`,
        },
      });

      return { asset, journalEntry };
    });

    await this.auditService.create(
      companyId,
      userId,
      'CREATE',
      'FixedAsset',
      result.asset.id,
      undefined,
      result.asset as unknown as Record<string, unknown>,
    );

    this.eventEmitter.emit('journal.posted', {
      companyId,
      journalEntryId: result.journalEntry.id,
      entryNumber: result.journalEntry.entryNumber,
      userId,
    });

    return result;
  }

  async findAll(companyId: string, filters: AssetFilters = {}, pagination: Pagination = {}) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;

    const [data, total] = await Promise.all([
      this.prisma.fixedAsset.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.fixedAsset.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(companyId: string, id: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id, companyId },
      include: {
        depreciationSchedules: {
          orderBy: { periodDate: 'asc' },
        },
      },
    });
    if (!asset) {
      throw new NotFoundException('Fixed asset not found');
    }
    return asset;
  }

  async dispose(companyId: string, id: string, data: DisposeData, userId: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id, companyId },
    });
    if (!asset) {
      throw new NotFoundException('Fixed asset not found');
    }
    if (asset.status !== 'ACTIVE' && asset.status !== 'FULLY_DEPRECIATED') {
      throw new BadRequestException('Asset is already disposed');
    }

    const proceeds = new Decimal(data.proceeds);
    const nbv = asset.netBookValue;
    const gainLoss = proceeds.sub(nbv); // positive = gain, negative = loss
    const accumDepr = asset.accumulatedDepr;
    const cost = asset.acquisitionCost;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.fixedAsset.update({
        where: { id },
        data: {
          status: 'DISPOSED',
          disposalDate: new Date(data.date),
          disposalProceeds: proceeds,
          disposalGainLoss: gainLoss,
        },
      });

      // Disposal JE:
      // Dr TK214 (accumulated depr)
      // Dr TK111 (cash proceeds)
      // Dr TK811 (loss, if any)
      // Cr TK211 (asset cost)
      // Cr TK711 (gain, if any)
      const lines: Array<{ accountId: string; debitAmount: Decimal; creditAmount: Decimal; lineOrder: number; description: string }> = [];
      let lineOrder = 1;

      // Dr TK214 accumulated depreciation
      if (accumDepr.greaterThan(0)) {
        lines.push({ accountId: '214', debitAmount: accumDepr, creditAmount: new Decimal(0), lineOrder: lineOrder++, description: 'Reverse accumulated depreciation' });
      }

      // Dr TK111 cash proceeds
      if (proceeds.greaterThan(0)) {
        lines.push({ accountId: '111', debitAmount: proceeds, creditAmount: new Decimal(0), lineOrder: lineOrder++, description: 'Disposal proceeds' });
      }

      // Dr TK811 loss on disposal
      if (gainLoss.lessThan(0)) {
        lines.push({ accountId: '811', debitAmount: gainLoss.abs(), creditAmount: new Decimal(0), lineOrder: lineOrder++, description: 'Loss on disposal' });
      }

      // Cr TK211 asset cost
      lines.push({ accountId: '211', debitAmount: new Decimal(0), creditAmount: cost, lineOrder: lineOrder++, description: 'Remove asset cost' });

      // Cr TK711 gain on disposal
      if (gainLoss.greaterThan(0)) {
        lines.push({ accountId: '711', debitAmount: new Decimal(0), creditAmount: gainLoss, lineOrder: lineOrder++, description: 'Gain on disposal' });
      }

      const totalDebit = lines.reduce((sum, l) => sum.add(l.debitAmount), new Decimal(0));
      const totalCredit = lines.reduce((sum, l) => sum.add(l.creditAmount), new Decimal(0));

      const count = await tx.journalEntry.count({
        where: { companyId, fiscalYearId: data.fiscalYearId },
      });
      const entryNumber = `JE-${String(count + 1).padStart(6, '0')}`;

      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          fiscalYearId: data.fiscalYearId,
          entryNumber,
          postingDate: new Date(data.date),
          description: `Fixed asset disposal: ${asset.code} - ${asset.name}`,
          status: 'POSTED',
          entryType: 'STANDARD',
          totalDebit,
          totalCredit,
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          lines: { create: lines },
        },
      });

      await tx.accountingTransaction.create({
        data: {
          journalEntryId: journalEntry.id,
          sourceType: 'fixed_asset',
          sourceId: id,
          description: `Disposal: ${asset.code}`,
        },
      });

      return { asset: updated, journalEntry };
    });

    await this.auditService.create(
      companyId,
      userId,
      'DISPOSE',
      'FixedAsset',
      id,
      { status: asset.status },
      { status: 'DISPOSED', disposalProceeds: data.proceeds },
    );

    this.eventEmitter.emit('journal.posted', {
      companyId,
      journalEntryId: result.journalEntry.id,
      entryNumber: result.journalEntry.entryNumber,
      userId,
    });

    return result;
  }

  async runMonthlyDepreciation(companyId: string, periodDate: string | Date, userId: string, fiscalYearId: string) {
    const period = new Date(periodDate);

    const activeAssets = await this.prisma.fixedAsset.findMany({
      where: { companyId, status: 'ACTIVE' },
    });

    if (activeAssets.length === 0) {
      return { message: 'No active assets to depreciate', schedules: [] };
    }

    // Check for already-depreciated period
    const existingSchedule = await this.prisma.depreciationSchedule.findFirst({
      where: {
        fixedAssetId: { in: activeAssets.map((a) => a.id) },
        periodDate: period,
      },
    });
    if (existingSchedule) {
      throw new BadRequestException('Depreciation already run for this period');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const schedules: Array<{ assetId: string; amount: Decimal }> = [];
      const jeLines: Array<{ accountId: string; debitAmount: Decimal; creditAmount: Decimal; lineOrder: number; description: string }> = [];
      let lineOrder = 1;
      let totalDeprAmount = new Decimal(0);

      for (const asset of activeAssets) {
        let deprAmount: Decimal;

        if (asset.depreciationMethod === 'STRAIGHT_LINE') {
          deprAmount = asset.monthlyDeprAmount;
        } else {
          // Declining balance: recalc based on current NBV
          const usefulLifeYears = asset.usefulLifeMonths / 12;
          const annualRate = 2 / usefulLifeYears;
          deprAmount = new Decimal(
            Math.round((asset.netBookValue.toNumber() * annualRate) / 12),
          );
        }

        // Don't depreciate below residual value
        const maxDepr = asset.netBookValue.sub(asset.residualValue);
        if (maxDepr.lessThanOrEqualTo(0)) continue;
        if (deprAmount.greaterThan(maxDepr)) {
          deprAmount = maxDepr;
        }

        const newAccumulated = asset.accumulatedDepr.add(deprAmount);
        const newNbv = asset.netBookValue.sub(deprAmount);
        const newStatus = newNbv.lessThanOrEqualTo(asset.residualValue) ? 'FULLY_DEPRECIATED' : 'ACTIVE';

        await tx.depreciationSchedule.create({
          data: {
            fixedAssetId: asset.id,
            periodDate: period,
            amount: deprAmount,
            accumulated: newAccumulated,
            netBookValue: newNbv,
            isPosted: true,
          },
        });

        await tx.fixedAsset.update({
          where: { id: asset.id },
          data: {
            accumulatedDepr: newAccumulated,
            netBookValue: newNbv,
            status: newStatus,
          },
        });

        schedules.push({ assetId: asset.id, amount: deprAmount });

        // Dr department expense (TK627/641/642), Cr TK214
        jeLines.push({
          accountId: asset.departmentAccount,
          debitAmount: deprAmount,
          creditAmount: new Decimal(0),
          lineOrder: lineOrder++,
          description: `Depreciation: ${asset.code} - ${asset.name}`,
        });

        totalDeprAmount = totalDeprAmount.add(deprAmount);
      }

      if (totalDeprAmount.isZero()) {
        return { schedules: [], journalEntry: null };
      }

      // Single credit line to TK214
      jeLines.push({
        accountId: '214',
        debitAmount: new Decimal(0),
        creditAmount: totalDeprAmount,
        lineOrder: lineOrder++,
        description: 'Accumulated depreciation',
      });

      const count = await tx.journalEntry.count({
        where: { companyId, fiscalYearId },
      });
      const entryNumber = `JE-${String(count + 1).padStart(6, '0')}`;

      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          fiscalYearId,
          entryNumber,
          postingDate: period,
          description: `Monthly depreciation - ${period.toISOString().slice(0, 7)}`,
          status: 'POSTED',
          entryType: 'STANDARD',
          totalDebit: totalDeprAmount,
          totalCredit: totalDeprAmount,
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          lines: { create: jeLines },
        },
      });

      await tx.accountingTransaction.create({
        data: {
          journalEntryId: journalEntry.id,
          sourceType: 'depreciation',
          sourceId: `batch-${period.toISOString().slice(0, 7)}`,
          description: `Monthly depreciation batch`,
        },
      });

      return { schedules, journalEntry };
    });

    if (result.journalEntry) {
      await this.auditService.create(
        companyId,
        userId,
        'DEPRECIATION',
        'FixedAsset',
        `batch-${period.toISOString().slice(0, 7)}`,
        undefined,
        { assetsProcessed: result.schedules.length },
      );

      this.eventEmitter.emit('journal.posted', {
        companyId,
        journalEntryId: result.journalEntry.id,
        entryNumber: result.journalEntry.entryNumber,
        userId,
      });
    }

    return result;
  }

  async getDepreciationSchedule(companyId: string, assetId: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id: assetId, companyId },
    });
    if (!asset) {
      throw new NotFoundException('Fixed asset not found');
    }

    const schedules = await this.prisma.depreciationSchedule.findMany({
      where: { fixedAssetId: assetId },
      orderBy: { periodDate: 'asc' },
    });

    return { asset, schedules };
  }
}
