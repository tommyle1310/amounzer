import { z } from 'zod';

// ============================================================================
// Auth schemas
// ============================================================================

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const twoFactorVerifySchema = z.object({
  code: z.string().length(6),
});

// ============================================================================
// Company schemas
// ============================================================================

export const createCompanySchema = z.object({
  name: z.string().min(1).max(255),
  taxCode: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  legalRepresentative: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
  accountingStandard: z.enum(['TT200', 'TT133']).default('TT200'),
});

export const createFiscalYearSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

// ============================================================================
// Chart of Accounts schemas
// ============================================================================

export const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  nameEn: z.string().max(255).optional(),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'OFF_BALANCE_SHEET']),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  parentId: z.string().optional(),
  description: z.string().max(500).optional(),
});

export const updateAccountSchema = createAccountSchema.partial().omit({ code: true });

// ============================================================================
// Journal Entry schemas
// ============================================================================

export const journalEntryLineSchema = z.object({
  accountId: z.string().min(1),
  description: z.string().max(500).optional(),
  debitAmount: z.number().min(0).default(0),
  creditAmount: z.number().min(0).default(0),
  customerId: z.string().optional(),
  vendorId: z.string().optional(),
  inventoryItemId: z.string().optional(),
  employeeId: z.string().optional(),
});

export const createJournalEntrySchema = z.object({
  postingDate: z.string().datetime(),
  description: z.string().min(1).max(500),
  entryType: z
    .enum(['STANDARD', 'ADJUSTMENT', 'CLOSING', 'REVERSAL', 'OPENING'])
    .default('STANDARD'),
  lines: z.array(journalEntryLineSchema).min(2),
  customFieldValues: z.record(z.unknown()).optional(),
});

// ============================================================================
// Voucher schemas
// ============================================================================

export const createVoucherSchema = z.object({
  voucherType: z.enum(['PT', 'PC', 'BDN', 'BCN', 'BT']),
  date: z.string().datetime(),
  counterpartyName: z.string().max(255).optional(),
  counterpartyId: z.string().optional(),
  counterpartyType: z.enum(['customer', 'vendor']).optional(),
  description: z.string().min(1).max(500),
  totalAmount: z.number().min(0),
  lines: z.array(journalEntryLineSchema).min(1),
  customFieldValues: z.record(z.unknown()).optional(),
});

// ============================================================================
// Customer / Vendor schemas
// ============================================================================

export const createCustomerSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  taxCode: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  contactPerson: z.string().max(255).optional(),
  bankAccount: z.string().max(50).optional(),
  bankName: z.string().max(255).optional(),
  customFieldValues: z.record(z.unknown()).optional(),
});

export const createVendorSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  taxCode: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  contactPerson: z.string().max(255).optional(),
  bankAccount: z.string().max(50).optional(),
  bankName: z.string().max(255).optional(),
  customFieldValues: z.record(z.unknown()).optional(),
});

// ============================================================================
// Inventory schemas
// ============================================================================

export const createInventoryItemSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  unit: z.string().min(1).max(20),
  accountCode: z.string().default('152'),
  valuationMethod: z.enum(['WEIGHTED_AVERAGE', 'FIFO', 'SPECIFIC']).default('WEIGHTED_AVERAGE'),
  customFieldValues: z.record(z.unknown()).optional(),
});

export const createInventoryMovementSchema = z.object({
  inventoryItemId: z.string().min(1),
  warehouseId: z.string().min(1),
  movementType: z.enum(['RECEIPT', 'ISSUE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT']),
  date: z.string().datetime(),
  quantity: z.number().positive(),
  unitCost: z.number().min(0),
  reference: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
});

// ============================================================================
// Fixed Asset schemas
// ============================================================================

export const createFixedAssetSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  acquisitionDate: z.string().datetime(),
  acquisitionCost: z.number().positive(),
  usefulLifeMonths: z.number().int().positive(),
  depreciationMethod: z.enum(['STRAIGHT_LINE', 'DECLINING_BALANCE']).default('STRAIGHT_LINE'),
  residualValue: z.number().min(0).default(0),
  departmentAccount: z.string().default('627'),
  customFieldValues: z.record(z.unknown()).optional(),
});

// ============================================================================
// Payroll schemas
// ============================================================================

export const createEmployeeSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  department: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  baseSalary: z.number().min(0),
  socialInsuranceSalary: z.number().min(0),
  bankAccount: z.string().max(50).optional(),
  bankName: z.string().max(255).optional(),
  taxCode: z.string().max(20).optional(),
  customFieldValues: z.record(z.unknown()).optional(),
});

export const createPayrollSchema = z.object({
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2000).max(2100),
  name: z.string().min(1).max(255),
});

// ============================================================================
// VAT schemas
// ============================================================================

export const createVatRecordSchema = z.object({
  direction: z.enum(['INPUT', 'OUTPUT']),
  invoiceNumber: z.string().min(1).max(50),
  invoiceDate: z.string().datetime(),
  customerId: z.string().optional(),
  vendorId: z.string().optional(),
  taxableAmount: z.number().min(0),
  vatRate: z.number().min(0).max(100),
  description: z.string().max(500).optional(),
});

// ============================================================================
// Bad Debt Provision schemas
// ============================================================================

export const createBadDebtProvisionSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
  provisionDate: z.string().datetime(),
});

// ============================================================================
// Custom Field schemas
// ============================================================================

export const createCustomFieldSchema = z.object({
  entityType: z.enum([
    'voucher',
    'customer',
    'vendor',
    'fixedAsset',
    'inventoryItem',
    'journalEntry',
    'payrollRecord',
  ]),
  fieldName: z.string().min(1).max(100),
  fieldLabel: z.string().min(1).max(255),
  fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX', 'MULTI_SELECT']),
  options: z.array(z.string()).optional(),
  validation: z
    .object({
      required: z.boolean().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ============================================================================
// Dynamic Report schemas
// ============================================================================

export const createReportTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  config: z.object({
    dimensions: z.array(z.string()),
    measures: z.array(
      z.object({
        field: z.string(),
        aggregation: z.enum(['SUM', 'COUNT', 'AVG', 'MIN', 'MAX']),
        label: z.string().optional(),
      }),
    ),
    filters: z
      .array(
        z.object({
          field: z.string(),
          operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'between', 'like']),
          value: z.unknown(),
        }),
      )
      .optional(),
    sorting: z
      .array(
        z.object({
          field: z.string(),
          direction: z.enum(['asc', 'desc']),
        }),
      )
      .optional(),
    visualization: z.enum(['table', 'bar', 'line', 'pie', 'area']).optional(),
  }),
  isShared: z.boolean().default(false),
});

// ============================================================================
// Pagination / Query schemas
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
