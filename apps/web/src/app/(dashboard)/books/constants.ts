import type { BookType } from './types';

// ── Book Type Registry ───────────────────────────────────────────────────────

export const BOOK_TYPES: readonly BookType[] = [
  { key: 'general-journal', label: 'Nhật ký chung' },
  { key: 'general-ledger', label: 'Sổ Cái' },
  { key: 'cash', label: 'Sổ quỹ tiền mặt' },
  { key: 'bank', label: 'Sổ tiền gửi NH' },
  { key: 'ar-detail', label: 'Sổ chi tiết phải thu' },
  { key: 'ap-detail', label: 'Sổ chi tiết phải trả' },
  { key: 'inventory', label: 'Sổ kho' },
  { key: 'fixed-asset', label: 'Sổ TSCĐ' },
  { key: 'payroll', label: 'Sổ lương' },
  { key: 'advance', label: 'Sổ tạm ứng' },
  { key: 'vat-input', label: 'Sổ VAT đầu vào' },
  { key: 'vat-output', label: 'Sổ VAT đầu ra' },
  { key: 'purchase-journal', label: 'NK Mua' },
  { key: 'sales-journal', label: 'NK Bán' },
] as const;

// ── API Path Mapping ─────────────────────────────────────────────────────────

export const BOOK_API_MAP: Record<string, string> = {
  'general-journal': 'general-journal',
  'general-ledger': 'general-ledger',
  cash: 'cash-book',
  bank: 'bank-book',
  'ar-detail': 'customer-ledger',
  'ap-detail': 'vendor-ledger',
  inventory: 'inventory-ledger',
  'fixed-asset': 'fixed-asset-ledger',
  payroll: 'payroll-ledger',
  advance: 'advance-ledger',
  'vat-input': 'vat-input-ledger',
  'vat-output': 'vat-output-ledger',
  'purchase-journal': 'purchase-journal',
  'sales-journal': 'sales-journal',
};

// ── Column Width Presets ─────────────────────────────────────────────────────

export const COLUMN_WIDTHS = {
  generalJournal: [48, 90, 90, 110, 220, 40, 96, 110, 110],
  generalLedger: [56, 90, 90, 110, 200, 80, 110, 110, 110],
  cashBook: [90, 90, 100, 100, 160, 120, 80, 100, 100, 110],
  genericLedger: [90, 100, 200, 80, 120, 100, 100, 110],
  purchaseSalesJournal: [80, 90, 180, 90, 150, 110, 150, 100, 100],
} as const;
