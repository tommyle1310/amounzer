import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as ExcelJS from 'exceljs';

const ENTITY_CONFIGS: Record<string, {
  columns: { header: string; key: string; width: number; type?: 'number' | 'date' | 'string' }[];
  requiredFields: string[];
}> = {
  customer: {
    columns: [
      { header: 'Mã khách hàng', key: 'code', width: 15 },
      { header: 'Tên khách hàng', key: 'name', width: 30 },
      { header: 'Mã số thuế', key: 'taxCode', width: 15 },
      { header: 'Địa chỉ', key: 'address', width: 40 },
      { header: 'Điện thoại', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Người liên hệ', key: 'contactPerson', width: 25 },
      { header: 'Số tài khoản NH', key: 'bankAccount', width: 20 },
      { header: 'Tên ngân hàng', key: 'bankName', width: 25 },
    ],
    requiredFields: ['code', 'name'],
  },
  vendor: {
    columns: [
      { header: 'Mã nhà cung cấp', key: 'code', width: 15 },
      { header: 'Tên nhà cung cấp', key: 'name', width: 30 },
      { header: 'Mã số thuế', key: 'taxCode', width: 15 },
      { header: 'Địa chỉ', key: 'address', width: 40 },
      { header: 'Điện thoại', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Người liên hệ', key: 'contactPerson', width: 25 },
      { header: 'Số tài khoản NH', key: 'bankAccount', width: 20 },
      { header: 'Tên ngân hàng', key: 'bankName', width: 25 },
    ],
    requiredFields: ['code', 'name'],
  },
  account: {
    columns: [
      { header: 'Mã tài khoản', key: 'code', width: 15 },
      { header: 'Tên tài khoản', key: 'name', width: 30 },
      { header: 'Tên tiếng Anh', key: 'nameEn', width: 30 },
      { header: 'Loại TK', key: 'accountType', width: 15 },
      { header: 'Số dư thường', key: 'normalBalance', width: 15 },
      { header: 'TK cha', key: 'parentCode', width: 15 },
      { header: 'Cấp', key: 'level', width: 8, type: 'number' },
      { header: 'Mô tả', key: 'description', width: 40 },
    ],
    requiredFields: ['code', 'name', 'accountType', 'normalBalance'],
  },
  employee: {
    columns: [
      { header: 'Mã nhân viên', key: 'code', width: 15 },
      { header: 'Họ tên', key: 'name', width: 25 },
      { header: 'Phòng ban', key: 'department', width: 20 },
      { header: 'Chức vụ', key: 'position', width: 20 },
      { header: 'Lương cơ bản', key: 'baseSalary', width: 18, type: 'number' },
      { header: 'Lương BHXH', key: 'socialInsuranceSalary', width: 18, type: 'number' },
      { header: 'Số tài khoản NH', key: 'bankAccount', width: 20 },
      { header: 'Tên ngân hàng', key: 'bankName', width: 25 },
      { header: 'Mã số thuế', key: 'taxCode', width: 15 },
    ],
    requiredFields: ['code', 'name', 'baseSalary', 'socialInsuranceSalary'],
  },
  inventoryItem: {
    columns: [
      { header: 'Mã vật tư', key: 'code', width: 15 },
      { header: 'Tên vật tư', key: 'name', width: 30 },
      { header: 'Đơn vị', key: 'unit', width: 10 },
      { header: 'TK kho', key: 'accountCode', width: 12 },
      { header: 'PP tính giá', key: 'valuationMethod', width: 20 },
    ],
    requiredFields: ['code', 'name', 'unit'],
  },
  fixedAsset: {
    columns: [
      { header: 'Mã TSCĐ', key: 'code', width: 15 },
      { header: 'Tên TSCĐ', key: 'name', width: 30 },
      { header: 'Loại', key: 'category', width: 20 },
      { header: 'Ngày mua', key: 'acquisitionDate', width: 15, type: 'date' },
      { header: 'Nguyên giá', key: 'acquisitionCost', width: 18, type: 'number' },
      { header: 'Thời gian KH (tháng)', key: 'usefulLifeMonths', width: 20, type: 'number' },
      { header: 'PP khấu hao', key: 'depreciationMethod', width: 20 },
      { header: 'Giá trị còn lại', key: 'residualValue', width: 18, type: 'number' },
      { header: 'TK chi phí', key: 'departmentAccount', width: 15 },
    ],
    requiredFields: ['code', 'name', 'category', 'acquisitionDate', 'acquisitionCost', 'usefulLifeMonths'],
  },
};

interface ImportRow {
  rowNumber: number;
  data: Record<string, unknown>;
  errors: string[];
  isValid: boolean;
}

@Injectable()
export class ImportExportService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async importExcel(
    companyId: string,
    entityType: string,
    fileBuffer: Buffer,
    mappingConfig?: Record<string, string>,
  ): Promise<{ totalRows: number; validRows: ImportRow[]; invalidRows: ImportRow[]; preview: ImportRow[] }> {
    const config = ENTITY_CONFIGS[entityType];
    if (!config) throw new BadRequestException(`Unsupported entity type: ${entityType}`);

    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await workbook.xlsx.load(fileBuffer as any);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('No worksheet found in file');

    // Read headers from first row
    const headerRow = worksheet.getRow(1);
    const headerMap: Record<number, string> = {};
    headerRow.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
      const headerValue = String(cell.value ?? '').trim();
      // Try to match header to column key
      if (mappingConfig) {
        const mappedKey = mappingConfig[headerValue];
        if (mappedKey) {
          headerMap[colNumber] = mappedKey;
          return;
        }
      }
      // Auto-match by column header
      const matchedCol = config.columns.find(
        (c) => c.header === headerValue || c.key === headerValue,
      );
      if (matchedCol) headerMap[colNumber] = matchedCol.key;
    });

    const validRows: ImportRow[] = [];
    const invalidRows: ImportRow[] = [];

    worksheet.eachRow((row: ExcelJS.Row, rowNumber: number) => {
      if (rowNumber === 1) return; // Skip header

      const data: Record<string, unknown> = {};
      row.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
        const key = headerMap[colNumber];
        if (key) {
          data[key] = cell.value;
        }
      });

      const errors: string[] = [];
      for (const field of config.requiredFields) {
        if (!data[field] || String(data[field]).trim() === '') {
          const col = config.columns.find((c) => c.key === field);
          errors.push(`${col?.header ?? field} is required`);
        }
      }

      // Validate number fields
      for (const col of config.columns) {
        if (col.type === 'number' && data[col.key] !== undefined && data[col.key] !== null) {
          const val = Number(data[col.key]);
          if (isNaN(val)) errors.push(`${col.header} must be a number`);
        }
      }

      const importRow: ImportRow = { rowNumber, data, errors, isValid: errors.length === 0 };
      if (importRow.isValid) {
        validRows.push(importRow);
      } else {
        invalidRows.push(importRow);
      }
    });

    return {
      totalRows: validRows.length + invalidRows.length,
      validRows,
      invalidRows,
      preview: [...validRows.slice(0, 5), ...invalidRows.slice(0, 5)],
    };
  }

  async confirmImport(
    companyId: string,
    entityType: string,
    validatedRows: ImportRow[],
    userId: string,
  ): Promise<{ imported: number; errors: { row: number; error: string }[] }> {
    const errors: { row: number; error: string }[] = [];
    let imported = 0;

    for (const row of validatedRows) {
      if (!row.isValid) continue;

      try {
        switch (entityType) {
          case 'customer':
            await this.prisma.customer.create({
              data: { companyId, ...row.data as { code: string; name: string; [key: string]: unknown } },
            });
            break;
          case 'vendor':
            await this.prisma.vendor.create({
              data: { companyId, ...row.data as { code: string; name: string; [key: string]: unknown } },
            });
            break;
          case 'employee':
            await this.prisma.employee.create({
              data: {
                companyId,
                code: String(row.data.code),
                name: String(row.data.name),
                department: row.data.department ? String(row.data.department) : undefined,
                position: row.data.position ? String(row.data.position) : undefined,
                baseSalary: Number(row.data.baseSalary),
                socialInsuranceSalary: Number(row.data.socialInsuranceSalary),
                bankAccount: row.data.bankAccount ? String(row.data.bankAccount) : undefined,
                bankName: row.data.bankName ? String(row.data.bankName) : undefined,
                taxCode: row.data.taxCode ? String(row.data.taxCode) : undefined,
              },
            });
            break;
          case 'inventoryItem':
            await this.prisma.inventoryItem.create({
              data: {
                companyId,
                code: String(row.data.code),
                name: String(row.data.name),
                unit: String(row.data.unit),
                accountCode: row.data.accountCode ? String(row.data.accountCode) : '152',
                valuationMethod: (row.data.valuationMethod as 'WEIGHTED_AVERAGE' | 'FIFO' | 'SPECIFIC') ?? 'WEIGHTED_AVERAGE',
              },
            });
            break;
          case 'fixedAsset': {
            const cost = Number(row.data.acquisitionCost);
            const months = Number(row.data.usefulLifeMonths);
            const residual = Number(row.data.residualValue ?? 0);
            const monthlyDepr = Math.round((cost - residual) / months);
            await this.prisma.fixedAsset.create({
              data: {
                companyId,
                code: String(row.data.code),
                name: String(row.data.name),
                category: String(row.data.category),
                acquisitionDate: new Date(row.data.acquisitionDate as string),
                acquisitionCost: cost,
                usefulLifeMonths: months,
                residualValue: residual,
                netBookValue: cost,
                monthlyDeprAmount: monthlyDepr,
                depreciationMethod: (row.data.depreciationMethod as 'STRAIGHT_LINE' | 'DECLINING_BALANCE') ?? 'STRAIGHT_LINE',
                departmentAccount: row.data.departmentAccount ? String(row.data.departmentAccount) : '627',
              },
            });
            break;
          }
          default:
            throw new Error(`Import not implemented for: ${entityType}`);
        }
        imported++;
      } catch (err) {
        errors.push({ row: row.rowNumber, error: (err as Error).message });
      }
    }

    await this.auditService.create(
      companyId,
      userId,
      'IMPORT',
      entityType,
      'bulk',
      undefined,
      { imported, errors: errors.length, entityType },
    );

    return { imported, errors };
  }

  async exportExcel(
    data: Record<string, unknown>[],
    columns: { header: string; key: string; width?: number }[],
    title: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Amounzer Accounting';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(title);

    // Set columns
    worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width ?? 15,
    }));

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    // Add data rows with VND formatting (no decimals, dot separator)
    for (const row of data) {
      const addedRow = worksheet.addRow(row);
      addedRow.eachCell((cell: ExcelJS.Cell) => {
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportPdf(htmlContent: string, options?: { title?: string; landscape?: boolean }): Promise<Buffer> {
    // Simplified HTML-to-PDF using a basic HTML template
    // For production, integrate with a PDF library like pdf-lib or wkhtmltopdf
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${options?.title ?? 'Report'}</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12px; margin: 20mm; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #000; padding: 4px 8px; text-align: left; }
    th { background-color: #f0f0f0; font-weight: bold; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    h1 { text-align: center; font-size: 16px; }
    h2 { text-align: center; font-size: 14px; }
    .currency { text-align: right; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    // Return HTML as buffer—downstream can pass to wkhtmltopdf, Chrome headless, etc.
    return Buffer.from(fullHtml, 'utf-8');
  }

  async getImportTemplate(entityType: string): Promise<Buffer> {
    const config = ENTITY_CONFIGS[entityType];
    if (!config) throw new BadRequestException(`Unsupported entity type: ${entityType}`);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');

    worksheet.columns = config.columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width,
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    // Mark required fields with red header text
    for (const field of config.requiredFields) {
      const colIdx = config.columns.findIndex((c) => c.key === field) + 1;
      if (colIdx > 0) {
        headerRow.getCell(colIdx).font = { bold: true, color: { argb: 'FFFF0000' } };
      }
    }

    // Add sample row
    const sampleData: Record<string, unknown> = {};
    for (const col of config.columns) {
      sampleData[col.key] = col.type === 'number' ? 0 : col.type === 'date' ? '2025-01-01' : '';
    }
    worksheet.addRow(sampleData);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  exportHtkkXml(data: {
    taxCode: string;
    period: string;
    records: { invoiceNumber: string; invoiceDate: string; taxableAmount: number; vatAmount: number; vendorTaxCode?: string; vendorName?: string }[];
  }): string {
    const rows = data.records
      .map(
        (r, idx) => `
    <HoaDon>
      <STT>${idx + 1}</STT>
      <SoHoaDon>${this.escapeXml(r.invoiceNumber)}</SoHoaDon>
      <NgayHoaDon>${r.invoiceDate}</NgayHoaDon>
      <MaSoThueNCC>${this.escapeXml(r.vendorTaxCode ?? '')}</MaSoThueNCC>
      <TenNCC>${this.escapeXml(r.vendorName ?? '')}</TenNCC>
      <GiaTriHHDV>${r.taxableAmount}</GiaTriHHDV>
      <ThueGTGT>${r.vatAmount}</ThueGTGT>
    </HoaDon>`,
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<HSoThueDTu>
  <HSoKhaiThue>
    <TTChung>
      <MaSoThue>${this.escapeXml(data.taxCode)}</MaSoThue>
      <KyKKhai>${this.escapeXml(data.period)}</KyKKhai>
    </TTChung>
    <CTieuKeToan>${rows}
    </CTieuKeToan>
  </HSoKhaiThue>
</HSoThueDTu>`;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
