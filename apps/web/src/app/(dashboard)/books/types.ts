// ── Accounting Books Types ───────────────────────────────────────────────────

export interface ContraAccount {
  code: string;
  name: string;
  debitAmount?: string | number;
  creditAmount?: string | number;
}

export interface VoucherInfo {
  voucherType: string;
  voucherNumber: string;
  receiptNo: string | null;
  paymentNo: string | null;
  voucherDate: string;
  partyName: string | null;
  description?: string | null;
}

export interface JournalEntryInfo {
  entryNumber: string;
  postingDate: string;
  documentDate?: string | null;
  description: string;
}

export interface JournalEntryLine {
  id: string;
  lineOrder: number;
  accountId: string;
  debitAmount: string | number;
  creditAmount: string | number;
  description?: string;
  sttNkc?: number | null;
  account?: { code: string; name: string };
  journalEntry?: JournalEntryInfo;
  customer?: { code?: string; name: string; taxCode?: string; address?: string } | null;
  vendor?: { code?: string; name: string; taxCode?: string; address?: string } | null;
  contraAccounts?: ContraAccount[];
  runningBalance?: string | number;
  isNegativeBalance?: boolean;
  voucher?: VoucherInfo | null;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  postingDate: string;
  documentDate?: string | null;
  description: string;
  totalDebit: string | number;
  totalCredit: string | number;
  lines: JournalEntryLine[];
  voucher?: {
    voucherType: string;
    voucherNumber: string;
    counterpartyName?: string | null;
    customer?: { name: string; taxCode?: string; address?: string } | null;
    vendor?: { name: string; taxCode?: string; address?: string } | null;
    employee?: { name: string; taxCode?: string; address?: string } | null;
  } | null;
}

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

export interface BalanceInfo {
  debit: string | number;
  credit: string | number;
  balance: string | number;
}

export interface TotalsInfo {
  totalDebit: string | number;
  totalCredit: string | number;
}

export interface ApiBookResponse {
  data: JournalEntry[] | JournalEntryLine[] | unknown[];
  openingBalance?: BalanceInfo;
  closingBalance?: BalanceInfo;
  totals?: TotalsInfo;
}

export interface BookType {
  key: string;
  label: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}
