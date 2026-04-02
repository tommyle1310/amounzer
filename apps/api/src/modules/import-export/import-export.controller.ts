import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ImportExportService } from './import-export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';

@Controller('import-export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportExportController {
  constructor(private importExportService: ImportExportService) {}

  @Post('import/:entityType')
  @Roles('ADMIN', 'ACCOUNTANT')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importExcel(
    @Request() req: { companyId: string },
    @Param('entityType') entityType: string,
    @UploadedFile() file: { buffer: Buffer },
    @Body('mappingConfig') mappingConfig?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const mapping = mappingConfig ? JSON.parse(mappingConfig) : undefined;
    return this.importExportService.importExcel(req.companyId, entityType, file.buffer, mapping);
  }

  @Post('import/:entityType/confirm')
  @Roles('ADMIN', 'ACCOUNTANT')
  async confirmImport(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('entityType') entityType: string,
    @Body('validatedRows') validatedRows: unknown[],
  ) {
    return this.importExportService.confirmImport(
      req.companyId,
      entityType,
      validatedRows as Parameters<typeof this.importExportService.confirmImport>[2],
      req.user.sub,
    );
  }

  @Post('export/excel')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async exportExcel(
    @Body() body: {
      data: Record<string, unknown>[];
      columns: { header: string; key: string; width?: number }[];
      title: string;
    },
    @Res() res: Response,
  ) {
    const buffer = await this.importExportService.exportExcel(body.data, body.columns, body.title);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(body.title)}.xlsx"`);
    res.send(buffer);
  }

  @Post('export/pdf')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER')
  async exportPdf(
    @Body() body: { htmlContent: string; title?: string; landscape?: boolean },
    @Res() res: Response,
  ) {
    const buffer = await this.importExportService.exportPdf(body.htmlContent, {
      title: body.title,
      landscape: body.landscape,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(body.title ?? 'report')}.html"`);
    res.send(buffer);
  }

  @Get('templates/:entityType')
  @Roles('ADMIN', 'ACCOUNTANT')
  async getImportTemplate(
    @Param('entityType') entityType: string,
    @Res() res: Response,
  ) {
    const buffer = await this.importExportService.getImportTemplate(entityType);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="template_${entityType}.xlsx"`);
    res.send(buffer);
  }

  @Post('export/htkk-xml')
  @Roles('ADMIN', 'ACCOUNTANT')
  async exportHtkkXml(
    @Body() body: {
      taxCode: string;
      period: string;
      records: { invoiceNumber: string; invoiceDate: string; taxableAmount: number; vatAmount: number; vendorTaxCode?: string; vendorName?: string }[];
    },
    @Res() res: Response,
  ) {
    const xml = this.importExportService.exportHtkkXml(body);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="htkk_${body.period}.xml"`);
    res.send(xml);
  }
}
