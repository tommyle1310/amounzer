import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface CreateAccountData {
  code: string;
  name: string;
  nameEn?: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'OFF_BALANCE_SHEET';
  normalBalance: 'DEBIT' | 'CREDIT';
  parentId?: string;
  level?: number;
  isSystem?: boolean;
  description?: string;
}

interface UpdateAccountData {
  name?: string;
  nameEn?: string;
  description?: string;
  parentId?: string;
}

interface AccountFilters {
  accountType?: string;
  isActive?: boolean;
  level?: number;
  parentId?: string;
}

@Injectable()
export class ChartOfAccountsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(companyId: string, data: CreateAccountData, userId?: string) {
    const existing = await this.prisma.ledgerAccount.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (existing) {
      throw new ConflictException(`Account code ${data.code} already exists`);
    }

    if (data.parentId) {
      const parent = await this.prisma.ledgerAccount.findFirst({
        where: { id: data.parentId, companyId },
      });
      if (!parent) {
        throw new NotFoundException('Parent account not found');
      }
    }

    const account = await this.prisma.ledgerAccount.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        nameEn: data.nameEn,
        accountType: data.accountType,
        normalBalance: data.normalBalance,
        parentId: data.parentId,
        level: data.level ?? (data.parentId ? undefined : 1),
        isSystem: data.isSystem ?? false,
        description: data.description,
      },
    });

    if (userId) {
      await this.auditService.create(
        companyId,
        userId,
        'CREATE',
        'LedgerAccount',
        account.id,
        undefined,
        account as unknown as Record<string, unknown>,
      );
    }

    return account;
  }

  async findAll(companyId: string, filters?: AccountFilters) {
    const where: Record<string, unknown> = { companyId };

    if (filters?.accountType) where.accountType = filters.accountType;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.level) where.level = filters.level;
    if (filters?.parentId) where.parentId = filters.parentId;

    return this.prisma.ledgerAccount.findMany({
      where,
      orderBy: { code: 'asc' },
      include: { parent: { select: { id: true, code: true, name: true } } },
    });
  }

  async findTree(companyId: string) {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { companyId, isActive: true },
      orderBy: { code: 'asc' },
    });

    // Build tree structure from flat list
    const accountMap = new Map<string, Record<string, unknown>>();
    const roots: Record<string, unknown>[] = [];

    for (const account of accounts) {
      accountMap.set(account.id, { ...account, children: [] });
    }

    for (const account of accounts) {
      const node = accountMap.get(account.id)!;
      if (account.parentId && accountMap.has(account.parentId)) {
        const parent = accountMap.get(account.parentId)!;
        (parent.children as Record<string, unknown>[]).push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async findOne(companyId: string, id: string) {
    const account = await this.prisma.ledgerAccount.findFirst({
      where: { id, companyId },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true, isActive: true }, orderBy: { code: 'asc' } },
      },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async update(companyId: string, id: string, data: UpdateAccountData, userId?: string) {
    const existing = await this.prisma.ledgerAccount.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    if (existing.isSystem) {
      throw new BadRequestException('Cannot modify system accounts');
    }

    const updated = await this.prisma.ledgerAccount.update({
      where: { id },
      data,
    });

    if (userId) {
      await this.auditService.create(
        companyId,
        userId,
        'UPDATE',
        'LedgerAccount',
        id,
        existing as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
      );
    }

    return updated;
  }

  async deactivate(companyId: string, id: string, userId?: string) {
    const account = await this.prisma.ledgerAccount.findFirst({
      where: { id, companyId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Prevent deactivation if account has posted journal entry lines
    const postedLines = await this.prisma.journalEntryLine.count({
      where: {
        accountId: id,
        journalEntry: { status: 'POSTED' },
      },
    });
    if (postedLines > 0) {
      throw new BadRequestException(
        'Cannot deactivate account with posted transactions',
      );
    }

    const updated = await this.prisma.ledgerAccount.update({
      where: { id },
      data: { isActive: false },
    });

    if (userId) {
      await this.auditService.create(
        companyId,
        userId,
        'DEACTIVATE',
        'LedgerAccount',
        id,
        { isActive: true },
        { isActive: false },
      );
    }

    return updated;
  }

  async delete(companyId: string, id: string, userId?: string) {
    const account = await this.prisma.ledgerAccount.findFirst({
      where: { id, companyId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.isSystem) {
      throw new BadRequestException('Cannot delete system accounts');
    }

    // Prevent deletion if account has any journal entry lines
    const lineCount = await this.prisma.journalEntryLine.count({
      where: { accountId: id },
    });
    if (lineCount > 0) {
      throw new BadRequestException(
        'Cannot delete account with existing journal entry lines',
      );
    }

    // Prevent deletion if account has children
    const childCount = await this.prisma.ledgerAccount.count({
      where: { parentId: id, companyId },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        'Cannot delete account with child accounts. Remove children first.',
      );
    }

    await this.prisma.ledgerAccount.delete({ where: { id } });

    if (userId) {
      await this.auditService.create(
        companyId,
        userId,
        'DELETE',
        'LedgerAccount',
        id,
        account as unknown as Record<string, unknown>,
      );
    }

    return { deleted: true };
  }

  async search(companyId: string, query: string) {
    // Support combined queries like "131fab" or "131 fab" - code prefix + partner/name filter
    // First, try to extract code prefix (numbers at start) and name filter
    const match = query.trim().match(/^(\d+)\s*(.*)$/);
    const codePrefix = match?.[1] ?? query.trim();
    const nameFilter = match?.[2] ?? '';

    // Build base conditions
    const conditions: { OR: object[] } = {
      OR: [
        { code: { startsWith: codePrefix, mode: 'insensitive' } },
        { code: { contains: codePrefix, mode: 'insensitive' } },
        { name: { contains: codePrefix, mode: 'insensitive' } },
        { nameEn: { contains: codePrefix, mode: 'insensitive' } },
      ],
    };

    const accounts = await this.prisma.ledgerAccount.findMany({
      where: {
        companyId,
        isActive: true,
        ...conditions,
      },
      orderBy: { code: 'asc' },
      take: 100, // Get more to filter
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
        accountType: true,
        normalBalance: true,
        partnerAccounts: {
          select: {
            partnerId: true,
            partnerType: true,
          },
        },
      },
    });

    // If there's a name filter, also search partners and filter
    let filtered = accounts;
    if (nameFilter) {
      const lowerFilter = nameFilter.toLowerCase();
      
      // Get partner IDs that match the filter
      const matchingCustomers = await this.prisma.customer.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: nameFilter, mode: 'insensitive' } },
            { code: { contains: nameFilter, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      
      const matchingVendors = await this.prisma.vendor.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: nameFilter, mode: 'insensitive' } },
            { code: { contains: nameFilter, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      
      const matchingPartnerIds = new Set([
        ...matchingCustomers.map(c => c.id),
        ...matchingVendors.map(v => v.id),
      ]);
      
      filtered = accounts.filter(
        (acc) =>
          acc.name.toLowerCase().includes(lowerFilter) ||
          (acc.nameEn && acc.nameEn.toLowerCase().includes(lowerFilter)) ||
          acc.partnerAccounts.some(pa => matchingPartnerIds.has(pa.partnerId)),
      );
    }

    // Prioritize exact prefix matches and limit results
    return filtered
      .sort((a, b) => {
        const aStartsWith = a.code.toLowerCase().startsWith(codePrefix.toLowerCase());
        const bStartsWith = b.code.toLowerCase().startsWith(codePrefix.toLowerCase());
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        return a.code.localeCompare(b.code);
      })
      .slice(0, 50)
      .map(({ partnerAccounts, ...rest }) => rest); // Remove partnerAccounts from response
  }

  async seedChart(companyId: string, standard: 'TT200' | 'TT133' | 'TT99', userId?: string) {
    const existingCount = await this.prisma.ledgerAccount.count({
      where: { companyId },
    });
    if (existingCount > 0) {
      throw new BadRequestException(
        'Chart of accounts already has entries. Seed only works on an empty chart.',
      );
    }

    const accounts = standard === 'TT99' 
      ? this.getTT99Accounts() 
      : standard === 'TT200' 
        ? this.getTT200Accounts() 
        : this.getTT133Accounts();

    // First pass: create all parent (level 1) accounts
    const parentAccounts = accounts.filter((a) => !a.parentCode);
    for (const acct of parentAccounts) {
      await this.prisma.ledgerAccount.create({
        data: {
          companyId,
          code: acct.code,
          name: acct.name,
          nameEn: acct.nameEn,
          accountType: acct.accountType,
          normalBalance: acct.normalBalance,
          level: 1,
          isSystem: true,
          isSpecialReciprocal: 'isSpecialReciprocal' in acct ? Boolean(acct.isSpecialReciprocal) : false,
        },
      });
    }

    // Second pass: create child accounts (level 2+)
    const childAccounts = accounts.filter((a) => a.parentCode);
    for (const acct of childAccounts) {
      const parent = await this.prisma.ledgerAccount.findUnique({
        where: { companyId_code: { companyId, code: acct.parentCode! } },
      });

      await this.prisma.ledgerAccount.create({
        data: {
          companyId,
          code: acct.code,
          name: acct.name,
          nameEn: acct.nameEn,
          accountType: acct.accountType,
          normalBalance: acct.normalBalance,
          parentId: parent?.id,
          level: acct.code.length <= 3 ? 1 : acct.code.length === 4 ? 2 : 3,
          isSystem: true,
          isSpecialReciprocal: 'isSpecialReciprocal' in acct ? Boolean(acct.isSpecialReciprocal) : false,
        },
      });
    }

    if (userId) {
      await this.auditService.create(
        companyId,
        userId,
        'SEED',
        'ChartOfAccounts',
        companyId,
        undefined,
        { standard, accountCount: accounts.length },
      );
    }

    return {
      standard,
      accountsCreated: accounts.length,
    };
  }

  private getTT200Accounts() {
    return [
      // ==========================
      // LOẠI 1 - TÀI SẢN NGẮN HẠN (Current Assets)
      // ==========================
      { code: '111', name: 'Tiền mặt', nameEn: 'Cash on hand', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '1111', name: 'Tiền Việt Nam', nameEn: 'VND cash', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '111' },
      { code: '1112', name: 'Ngoại tệ', nameEn: 'Foreign currency cash', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '111' },
      { code: '1113', name: 'Vàng tiền tệ', nameEn: 'Monetary gold', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '111' },

      { code: '112', name: 'Tiền gửi ngân hàng', nameEn: 'Bank deposits', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '1121', name: 'Tiền Việt Nam', nameEn: 'VND bank deposits', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '112' },
      { code: '1122', name: 'Ngoại tệ', nameEn: 'Foreign currency deposits', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '112' },
      { code: '1123', name: 'Vàng tiền tệ', nameEn: 'Monetary gold deposits', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '112' },

      { code: '113', name: 'Tiền đang chuyển', nameEn: 'Cash in transit', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '121', name: 'Chứng khoán kinh doanh', nameEn: 'Trading securities', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '128', name: 'Đầu tư nắm giữ đến ngày đáo hạn', nameEn: 'Held-to-maturity investments', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '131', name: 'Phải thu của khách hàng', nameEn: 'Accounts receivable', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '133', name: 'Thuế GTGT được khấu trừ', nameEn: 'VAT deductible', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '1331', name: 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ', nameEn: 'VAT deductible on goods/services', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '133' },
      { code: '1332', name: 'Thuế GTGT được khấu trừ của TSCĐ', nameEn: 'VAT deductible on fixed assets', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '133' },

      { code: '136', name: 'Phải thu nội bộ', nameEn: 'Internal receivables', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '138', name: 'Phải thu khác', nameEn: 'Other receivables', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '141', name: 'Tạm ứng', nameEn: 'Advances', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '151', name: 'Hàng mua đang đi đường', nameEn: 'Goods in transit', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '152', name: 'Nguyên liệu, vật liệu', nameEn: 'Raw materials', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '153', name: 'Công cụ, dụng cụ', nameEn: 'Tools and supplies', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '154', name: 'Chi phí sản xuất, kinh doanh dở dang', nameEn: 'Work in progress', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '155', name: 'Thành phẩm', nameEn: 'Finished goods', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '156', name: 'Hàng hóa', nameEn: 'Merchandise', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '1561', name: 'Giá mua hàng hóa', nameEn: 'Purchase cost of merchandise', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '156' },
      { code: '1562', name: 'Chi phí thu mua hàng hóa', nameEn: 'Procurement costs', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '156' },

      { code: '157', name: 'Hàng gửi đi bán', nameEn: 'Goods sent on consignment', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      // ==========================
      // LOẠI 2 - TÀI SẢN DÀI HẠN (Non-current Assets)
      // ==========================
      { code: '211', name: 'Tài sản cố định hữu hình', nameEn: 'Tangible fixed assets', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '2111', name: 'Nhà cửa, vật kiến trúc', nameEn: 'Buildings and structures', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '211' },
      { code: '2112', name: 'Máy móc, thiết bị', nameEn: 'Machinery and equipment', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '211' },
      { code: '2113', name: 'Phương tiện vận tải, truyền dẫn', nameEn: 'Vehicles and transmission', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '211' },
      { code: '2114', name: 'Thiết bị, dụng cụ quản lý', nameEn: 'Office equipment', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '211' },

      { code: '212', name: 'Tài sản cố định thuê tài chính', nameEn: 'Finance lease assets', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '213', name: 'Tài sản cố định vô hình', nameEn: 'Intangible fixed assets', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '214', name: 'Hao mòn tài sản cố định', nameEn: 'Accumulated depreciation', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },
      { code: '2141', name: 'Hao mòn TSCĐ hữu hình', nameEn: 'Depreciation - tangible', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: '214' },
      { code: '2142', name: 'Hao mòn TSCĐ thuê tài chính', nameEn: 'Depreciation - finance lease', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: '214' },
      { code: '2143', name: 'Hao mòn TSCĐ vô hình', nameEn: 'Amortization - intangible', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: '214' },

      { code: '217', name: 'Bất động sản đầu tư', nameEn: 'Investment property', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '221', name: 'Đầu tư vào công ty con', nameEn: 'Investment in subsidiaries', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '222', name: 'Đầu tư vào công ty liên doanh, liên kết', nameEn: 'Investment in JV/associates', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '228', name: 'Đầu tư khác', nameEn: 'Other investments', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '229', name: 'Dự phòng tổn thất tài sản', nameEn: 'Provision for asset impairment', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '241', name: 'Xây dựng cơ bản dở dang', nameEn: 'Construction in progress', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '242', name: 'Chi phí trả trước', nameEn: 'Prepaid expenses', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '243', name: 'Tài sản thuế thu nhập hoãn lại', nameEn: 'Deferred tax assets', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      // ==========================
      // LOẠI 3 - NỢ PHẢI TRẢ (Liabilities)
      // ==========================
      { code: '311', name: 'Vay và nợ thuê tài chính ngắn hạn', nameEn: 'Short-term borrowings', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '315', name: 'Phải trả cho người bán ngắn hạn', nameEn: 'Short-term accounts payable', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '331', name: 'Phải trả người bán', nameEn: 'Accounts payable', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '333', name: 'Thuế và các khoản phải nộp Nhà nước', nameEn: 'Taxes payable', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },
      { code: '3331', name: 'Thuế giá trị gia tăng phải nộp', nameEn: 'VAT payable', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333' },
      { code: '33311', name: 'Thuế GTGT đầu ra', nameEn: 'Output VAT', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '3331' },
      { code: '33312', name: 'Thuế GTGT hàng nhập khẩu', nameEn: 'Import VAT', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '3331' },
      { code: '3332', name: 'Thuế tiêu thụ đặc biệt', nameEn: 'Special consumption tax', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333' },
      { code: '3333', name: 'Thuế xuất, nhập khẩu', nameEn: 'Import/export tax', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333' },
      { code: '3334', name: 'Thuế thu nhập doanh nghiệp', nameEn: 'Corporate income tax', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333' },
      { code: '3335', name: 'Thuế thu nhập cá nhân', nameEn: 'Personal income tax', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333' },
      { code: '3336', name: 'Thuế tài nguyên', nameEn: 'Natural resources tax', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333' },
      { code: '3337', name: 'Thuế nhà đất, tiền thuê đất', nameEn: 'Property tax / Land rent', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333' },
      { code: '3338', name: 'Thuế bảo vệ môi trường và các loại thuế khác', nameEn: 'Environmental tax and others', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333' },
      { code: '3339', name: 'Phí, lệ phí và các khoản phải nộp khác', nameEn: 'Fees and other payables', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333' },

      { code: '334', name: 'Phải trả người lao động', nameEn: 'Payable to employees', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },
      { code: '3341', name: 'Phải trả công nhân viên', nameEn: 'Wages payable', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '334' },
      { code: '3348', name: 'Phải trả người lao động khác', nameEn: 'Other employee payables', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '334' },

      { code: '335', name: 'Chi phí phải trả', nameEn: 'Accrued expenses', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '336', name: 'Phải trả nội bộ', nameEn: 'Internal payables', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '337', name: 'Thanh toán theo tiến độ kế hoạch hợp đồng xây dựng', nameEn: 'Progress billings', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '338', name: 'Phải trả, phải nộp khác', nameEn: 'Other payables', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },
      { code: '3381', name: 'Tài sản thừa chờ giải quyết', nameEn: 'Surplus assets pending resolution', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338' },
      { code: '3382', name: 'Kinh phí công đoàn', nameEn: 'Trade union fees', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338' },
      { code: '3383', name: 'Bảo hiểm xã hội', nameEn: 'Social insurance', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338' },
      { code: '3384', name: 'Bảo hiểm y tế', nameEn: 'Health insurance', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338' },
      { code: '3385', name: 'Phải trả về cổ phần hóa', nameEn: 'Equitization payables', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338' },
      { code: '3386', name: 'Bảo hiểm thất nghiệp', nameEn: 'Unemployment insurance', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338' },
      { code: '3387', name: 'Doanh thu chưa thực hiện', nameEn: 'Unearned revenue', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338' },
      { code: '3388', name: 'Phải trả, phải nộp khác', nameEn: 'Other payables (misc)', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338' },

      { code: '341', name: 'Vay và nợ thuê tài chính dài hạn', nameEn: 'Long-term borrowings', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },
      { code: '3411', name: 'Các khoản đi vay', nameEn: 'Long-term loans', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '341' },
      { code: '3412', name: 'Nợ thuê tài chính', nameEn: 'Finance lease obligations', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '341' },

      { code: '343', name: 'Trái phiếu phát hành', nameEn: 'Bonds payable', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '344', name: 'Nhận ký quỹ, ký cược dài hạn', nameEn: 'Long-term deposits received', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '347', name: 'Thuế thu nhập hoãn lại phải trả', nameEn: 'Deferred tax liabilities', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '352', name: 'Dự phòng phải trả', nameEn: 'Provisions', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '353', name: 'Quỹ khen thưởng, phúc lợi', nameEn: 'Bonus and welfare fund', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '356', name: 'Quỹ phát triển khoa học và công nghệ', nameEn: 'R&D fund', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      // ==========================
      // LOẠI 4 - VỐN CHỦ SỞ HỮU (Equity)
      // ==========================
      { code: '411', name: 'Vốn đầu tư của chủ sở hữu', nameEn: 'Owner equity', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },
      { code: '4111', name: 'Vốn góp của chủ sở hữu', nameEn: 'Contributed capital', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '411' },
      { code: '4112', name: 'Thặng dư vốn cổ phần', nameEn: 'Share premium', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '411' },
      { code: '4113', name: 'Quyền chọn chuyển đổi trái phiếu', nameEn: 'Convertible bond options', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '411' },
      { code: '4118', name: 'Vốn khác', nameEn: 'Other capital', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '411' },

      { code: '412', name: 'Chênh lệch đánh giá lại tài sản', nameEn: 'Asset revaluation differences', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '413', name: 'Chênh lệch tỷ giá hối đoái', nameEn: 'Foreign exchange differences', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '414', name: 'Quỹ đầu tư phát triển', nameEn: 'Development investment fund', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '417', name: 'Quỹ dự phòng tài chính', nameEn: 'Financial reserve fund', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '418', name: 'Các quỹ khác thuộc vốn chủ sở hữu', nameEn: 'Other equity funds', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '419', name: 'Cổ phiếu quỹ', nameEn: 'Treasury shares', accountType: 'EQUITY' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '421', name: 'Lợi nhuận sau thuế chưa phân phối', nameEn: 'Retained earnings', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },
      { code: '4211', name: 'Lợi nhuận chưa phân phối năm trước', nameEn: 'Prior year retained earnings', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '421' },
      { code: '4212', name: 'Lợi nhuận chưa phân phối năm nay', nameEn: 'Current year retained earnings', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '421' },

      // ==========================
      // LOẠI 5 - DOANH THU (Revenue)
      // ==========================
      { code: '511', name: 'Doanh thu bán hàng và cung cấp dịch vụ', nameEn: 'Revenue from goods and services', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },
      { code: '5111', name: 'Doanh thu bán hàng hóa', nameEn: 'Revenue from goods', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: '511' },
      { code: '5112', name: 'Doanh thu bán các thành phẩm', nameEn: 'Revenue from finished goods', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: '511' },
      { code: '5113', name: 'Doanh thu cung cấp dịch vụ', nameEn: 'Revenue from services', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: '511' },

      { code: '515', name: 'Doanh thu hoạt động tài chính', nameEn: 'Financial income', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      { code: '521', name: 'Các khoản giảm trừ doanh thu', nameEn: 'Revenue deductions', accountType: 'REVENUE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '5211', name: 'Chiết khấu thương mại', nameEn: 'Trade discounts', accountType: 'REVENUE' as const, normalBalance: 'DEBIT' as const, parentCode: '521' },
      { code: '5212', name: 'Hàng bán bị trả lại', nameEn: 'Sales returns', accountType: 'REVENUE' as const, normalBalance: 'DEBIT' as const, parentCode: '521' },
      { code: '5213', name: 'Giảm giá hàng bán', nameEn: 'Sales allowances', accountType: 'REVENUE' as const, normalBalance: 'DEBIT' as const, parentCode: '521' },

      // ==========================
      // LOẠI 6 - CHI PHÍ SẢN XUẤT KINH DOANH (Cost of Operations)
      // ==========================
      { code: '621', name: 'Chi phí nguyên liệu, vật liệu trực tiếp', nameEn: 'Direct material costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '622', name: 'Chi phí nhân công trực tiếp', nameEn: 'Direct labor costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '623', name: 'Chi phí sử dụng máy thi công', nameEn: 'Construction machine costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '627', name: 'Chi phí sản xuất chung', nameEn: 'Manufacturing overhead', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '6271', name: 'Chi phí nhân viên phân xưởng', nameEn: 'Factory staff costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '627' },
      { code: '6272', name: 'Chi phí vật liệu', nameEn: 'Material costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '627' },
      { code: '6273', name: 'Chi phí dụng cụ sản xuất', nameEn: 'Production tools costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '627' },
      { code: '6274', name: 'Chi phí khấu hao TSCĐ', nameEn: 'Depreciation costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '627' },
      { code: '6277', name: 'Chi phí dịch vụ mua ngoài', nameEn: 'Outsourced services', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '627' },
      { code: '6278', name: 'Chi phí bằng tiền khác', nameEn: 'Other cash expenses', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '627' },

      { code: '631', name: 'Giá thành sản xuất', nameEn: 'Cost of production', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '632', name: 'Giá vốn hàng bán', nameEn: 'Cost of goods sold', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '635', name: 'Chi phí tài chính', nameEn: 'Financial expenses', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '641', name: 'Chi phí bán hàng', nameEn: 'Selling expenses', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '642', name: 'Chi phí quản lý doanh nghiệp', nameEn: 'General and admin expenses', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      // ==========================
      // LOẠI 7 - THU NHẬP KHÁC (Other Income)
      // ==========================
      { code: '711', name: 'Thu nhập khác', nameEn: 'Other income', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      // ==========================
      // LOẠI 8 - CHI PHÍ KHÁC (Other Expenses)
      // ==========================
      { code: '811', name: 'Chi phí khác', nameEn: 'Other expenses', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },

      { code: '821', name: 'Chi phí thuế thu nhập doanh nghiệp', nameEn: 'Corporate income tax expense', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '8211', name: 'Chi phí thuế TNDN hiện hành', nameEn: 'Current CIT expense', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '821' },
      { code: '8212', name: 'Chi phí thuế TNDN hoãn lại', nameEn: 'Deferred CIT expense', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '821' },

      // ==========================
      // LOẠI 9 - XÁC ĐỊNH KẾT QUẢ (Income Summary)
      // ==========================
      { code: '911', name: 'Xác định kết quả kinh doanh', nameEn: 'Income summary', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined },

      // ==========================
      // TÀI KHOẢN NGOÀI BẢNG (Off-balance sheet)
      // ==========================
      { code: '001', name: 'Tài sản thuê ngoài', nameEn: 'Leased assets', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '002', name: 'Vật tư, hàng hóa nhận giữ hộ, nhận gia công', nameEn: 'Materials held in trust', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '003', name: 'Hàng hóa nhận bán hộ, nhận ký gửi, ký cược', nameEn: 'Consignment goods received', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '004', name: 'Nợ khó đòi đã xử lý', nameEn: 'Bad debts written off', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '007', name: 'Ngoại tệ các loại', nameEn: 'Foreign currencies', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '008', name: 'Dự toán chi sự nghiệp, dự án', nameEn: 'Budget appropriations', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
      { code: '009', name: 'Nguồn vốn khấu hao TSCĐ', nameEn: 'Depreciation fund source', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined },
    ];
  }

  private getTT133Accounts() {
    // TT133 is a simplified chart for small/medium enterprises
    // It uses same codes but fewer sub-accounts. Seed a subset.
    return this.getTT200Accounts().filter((a) => {
      // Keep all level-1 (3-digit) accounts plus key sub-accounts
      if (a.code.length <= 3) return true;
      // Keep essential sub-accounts
      const essentialCodes = [
        '1111', '1112', '1121', '1561',
        '2111', '2141', '2143',
        '3331', '3334', '3335',
        '3341', '3383', '3384', '3386',
        '4111', '4211', '4212',
        '5111', '5113',
        '8211', '8212',
      ];
      return essentialCodes.includes(a.code);
    });
  }

  // ============================================================================
  // TT99/2025 COMPLIANCE - Updated Chart of Accounts
  // ============================================================================

  /**
   * Suggest accounts based on prefix/fuzzy search with debounce support
   * Called via API with 300ms debounce on frontend
   */
  async suggestAccounts(companyId: string, query: string, limit = 20) {
    if (!query || query.length < 1) {
      return [];
    }

    // Combine prefix search with fuzzy search on code and name
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { code: { startsWith: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { nameEn: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: [
        { code: 'asc' },
      ],
      take: limit,
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
        accountType: true,
        normalBalance: true,
        isSpecialReciprocal: true,
        parentId: true,
      },
    });

    // Prioritize exact prefix matches
    return accounts.sort((a, b) => {
      const aStartsWith = a.code.toLowerCase().startsWith(query.toLowerCase());
      const bStartsWith = b.code.toLowerCase().startsWith(query.toLowerCase());
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.code.localeCompare(b.code);
    });
  }

  /**
   * Create a sub-account linked to a partner (customer/vendor)
   * Per TT99, enterprises can create detailed sub-accounts freely
   */
  async createSubAccountForPartner(
    companyId: string,
    parentAccountCode: string,
    partnerCode: string,
    partnerName: string,
    partnerType: 'customer' | 'vendor',
    partnerId: string,
    userId?: string,
  ) {
    const parentAccount = await this.prisma.ledgerAccount.findUnique({
      where: { companyId_code: { companyId, code: parentAccountCode } },
    });

    if (!parentAccount) {
      throw new NotFoundException(`Parent account ${parentAccountCode} not found`);
    }

    // Generate sub-account code: [parentCode]-[partnerCode] or [parentCode][partnerCode]
    const subAccountCode = `${parentAccountCode}-${partnerCode}`;

    // Check if already exists
    const existing = await this.prisma.ledgerAccount.findUnique({
      where: { companyId_code: { companyId, code: subAccountCode } },
    });

    if (existing) {
      return existing;
    }

    // Create sub-account (using transaction to also create partner link)
    const result = await this.prisma.$transaction(async (tx) => {
      const subAccount = await tx.ledgerAccount.create({
        data: {
          companyId,
          code: subAccountCode,
          name: `${parentAccount.name} - ${partnerName}`,
          nameEn: parentAccount.nameEn ? `${parentAccount.nameEn} - ${partnerName}` : undefined,
          accountType: parentAccount.accountType,
          normalBalance: parentAccount.normalBalance,
          parentId: parentAccount.id,
          level: parentAccount.level + 1,
          isSystem: false,
          isSpecialReciprocal: parentAccount.isSpecialReciprocal,
        },
      });

      // Create partner-account link
      await tx.partnerAccount.create({
        data: {
          accountId: subAccount.id,
          partnerId,
          partnerType,
        },
      });

      return subAccount;
    });

    if (userId) {
      await this.auditService.create(
        companyId,
        userId,
        'CREATE',
        'LedgerAccount',
        result.id,
        undefined,
        { ...result, source: 'auto-partner-subaccount' } as unknown as Record<string, unknown>,
      );
    }

    return result;
  }

  /**
   * Get all sub-accounts for a specific partner
   */
  async getPartnerSubAccounts(companyId: string, partnerId: string, partnerType: 'customer' | 'vendor') {
    const links = await this.prisma.partnerAccount.findMany({
      where: { partnerId, partnerType },
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            accountType: true,
            normalBalance: true,
            parentId: true,
          },
        },
      },
    });

    return links.map((link) => link.account);
  }

  /**
   * Get TT99/2025 Chart of Accounts
   * Updated names per Circular 99/2025/TT-BTC effective from 01/01/2026
   */
  private getTT99Accounts() {
    return [
      // ==========================
      // LOẠI 1 - TÀI SẢN NGẮN HẠN (Current Assets)
      // ==========================
      { code: '111', name: 'Tiền mặt', nameEn: 'Cash on hand', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '1111', name: 'Tiền Việt Nam', nameEn: 'VND cash', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '111', isSpecialReciprocal: false },
      { code: '1112', name: 'Ngoại tệ', nameEn: 'Foreign currency cash', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '111', isSpecialReciprocal: false },
      { code: '1113', name: 'Vàng tiền tệ', nameEn: 'Monetary gold', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '111', isSpecialReciprocal: false },

      // TT99: "Tiền gửi ngân hàng" renamed to "Tiền gửi không kỳ hạn"
      { code: '112', name: 'Tiền gửi không kỳ hạn', nameEn: 'Demand deposits', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: true },
      { code: '1121', name: 'Tiền Việt Nam', nameEn: 'VND demand deposits', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '112', isSpecialReciprocal: true },
      { code: '1122', name: 'Ngoại tệ', nameEn: 'Foreign currency demand deposits', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '112', isSpecialReciprocal: true },
      { code: '1123', name: 'Vàng tiền tệ', nameEn: 'Monetary gold deposits', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '112', isSpecialReciprocal: true },

      { code: '113', name: 'Tiền đang chuyển', nameEn: 'Cash in transit', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '121', name: 'Chứng khoán kinh doanh', nameEn: 'Trading securities', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      // TT99: Renamed from "Đầu tư nắm giữ đến ngày đáo hạn" - now includes term deposits
      { code: '128', name: 'Đầu tư nắm giữ đến ngày đáo hạn', nameEn: 'Held-to-maturity investments', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '1281', name: 'Tiền gửi có kỳ hạn', nameEn: 'Term deposits', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '128', isSpecialReciprocal: false },
      { code: '1288', name: 'Các khoản đầu tư khác nắm giữ đến ngày đáo hạn', nameEn: 'Other HTM investments', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '128', isSpecialReciprocal: false },

      // TT99: Dual-nature account - track both AR (debit) and advances received (credit)
      { code: '131', name: 'Phải thu của khách hàng', nameEn: 'Accounts receivable', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: true },

      { code: '133', name: 'Thuế GTGT được khấu trừ', nameEn: 'VAT deductible', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '1331', name: 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ', nameEn: 'VAT deductible on goods/services', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '133', isSpecialReciprocal: false },
      { code: '1332', name: 'Thuế GTGT được khấu trừ của TSCĐ', nameEn: 'VAT deductible on fixed assets', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '133', isSpecialReciprocal: false },

      { code: '136', name: 'Phải thu nội bộ', nameEn: 'Internal receivables', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '138', name: 'Phải thu khác', nameEn: 'Other receivables', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '141', name: 'Tạm ứng', nameEn: 'Advances', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      // TT99: New account for biological assets (short-term)
      { code: '150', name: 'Tài sản sinh học ngắn hạn', nameEn: 'Short-term biological assets', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '151', name: 'Hàng mua đang đi đường', nameEn: 'Goods in transit', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '152', name: 'Nguyên liệu, vật liệu', nameEn: 'Raw materials', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '153', name: 'Công cụ, dụng cụ', nameEn: 'Tools and supplies', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '154', name: 'Chi phí sản xuất, kinh doanh dở dang', nameEn: 'Work in progress', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '155', name: 'Thành phẩm', nameEn: 'Finished goods', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '156', name: 'Hàng hóa', nameEn: 'Merchandise', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '1561', name: 'Giá mua hàng hóa', nameEn: 'Purchase cost of merchandise', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '156', isSpecialReciprocal: false },
      { code: '1562', name: 'Chi phí thu mua hàng hóa', nameEn: 'Procurement costs', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '156', isSpecialReciprocal: false },

      { code: '157', name: 'Hàng gửi đi bán', nameEn: 'Goods sent on consignment', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      // ==========================
      // LOẠI 2 - TÀI SẢN DÀI HẠN (Non-current Assets)
      // ==========================
      { code: '211', name: 'Tài sản cố định hữu hình', nameEn: 'Tangible fixed assets', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '2111', name: 'Nhà cửa, vật kiến trúc', nameEn: 'Buildings and structures', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '211', isSpecialReciprocal: false },
      { code: '2112', name: 'Máy móc, thiết bị', nameEn: 'Machinery and equipment', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '211', isSpecialReciprocal: false },
      { code: '2113', name: 'Phương tiện vận tải, truyền dẫn', nameEn: 'Vehicles and transmission', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '211', isSpecialReciprocal: false },
      { code: '2114', name: 'Thiết bị, dụng cụ quản lý', nameEn: 'Office equipment', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '211', isSpecialReciprocal: false },

      { code: '212', name: 'Tài sản cố định thuê tài chính', nameEn: 'Finance lease assets', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '213', name: 'Tài sản cố định vô hình', nameEn: 'Intangible fixed assets', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '214', name: 'Hao mòn tài sản cố định', nameEn: 'Accumulated depreciation', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '2141', name: 'Hao mòn TSCĐ hữu hình', nameEn: 'Depreciation - tangible', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: '214', isSpecialReciprocal: false },
      { code: '2142', name: 'Hao mòn TSCĐ thuê tài chính', nameEn: 'Depreciation - finance lease', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: '214', isSpecialReciprocal: false },
      { code: '2143', name: 'Hao mòn TSCĐ vô hình', nameEn: 'Amortization - intangible', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: '214', isSpecialReciprocal: false },

      { code: '217', name: 'Bất động sản đầu tư', nameEn: 'Investment property', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '221', name: 'Đầu tư vào công ty con', nameEn: 'Investment in subsidiaries', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '222', name: 'Đầu tư vào công ty liên doanh, liên kết', nameEn: 'Investment in JV/associates', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '228', name: 'Đầu tư khác', nameEn: 'Other investments', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      // TT99: Renamed and reorganized provision accounts
      { code: '229', name: 'Dự phòng tổn thất tài sản', nameEn: 'Provision for asset impairment', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '2291', name: 'Dự phòng giảm giá chứng khoán kinh doanh', nameEn: 'Provision for trading securities', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: '229', isSpecialReciprocal: false },
      { code: '2292', name: 'Dự phòng tổn thất đầu tư vào đơn vị khác', nameEn: 'Provision for investments', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: '229', isSpecialReciprocal: false },
      { code: '2293', name: 'Dự phòng phải thu khó đòi', nameEn: 'Provision for doubtful debts', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: '229', isSpecialReciprocal: false },
      { code: '2294', name: 'Dự phòng giảm giá hàng tồn kho', nameEn: 'Provision for inventory decline', accountType: 'ASSET' as const, normalBalance: 'CREDIT' as const, parentCode: '229', isSpecialReciprocal: false },

      // TT99: New account for long-term biological assets
      { code: '230', name: 'Tài sản sinh học dài hạn', nameEn: 'Long-term biological assets', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '241', name: 'Xây dựng cơ bản dở dang', nameEn: 'Construction in progress', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '242', name: 'Chi phí trả trước', nameEn: 'Prepaid expenses', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '243', name: 'Tài sản thuế thu nhập hoãn lại', nameEn: 'Deferred tax assets', accountType: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      // ==========================
      // LOẠI 3 - NỢ PHẢI TRẢ (Liabilities)
      // ==========================
      { code: '311', name: 'Vay và nợ thuê tài chính ngắn hạn', nameEn: 'Short-term borrowings', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      // TT99: Dual-nature account - track both AP (credit) and advances to suppliers (debit)
      { code: '331', name: 'Phải trả người bán', nameEn: 'Accounts payable', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: true },

      { code: '333', name: 'Thuế và các khoản phải nộp Nhà nước', nameEn: 'Taxes payable', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '3331', name: 'Thuế giá trị gia tăng phải nộp', nameEn: 'VAT payable', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333', isSpecialReciprocal: false },
      { code: '33311', name: 'Thuế GTGT đầu ra', nameEn: 'Output VAT', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '3331', isSpecialReciprocal: false },
      { code: '33312', name: 'Thuế GTGT hàng nhập khẩu', nameEn: 'Import VAT', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '3331', isSpecialReciprocal: false },
      { code: '3332', name: 'Thuế tiêu thụ đặc biệt', nameEn: 'Special consumption tax', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333', isSpecialReciprocal: false },
      { code: '3333', name: 'Thuế xuất, nhập khẩu', nameEn: 'Import/export tax', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333', isSpecialReciprocal: false },
      { code: '3334', name: 'Thuế thu nhập doanh nghiệp', nameEn: 'Corporate income tax', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333', isSpecialReciprocal: false },
      { code: '3335', name: 'Thuế thu nhập cá nhân', nameEn: 'Personal income tax', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333', isSpecialReciprocal: false },
      { code: '3336', name: 'Thuế tài nguyên', nameEn: 'Natural resources tax', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333', isSpecialReciprocal: false },
      { code: '3337', name: 'Thuế nhà đất, tiền thuê đất', nameEn: 'Property tax / Land rent', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333', isSpecialReciprocal: false },
      { code: '3338', name: 'Thuế bảo vệ môi trường và các loại thuế khác', nameEn: 'Environmental tax and others', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333', isSpecialReciprocal: false },
      { code: '3339', name: 'Phí, lệ phí và các khoản phải nộp khác', nameEn: 'Fees and other payables', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '333', isSpecialReciprocal: false },

      { code: '334', name: 'Phải trả người lao động', nameEn: 'Payable to employees', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '3341', name: 'Phải trả công nhân viên', nameEn: 'Wages payable', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '334', isSpecialReciprocal: false },
      { code: '3348', name: 'Phải trả người lao động khác', nameEn: 'Other employee payables', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '334', isSpecialReciprocal: false },

      { code: '335', name: 'Chi phí phải trả', nameEn: 'Accrued expenses', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '336', name: 'Phải trả nội bộ', nameEn: 'Internal payables', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '337', name: 'Thanh toán theo tiến độ kế hoạch hợp đồng xây dựng', nameEn: 'Progress billings', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '338', name: 'Phải trả, phải nộp khác', nameEn: 'Other payables', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '3381', name: 'Tài sản thừa chờ giải quyết', nameEn: 'Surplus assets pending resolution', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338', isSpecialReciprocal: false },
      { code: '3382', name: 'Kinh phí công đoàn', nameEn: 'Trade union fees', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338', isSpecialReciprocal: false },
      { code: '3383', name: 'Bảo hiểm xã hội', nameEn: 'Social insurance', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338', isSpecialReciprocal: false },
      { code: '3384', name: 'Bảo hiểm y tế', nameEn: 'Health insurance', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338', isSpecialReciprocal: false },
      { code: '3385', name: 'Phải trả về cổ phần hóa', nameEn: 'Equitization payables', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338', isSpecialReciprocal: false },
      { code: '3386', name: 'Bảo hiểm thất nghiệp', nameEn: 'Unemployment insurance', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338', isSpecialReciprocal: false },
      { code: '3387', name: 'Doanh thu chưa thực hiện', nameEn: 'Unearned revenue', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338', isSpecialReciprocal: false },
      { code: '3388', name: 'Phải trả, phải nộp khác', nameEn: 'Other payables (misc)', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '338', isSpecialReciprocal: false },

      { code: '341', name: 'Vay và nợ thuê tài chính dài hạn', nameEn: 'Long-term borrowings', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '3411', name: 'Các khoản đi vay', nameEn: 'Long-term loans', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '341', isSpecialReciprocal: false },
      { code: '3412', name: 'Nợ thuê tài chính', nameEn: 'Finance lease obligations', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '341', isSpecialReciprocal: false },

      { code: '343', name: 'Trái phiếu phát hành', nameEn: 'Bonds payable', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '344', name: 'Nhận ký quỹ, ký cược dài hạn', nameEn: 'Long-term deposits received', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '347', name: 'Thuế thu nhập hoãn lại phải trả', nameEn: 'Deferred tax liabilities', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '352', name: 'Dự phòng phải trả', nameEn: 'Provisions', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '353', name: 'Quỹ khen thưởng, phúc lợi', nameEn: 'Bonus and welfare fund', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '356', name: 'Quỹ phát triển khoa học và công nghệ', nameEn: 'R&D fund', accountType: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      // ==========================
      // LOẠI 4 - VỐN CHỦ SỞ HỮU (Equity)
      // ==========================
      { code: '411', name: 'Vốn đầu tư của chủ sở hữu', nameEn: 'Owner equity', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '4111', name: 'Vốn góp của chủ sở hữu', nameEn: 'Contributed capital', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '411', isSpecialReciprocal: false },
      { code: '4112', name: 'Thặng dư vốn cổ phần', nameEn: 'Share premium', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '411', isSpecialReciprocal: false },
      { code: '4113', name: 'Quyền chọn chuyển đổi trái phiếu', nameEn: 'Convertible bond options', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '411', isSpecialReciprocal: false },
      { code: '4118', name: 'Vốn khác', nameEn: 'Other capital', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '411', isSpecialReciprocal: false },

      { code: '412', name: 'Chênh lệch đánh giá lại tài sản', nameEn: 'Asset revaluation differences', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '413', name: 'Chênh lệch tỷ giá hối đoái', nameEn: 'Foreign exchange differences', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '414', name: 'Quỹ đầu tư phát triển', nameEn: 'Development investment fund', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '417', name: 'Quỹ dự phòng tài chính', nameEn: 'Financial reserve fund', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '418', name: 'Các quỹ khác thuộc vốn chủ sở hữu', nameEn: 'Other equity funds', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '419', name: 'Cổ phiếu quỹ', nameEn: 'Treasury shares', accountType: 'EQUITY' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '421', name: 'Lợi nhuận sau thuế chưa phân phối', nameEn: 'Retained earnings', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '4211', name: 'Lợi nhuận chưa phân phối năm trước', nameEn: 'Prior year retained earnings', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '421', isSpecialReciprocal: false },
      { code: '4212', name: 'Lợi nhuận chưa phân phối năm nay', nameEn: 'Current year retained earnings', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '421', isSpecialReciprocal: false },

      // ==========================
      // LOẠI 5 - DOANH THU (Revenue)
      // ==========================
      { code: '511', name: 'Doanh thu bán hàng và cung cấp dịch vụ', nameEn: 'Revenue from goods and services', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '5111', name: 'Doanh thu bán hàng hóa', nameEn: 'Revenue from goods', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: '511', isSpecialReciprocal: false },
      { code: '5112', name: 'Doanh thu bán các thành phẩm', nameEn: 'Revenue from finished goods', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: '511', isSpecialReciprocal: false },
      { code: '5113', name: 'Doanh thu cung cấp dịch vụ', nameEn: 'Revenue from services', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: '511', isSpecialReciprocal: false },
      // TT99: BDSDT (investment property) revenue now part of 511
      { code: '5117', name: 'Doanh thu kinh doanh bất động sản đầu tư', nameEn: 'Revenue from investment property', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: '511', isSpecialReciprocal: false },

      { code: '515', name: 'Doanh thu hoạt động tài chính', nameEn: 'Financial income', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      // TT99: Revenue deductions now debit to 511 directly, but 521 still exists for detailed tracking
      { code: '521', name: 'Các khoản giảm trừ doanh thu', nameEn: 'Revenue deductions', accountType: 'REVENUE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '5211', name: 'Chiết khấu thương mại', nameEn: 'Trade discounts', accountType: 'REVENUE' as const, normalBalance: 'DEBIT' as const, parentCode: '521', isSpecialReciprocal: false },
      { code: '5212', name: 'Hàng bán bị trả lại', nameEn: 'Sales returns', accountType: 'REVENUE' as const, normalBalance: 'DEBIT' as const, parentCode: '521', isSpecialReciprocal: false },
      { code: '5213', name: 'Giảm giá hàng bán', nameEn: 'Sales allowances', accountType: 'REVENUE' as const, normalBalance: 'DEBIT' as const, parentCode: '521', isSpecialReciprocal: false },

      // ==========================
      // LOẠI 6 - CHI PHÍ SẢN XUẤT KINH DOANH (Cost of Operations)
      // ==========================
      { code: '621', name: 'Chi phí nguyên liệu, vật liệu trực tiếp', nameEn: 'Direct material costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '622', name: 'Chi phí nhân công trực tiếp', nameEn: 'Direct labor costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '623', name: 'Chi phí sử dụng máy thi công', nameEn: 'Construction machine costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '627', name: 'Chi phí sản xuất chung', nameEn: 'Manufacturing overhead', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '6271', name: 'Chi phí nhân viên phân xưởng', nameEn: 'Factory staff costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '627', isSpecialReciprocal: false },
      { code: '6272', name: 'Chi phí vật liệu', nameEn: 'Material costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '627', isSpecialReciprocal: false },
      { code: '6273', name: 'Chi phí dụng cụ sản xuất', nameEn: 'Production tools costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '627', isSpecialReciprocal: false },
      { code: '6274', name: 'Chi phí khấu hao TSCĐ', nameEn: 'Depreciation costs', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '627', isSpecialReciprocal: false },
      { code: '6277', name: 'Chi phí dịch vụ mua ngoài', nameEn: 'Outsourced services', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '627', isSpecialReciprocal: false },
      { code: '6278', name: 'Chi phí bằng tiền khác', nameEn: 'Other cash expenses', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '627', isSpecialReciprocal: false },

      { code: '631', name: 'Giá thành sản xuất', nameEn: 'Cost of production', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '632', name: 'Giá vốn hàng bán', nameEn: 'Cost of goods sold', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '635', name: 'Chi phí tài chính', nameEn: 'Financial expenses', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '641', name: 'Chi phí bán hàng', nameEn: 'Selling expenses', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '642', name: 'Chi phí quản lý doanh nghiệp', nameEn: 'General and admin expenses', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      // ==========================
      // LOẠI 7 - THU NHẬP KHÁC (Other Income)
      // ==========================
      { code: '711', name: 'Thu nhập khác', nameEn: 'Other income', accountType: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      // ==========================
      // LOẠI 8 - CHI PHÍ KHÁC (Other Expenses)
      // ==========================
      { code: '811', name: 'Chi phí khác', nameEn: 'Other expenses', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      { code: '821', name: 'Chi phí thuế thu nhập doanh nghiệp', nameEn: 'Corporate income tax expense', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '8211', name: 'Chi phí thuế TNDN hiện hành', nameEn: 'Current CIT expense', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '821', isSpecialReciprocal: false },
      { code: '8212', name: 'Chi phí thuế TNDN hoãn lại', nameEn: 'Deferred CIT expense', accountType: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '821', isSpecialReciprocal: false },

      // ==========================
      // LOẠI 9 - XÁC ĐỊNH KẾT QUẢ (Income Summary)
      // ==========================
      { code: '911', name: 'Xác định kết quả kinh doanh', nameEn: 'Income summary', accountType: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: undefined, isSpecialReciprocal: false },

      // ==========================
      // TÀI KHOẢN NGOÀI BẢNG (Off-balance sheet)
      // ==========================
      { code: '001', name: 'Tài sản thuê ngoài', nameEn: 'Leased assets', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '002', name: 'Vật tư, hàng hóa nhận giữ hộ, nhận gia công', nameEn: 'Materials held in trust', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '003', name: 'Hàng hóa nhận bán hộ, nhận ký gửi, ký cược', nameEn: 'Consignment goods received', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '004', name: 'Nợ khó đòi đã xử lý', nameEn: 'Bad debts written off', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '007', name: 'Ngoại tệ các loại', nameEn: 'Foreign currencies', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '008', name: 'Dự toán chi sự nghiệp, dự án', nameEn: 'Budget appropriations', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
      { code: '009', name: 'Nguồn vốn khấu hao TSCĐ', nameEn: 'Depreciation fund source', accountType: 'OFF_BALANCE_SHEET' as const, normalBalance: 'DEBIT' as const, parentCode: undefined, isSpecialReciprocal: false },
    ];
  }
}
