export const ROLES = ['ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER'] as const;
export type RoleType = (typeof ROLES)[number];

export const VOUCHER_TYPES = ['PT', 'PC', 'BDN', 'BCN', 'BT', 'CTGS'] as const;
export type VoucherTypeCode = (typeof VOUCHER_TYPES)[number];

export const VOUCHER_TYPE_LABELS: Record<VoucherTypeCode, { vi: string; en: string }> = {
  PT: { vi: 'Phiếu thu', en: 'Cash Receipt' },
  PC: { vi: 'Phiếu chi', en: 'Cash Payment' },
  BDN: { vi: 'Giấy báo nợ', en: 'Bank Debit Note' },
  BCN: { vi: 'Giấy báo có', en: 'Bank Credit Note' },
  BT: { vi: 'Chuyển khoản', en: 'Bank Transfer' },
  CTGS: { vi: 'Chứng từ ghi sổ', en: 'Journal Voucher' },
};

export const ACCOUNTING_STANDARDS = ['TT200', 'TT133'] as const;
export type AccountingStandardType = (typeof ACCOUNTING_STANDARDS)[number];

export const ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
  'OFF_BALANCE_SHEET',
] as const;
export type AccountTypeCode = (typeof ACCOUNT_TYPES)[number];

export const JOURNAL_ENTRY_STATUSES = ['DRAFT', 'POSTED', 'REVERSAL'] as const;
export const JOURNAL_ENTRY_TYPES = [
  'STANDARD',
  'ADJUSTMENT',
  'CLOSING',
  'REVERSAL',
  'OPENING',
] as const;

export const VAT_RATES = [0, 5, 8, 10] as const;

// Vietnamese insurance rates (employee portion)
export const INSURANCE_RATES = {
  BHXH: 0.08, // Social insurance 8%
  BHYT: 0.015, // Health insurance 1.5%
  BHTN: 0.01, // Unemployment insurance 1%
} as const;

// Employer portion
export const EMPLOYER_INSURANCE_RATES = {
  BHXH: 0.175, // 17.5%
  BHYT: 0.03, // 3%
  BHTN: 0.01, // 1%
} as const;
