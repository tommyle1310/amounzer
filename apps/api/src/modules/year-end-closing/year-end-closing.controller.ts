import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { YearEndClosingService } from './year-end-closing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';

@Controller('year-end-closing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class YearEndClosingController {
  constructor(private yearEndClosingService: YearEndClosingService) {}

  @Get('checklist/:fiscalYearId')
  @Roles('ADMIN')
  async getPreClosingChecklist(
    @Request() req: { companyId: string },
    @Param('fiscalYearId') fiscalYearId: string,
  ) {
    return this.yearEndClosingService.getPreClosingChecklist(req.companyId, fiscalYearId);
  }

  @Post('execute/:fiscalYearId')
  @Roles('ADMIN')
  async executeClosing(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('fiscalYearId') fiscalYearId: string,
  ) {
    return this.yearEndClosingService.executeClosing(
      req.companyId,
      fiscalYearId,
      req.user.sub,
    );
  }

  @Post('periods/:id/lock')
  @Roles('ADMIN')
  async lockPeriod(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.yearEndClosingService.lockPeriod(req.companyId, id, req.user.sub);
  }

  @Post('periods/:id/unlock')
  @Roles('ADMIN')
  async unlockPeriod(
    @Request() req: { companyId: string; user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.yearEndClosingService.unlockPeriod(req.companyId, id, req.user.sub);
  }

  @Post('carry-forward')
  @Roles('ADMIN')
  async carryForwardBalances(
    @Request() req: { companyId: string; user: { sub: string } },
    @Body() body: { fromFiscalYearId: string; toFiscalYearId: string },
  ) {
    return this.yearEndClosingService.carryForwardBalances(
      req.companyId,
      body.fromFiscalYearId,
      body.toFiscalYearId,
      req.user.sub,
    );
  }
}
