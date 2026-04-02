import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface CreateCustomFieldData {
  entityType: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKBOX' | 'MULTI_SELECT';
  options?: unknown[];
  validation?: Record<string, unknown>;
  sortOrder?: number;
}

interface UpdateCustomFieldData {
  fieldLabel?: string;
  fieldType?: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKBOX' | 'MULTI_SELECT';
  options?: unknown[];
  validation?: Record<string, unknown>;
  sortOrder?: number;
}

@Injectable()
export class CustomFieldService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(companyId: string, data: CreateCustomFieldData, userId: string) {
    const existing = await this.prisma.customFieldDefinition.findUnique({
      where: {
        companyId_entityType_fieldName: {
          companyId,
          entityType: data.entityType,
          fieldName: data.fieldName,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Custom field "${data.fieldName}" already exists for entity type "${data.entityType}"`,
      );
    }

    const field = await this.prisma.customFieldDefinition.create({
      data: {
        companyId,
        entityType: data.entityType,
        fieldName: data.fieldName,
        fieldLabel: data.fieldLabel,
        fieldType: data.fieldType,
        options: (data.options ?? undefined) as Prisma.InputJsonValue | undefined,
        validation: (data.validation ?? undefined) as Prisma.InputJsonValue | undefined,
        sortOrder: data.sortOrder ?? 0,
      },
    });

    await this.auditService.create(
      companyId,
      userId,
      'CREATE',
      'CustomFieldDefinition',
      field.id,
      undefined,
      field as unknown as Record<string, unknown>,
    );

    return field;
  }

  async findAll(companyId: string, entityType?: string) {
    const where: Record<string, unknown> = { companyId };
    if (entityType) where.entityType = entityType;

    return this.prisma.customFieldDefinition.findMany({
      where,
      orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async findOne(companyId: string, id: string) {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: { id, companyId },
    });
    if (!field) {
      throw new NotFoundException('Custom field not found');
    }
    return field;
  }

  async update(
    companyId: string,
    id: string,
    data: UpdateCustomFieldData,
    userId: string,
  ) {
    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Custom field not found');
    }

    const updated = await this.prisma.customFieldDefinition.update({
      where: { id },
      data: {
        fieldLabel: data.fieldLabel,
        fieldType: data.fieldType,
        options: (data.options ?? undefined) as Prisma.InputJsonValue | undefined,
        validation: (data.validation ?? undefined) as Prisma.InputJsonValue | undefined,
        sortOrder: data.sortOrder,
      },
    });

    await this.auditService.create(
      companyId,
      userId,
      'UPDATE',
      'CustomFieldDefinition',
      id,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );

    return updated;
  }

  async deactivate(companyId: string, id: string, userId: string) {
    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Custom field not found');
    }

    const updated = await this.prisma.customFieldDefinition.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.create(
      companyId,
      userId,
      'DEACTIVATE',
      'CustomFieldDefinition',
      id,
      { isActive: true },
      { isActive: false },
    );

    return updated;
  }

  async reorder(
    companyId: string,
    entityType: string,
    fieldIds: string[],
    userId: string,
  ) {
    const fields = await this.prisma.customFieldDefinition.findMany({
      where: { companyId, entityType },
    });

    const fieldMap = new Map(fields.map((f) => [f.id, f]));
    for (const fid of fieldIds) {
      if (!fieldMap.has(fid)) {
        throw new BadRequestException(`Field ${fid} not found for this entity type`);
      }
    }

    await this.prisma.$transaction(
      fieldIds.map((fid, index) =>
        this.prisma.customFieldDefinition.update({
          where: { id: fid },
          data: { sortOrder: index },
        }),
      ),
    );

    await this.auditService.create(
      companyId,
      userId,
      'REORDER',
      'CustomFieldDefinition',
      entityType,
      undefined,
      { entityType, fieldIds },
    );

    return this.prisma.customFieldDefinition.findMany({
      where: { companyId, entityType },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
