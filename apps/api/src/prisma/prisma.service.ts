import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@amounzer/db';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Set the current company context for RLS policies.
   * Call this at the start of each request via middleware.
   */
  async setTenantContext(companyId: string) {
    await this.$executeRawUnsafe(
      `SET LOCAL app.current_company_id = '${companyId.replace(/'/g, "''")}'`,
    );
  }
}
