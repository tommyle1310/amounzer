'use client';

import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatVND, formatDateVN } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, AlertTriangle, CheckCircle2 } from 'lucide-react';

// ── Raw API types ────────────────────────────────────────────────────────────

interface JournalEntryLine {
  id: string;
  lineOrder: number;
  accountId: string;
  debitAmount: string | number;
  creditAmount: string | number;
  description?: string;
  sttNkc?: number | null;
  account?: { code: string; name: string };
  journalEntry?: {
    entryNumber: string;
    postingDate: string;
    documentDate?: string | null;
    description: string;
  };
  customer?: { name: string } | null;
  vendor?: { name: string } | null;
  contraAccounts?: Array<{ code: string; name: string; debitAmount?: string | number; creditAmount?: string | number }>;
  runningBalance?: string | number;
  isNegativeBalance?: boolean;
  voucher?: {
    voucherType: string;
    voucherNumber: string;
    receiptNo: string | null;
    paymentNo: string | null;
    voucherDate: string;
    partyName: string | null;
  } | null;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  postingDate: string;
  documentDate?: string | null;
  description: string;
  totalDebit: string | number;
  totalCredit: string | number;
  lines: JournalEntryLine[];
}

interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface ApiBookResponse {
  data: JournalEntry[] | JournalEntryLine[] | unknown[];
  openingBalance?: { debit: string | number; credit: string | number; balance: string | number };
  closingBalance?: { debit: string | number; credit: string | number; balance: string | number };
  totals?: { totalDebit: string | number; totalCredit: string | number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return { startDate: `${year}-01-01`, endDate: `${year}-${month}-${day}` };
}

function fmtAmt(val: number | undefined | null): string {
  if (val == null || val === 0) return '';
  return formatVND(val);
}

function fmtBal(val: number): string {
  if (val === 0) return '—';
  return (val < 0 ? '-' : '') + formatVND(Math.abs(val));
}

// ── Book type registry ───────────────────────────────────────────────────────

const bookTypes = [
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

const bookApiMap: Record<string, string> = {
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

// ── General Journal Table (S03a-DN) ──────────────────────────────────────────
// Columns per TT200/TT99: STT | Ngày ghi sổ | Ngày CT | Số CT | Diễn giải | Đã ghi SC | TK | Nợ | Có
// NO "Số dư" column — that belongs to Sổ Cái only

function GeneralJournalTable({
  data,
  totals,
}: {
  data: ApiBookResponse;
  totals?: { totalDebit: string | number; totalCredit: string | number };
}) {
  const entries = data.data as JournalEntry[];
  if (!entries || entries.length === 0) {
    return <EmptyState />;
  }

  type JournalRow = {
    rowKey: string;
    stt: number;
    postingDate: string;
    documentDate: string | null | undefined;
    entryNumber: string;
    description: string;
    isPostedToLedger: boolean;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    isFirstLineOfEntry: boolean;
    entryLinesCount: number;
  };

  const rows: JournalRow[] = [];
  let sttCounter = 0;
  for (const je of entries) {
    je.lines.forEach((line, lineIdx) => {
      sttCounter++;
      rows.push({
        rowKey: line.id || `${je.id}-${lineIdx}`,
        stt: sttCounter,
        postingDate: je.postingDate,
        documentDate: je.documentDate,
        entryNumber: je.entryNumber,
        description: line.description || je.description,
        isPostedToLedger: true,
        accountCode: line.account?.code ?? '',
        accountName: line.account?.name ?? '',
        debit: Number(line.debitAmount) || 0,
        credit: Number(line.creditAmount) || 0,
        isFirstLineOfEntry: lineIdx === 0,
        entryLinesCount: je.lines.length,
      });
    });
  }

  const totalDebit = Number(totals?.totalDebit || 0);
  const totalCredit = Number(totals?.totalCredit || 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">STT</TableHead>
            <TableHead>Ngày ghi sổ</TableHead>
            <TableHead>Ngày CT</TableHead>
            <TableHead>Số CT</TableHead>
            <TableHead>Diễn giải</TableHead>
            <TableHead className="w-10 text-center" title="Đã ghi Sổ Cái">✓SC</TableHead>
            <TableHead className="w-24">Số hiệu TK</TableHead>
            <TableHead className="text-right">Nợ (₫)</TableHead>
            <TableHead className="text-right">Có (₫)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.rowKey}
              className={row.isFirstLineOfEntry && row.entryLinesCount > 1 ? 'border-t-2 border-muted' : ''}
            >
              <TableCell className="text-center text-xs text-muted-foreground">{row.stt}</TableCell>
              <TableCell className="text-xs">{formatDateVN(row.postingDate)}</TableCell>
              <TableCell className="text-xs">
                {row.documentDate ? formatDateVN(row.documentDate) : formatDateVN(row.postingDate)}
              </TableCell>
              <TableCell className="font-medium text-xs">{row.entryNumber}</TableCell>
              <TableCell className="max-w-[220px] truncate text-xs">{row.description}</TableCell>
              <TableCell className="text-center">
                {row.isPostedToLedger && (
                  <CheckCircle2 className="h-3 w-3 text-green-600 mx-auto" />
                )}
              </TableCell>
              <TableCell className="font-mono text-xs" title={row.accountName || undefined}>
                {row.accountCode}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">{fmtAmt(row.debit)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{fmtAmt(row.credit)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t px-4 py-2 bg-muted/30">
        <span className={`text-xs font-semibold flex items-center gap-1 ${balanced ? 'text-green-700' : 'text-red-600'}`}>
          {balanced ? (
            <><CheckCircle2 className="h-3 w-3" /> Cân đối Nợ/Có</>
          ) : (
            <><AlertTriangle className="h-3 w-3" /> Chênh lệch {fmtBal(totalDebit - totalCredit)}</>
          )}
        </span>
        <div className="text-xs font-mono space-x-6">
          <span>Tổng Nợ: <strong>{formatVND(totalDebit)}</strong></span>
          <span>Tổng Có: <strong>{formatVND(totalCredit)}</strong></span>
        </div>
      </div>
    </div>
  );
}

// ── General Ledger Section (S03b-DN) ─────────────────────────────────────────
// Requires account selector; shows opening balance row, running balance, closing balance row

function GeneralLedgerSection({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const { data: accounts } = useQuery<LedgerAccount[]>({
    queryKey: ['chart-of-accounts'],
    queryFn: () => apiClient.get('/chart-of-accounts?isActive=true'),
  });

  const params = new URLSearchParams({ startDate: dateFrom, endDate: dateTo });
  if (selectedAccountId) params.set('accountId', selectedAccountId);

  const { data, isLoading, error } = useQuery<ApiBookResponse>({
    queryKey: ['books', 'general-ledger', dateFrom, dateTo, selectedAccountId],
    queryFn: () => apiClient.get(`/accounting-books/general-ledger?${params.toString()}`),
    enabled: !!selectedAccountId && !!dateFrom && !!dateTo,
  });

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);

  const lines = useMemo(() => {
    if (!data?.data) return [];
    return data.data as JournalEntryLine[];
  }, [data]);

  const openingBal = Number(data?.openingBalance?.balance ?? 0);
  const closingBal = Number(data?.closingBalance?.balance ?? 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-4 pt-4">
        <label className="text-sm font-medium whitespace-nowrap">Tài khoản:</label>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm bg-background w-80"
        >
          <option value="">— Chọn tài khoản để xem sổ cái —</option>
          {(accounts ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
      </div>

      {!selectedAccountId ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          Vui lòng chọn tài khoản để xem Sổ Cái
        </div>
      ) : isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Đang tải...</div>
      ) : error ? (
        <div className="py-8 text-center text-red-500">Lỗi khi tải dữ liệu</div>
      ) : (
        <div>
          {lines.some((l) => l.isNegativeBalance) && (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Cảnh báo số dư âm:</strong> Tài khoản có số dư âm trong kỳ. Kiểm tra lại bút toán đầu kỳ hoặc thứ tự ghi sổ.
              </span>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-center" title="STT dòng Nhật ký chung">STT NKC</TableHead>
                <TableHead>Ngày ghi sổ</TableHead>
                <TableHead>Ngày CT</TableHead>
                <TableHead>Số CT</TableHead>
                <TableHead>Diễn giải</TableHead>
                <TableHead>TK đối ứng</TableHead>
                <TableHead className="text-right">Nợ (₫)</TableHead>
                <TableHead className="text-right">Có (₫)</TableHead>
                <TableHead className="text-right">Số dư (₫)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40 font-medium">
                <TableCell colSpan={8} className="text-xs italic">
                  Số dư đầu kỳ — TK {selectedAccount?.code} {selectedAccount?.name}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{fmtBal(openingBal)}</TableCell>
              </TableRow>

              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted-foreground text-sm">
                    Chưa có chứng từ ghi sổ trong kỳ này
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line) => {
                  const runBal = Number(line.runningBalance ?? 0) || (openingBal + Number(line.debitAmount) - Number(line.creditAmount));
                  const contra = line.contraAccounts?.[0];
                  const je = line.journalEntry;
                  const isNeg = line.isNegativeBalance || runBal < 0;
                  return (
                    <TableRow key={line.id} className={isNeg ? 'bg-red-50 text-red-700' : ''}>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {line.sttNkc ?? ''}
                      </TableCell>
                      <TableCell className="text-xs">{je?.postingDate ? formatDateVN(je.postingDate) : ''}</TableCell>
                      <TableCell className="text-xs">
                        {je?.documentDate ? formatDateVN(je.documentDate) : (je?.postingDate ? formatDateVN(je.postingDate) : '')}
                      </TableCell>
                      <TableCell className="font-medium text-xs">{je?.entryNumber ?? ''}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">
                        {line.description || je?.description || ''}
                      </TableCell>
                      <TableCell className="font-mono text-xs" title={contra?.name || undefined}>
                        {contra ? `${contra.code}` : ''}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtAmt(Number(line.debitAmount))}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtAmt(Number(line.creditAmount))}</TableCell>
                      <TableCell className={`text-right font-mono text-xs font-medium ${isNeg ? 'text-red-600' : ''}`}>
                        {isNeg && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                        {fmtBal(runBal)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}

              <TableRow className="bg-muted/40 font-semibold border-t-2">
                <TableCell colSpan={6} className="text-xs">
                  Tổng cộng & Số dư cuối kỳ
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{fmtAmt(Number(data?.totals?.totalDebit ?? 0))}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmtAmt(Number(data?.totals?.totalCredit ?? 0))}</TableCell>
                <TableCell className="text-right font-mono text-xs font-bold">{fmtBal(closingBal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Cash / Bank Book Table (S07a-DN) ─────────────────────────────────────────
// Columns: Ngày ghi sổ | Ngày CT | Số PT | Số PC | Diễn giải | TK đối ứng | Thu | Chi | Tồn quỹ

function CashBookTable({ data }: { data: ApiBookResponse }) {
  const lines = data.data as JournalEntryLine[];
  if (!lines || lines.length === 0) return <EmptyState />;

  const openingBal = Number(data.openingBalance?.balance ?? 0);
  const hasNegative = lines.some((l) => l.isNegativeBalance || Number(l.runningBalance ?? 0) < 0);

  return (
    <div>
      {hasNegative && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Cảnh báo âm quỹ:</strong> Một hoặc nhiều dòng làm tồn quỹ xuống dưới 0. Kiểm tra lại chứng từ chi.
          </span>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ngày ghi sổ</TableHead>
            <TableHead>Ngày CT</TableHead>
            <TableHead>Số PT</TableHead>
            <TableHead>Số PC</TableHead>
            <TableHead>Diễn giải</TableHead>
            <TableHead>TK đối ứng</TableHead>
            <TableHead className="text-right">Thu (₫)</TableHead>
            <TableHead className="text-right">Chi (₫)</TableHead>
            <TableHead className="text-right">Tồn quỹ (₫)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-muted/40 font-medium">
            <TableCell colSpan={8} className="text-xs italic">Số dư đầu kỳ (TK 111)</TableCell>
            <TableCell className="text-right font-mono text-xs">{fmtBal(openingBal)}</TableCell>
          </TableRow>

          {lines.map((line) => {
            const debit = Number(line.debitAmount) || 0;
            const credit = Number(line.creditAmount) || 0;
            const runBal = Number(line.runningBalance ?? 0);
            const isNeg = line.isNegativeBalance || runBal < 0;
            const contras = line.contraAccounts ?? [];
            const je = line.journalEntry;
            const v = line.voucher;
            const rowSpan = contras.length > 1 ? contras.length : 1;

            return (
              <Fragment key={line.id}>
                <TableRow className={isNeg ? 'bg-red-50 text-red-700' : ''}>
                  <TableCell className="text-xs" rowSpan={rowSpan}>{je?.postingDate ? formatDateVN(je.postingDate) : ''}</TableCell>
                  <TableCell className="text-xs" rowSpan={rowSpan}>
                    {v?.voucherDate
                      ? formatDateVN(v.voucherDate)
                      : (je?.documentDate ? formatDateVN(je.documentDate) : (je?.postingDate ? formatDateVN(je.postingDate) : ''))}
                  </TableCell>
                  <TableCell className="font-mono text-xs" rowSpan={rowSpan}>{v?.receiptNo ?? ''}</TableCell>
                  <TableCell className="font-mono text-xs" rowSpan={rowSpan}>{v?.paymentNo ?? ''}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs" rowSpan={rowSpan}>
                    {line.description || je?.description || ''}
                    {v?.partyName ? <span className="block text-muted-foreground">{v.partyName}</span> : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {contras[0]?.code ?? ''}
                    {contras[0]?.name ? <span className="text-muted-foreground"> — {contras[0].name}</span> : null}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {contras.length > 1 ? fmtAmt(Number(contras[0]?.creditAmount ?? 0)) : fmtAmt(debit)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {contras.length > 1 ? fmtAmt(Number(contras[0]?.debitAmount ?? 0)) : fmtAmt(credit)}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-xs font-medium ${isNeg ? 'text-red-600' : ''}`} rowSpan={rowSpan}>
                    {isNeg && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                    {fmtBal(runBal)}
                  </TableCell>
                </TableRow>
                {contras.slice(1).map((contra, idx) => (
                  <TableRow key={`${line.id}-contra-${idx}`} className={isNeg ? 'bg-red-50 text-red-700' : ''}>
                    <TableCell className="font-mono text-xs">
                      {contra.code}
                      {contra.name ? <span className="text-muted-foreground"> — {contra.name}</span> : null}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtAmt(Number(contra.creditAmount ?? 0))}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtAmt(Number(contra.debitAmount ?? 0))}</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            );
          })}

          <TableRow className="bg-muted/40 font-semibold border-t-2">
            <TableCell colSpan={6} className="text-xs">Tổng cộng & Số dư cuối kỳ</TableCell>
            <TableCell className="text-right font-mono text-xs">{fmtAmt(Number(data.totals?.totalDebit ?? 0))}</TableCell>
            <TableCell className="text-right font-mono text-xs">{fmtAmt(Number(data.totals?.totalCredit ?? 0))}</TableCell>
            <TableCell className="text-right font-mono text-xs font-bold">
              {fmtBal(Number(data.closingBalance?.balance ?? 0))}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div className="mt-6 grid grid-cols-3 gap-4 px-4 pb-6 print:mt-10 text-center text-xs">
        <div className="space-y-8">
          <p className="font-medium">Người lập biểu</p>
          <p className="text-muted-foreground italic">(Ký, họ tên)</p>
        </div>
        <div className="space-y-8">
          <p className="font-medium">Kế toán trưởng</p>
          <p className="text-muted-foreground italic">(Ký, họ tên)</p>
        </div>
        <div className="space-y-8">
          <p className="font-medium">Giám đốc</p>
          <p className="text-muted-foreground italic">(Ký, họ tên, đóng dấu)</p>
        </div>
      </div>
    </div>
  );
}

// ── Generic Ledger Table (for AR/AP/Inventory/etc.) ──────────────────────────

function GenericLedgerTable({ data }: { data: ApiBookResponse }) {
  const lines = data.data as JournalEntryLine[];
  if (!lines || lines.length === 0) return <EmptyState />;

  const openingBal = Number(data.openingBalance?.balance ?? 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ngày</TableHead>
          <TableHead>Số CT</TableHead>
          <TableHead>Diễn giải</TableHead>
          <TableHead>TK đối ứng</TableHead>
          <TableHead>Đối tượng</TableHead>
          <TableHead className="text-right">Nợ (₫)</TableHead>
          <TableHead className="text-right">Có (₫)</TableHead>
          <TableHead className="text-right">Số dư (₫)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="bg-muted/40 font-medium">
          <TableCell colSpan={7} className="text-xs italic">Số dư đầu kỳ</TableCell>
          <TableCell className="text-right font-mono text-xs">{fmtBal(openingBal)}</TableCell>
        </TableRow>
        {lines.map((line) => {
          const debit = Number(line.debitAmount) || 0;
          const credit = Number(line.creditAmount) || 0;
          const runBal = Number(line.runningBalance ?? 0);
          const contra = line.contraAccounts?.[0];
          const je = line.journalEntry;
          return (
            <TableRow key={line.id}>
              <TableCell className="text-xs">{je?.postingDate ? formatDateVN(je.postingDate) : ''}</TableCell>
              <TableCell className="font-medium text-xs">{je?.entryNumber ?? ''}</TableCell>
              <TableCell className="max-w-[200px] truncate text-xs">{line.description || je?.description || ''}</TableCell>
              <TableCell className="font-mono text-xs">{contra?.code ?? line.account?.code ?? ''}</TableCell>
              <TableCell className="text-xs">{line.customer?.name ?? line.vendor?.name ?? ''}</TableCell>
              <TableCell className="text-right font-mono text-xs">{fmtAmt(debit)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{fmtAmt(credit)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{fmtBal(runBal)}</TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-muted/40 font-semibold border-t-2">
          <TableCell colSpan={5} className="text-xs">Tổng cộng & Số dư cuối kỳ</TableCell>
          <TableCell className="text-right font-mono text-xs">{fmtAmt(Number(data.totals?.totalDebit ?? 0))}</TableCell>
          <TableCell className="text-right font-mono text-xs">{fmtAmt(Number(data.totals?.totalCredit ?? 0))}</TableCell>
          <TableCell className="text-right font-mono text-xs font-bold">{fmtBal(Number(data.closingBalance?.balance ?? 0))}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="py-10 text-center text-muted-foreground text-sm">
      Chưa có chứng từ ghi sổ trong kỳ này
    </div>
  );
}

// ── Unified BookTab wrapper ───────────────────────────────────────────────────

function BookTab({
  bookKey,
  dateFrom,
  dateTo,
}: {
  bookKey: string;
  dateFrom: string;
  dateTo: string;
}) {
  if (bookKey === 'general-ledger') {
    return <GeneralLedgerSection dateFrom={dateFrom} dateTo={dateTo} />;
  }

  const apiPath = bookApiMap[bookKey] ?? bookKey;
  const params = new URLSearchParams({ startDate: dateFrom, endDate: dateTo });

  const { data, isLoading, error } = useQuery<ApiBookResponse>({
    queryKey: ['books', bookKey, dateFrom, dateTo],
    queryFn: () => apiClient.get(`/accounting-books/${apiPath}?${params.toString()}`),
    enabled: !!dateFrom && !!dateTo,
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Đang tải...</div>;
  if (error) return <div className="py-8 text-center text-red-500">Lỗi khi tải dữ liệu</div>;
  if (!data) return <EmptyState />;

  if (bookKey === 'general-journal') {
    return <GeneralJournalTable data={data} totals={data.totals} />;
  }

  if (bookKey === 'cash' || bookKey === 'bank') {
    return <CashBookTable data={data} />;
  }

  return <GenericLedgerTable data={data} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BooksPage() {
  const [activeTab, setActiveTab] = useState<string>(bookTypes[0].key);
  const defaultDates = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState<string>(defaultDates.startDate);
  const [dateTo, setDateTo] = useState<string>(defaultDates.endDate);

  function handleExport(format: 'excel' | 'pdf') {
    const params = new URLSearchParams({ format });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1310/api'}/books/${activeTab}/export?${params.toString()}`,
      '_blank',
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sổ sách kế toán</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
            <Download className="mr-1 h-4 w-4" />
            Xuất Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
            <Download className="mr-1 h-4 w-4" />
            Xuất PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Từ ngày:</span>
            <Input
              type="date"
              className="w-40"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Đến ngày:</span>
            <Input
              type="date"
              className="w-40"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto">
            {bookTypes.map((bt) => (
              <TabsTrigger key={bt.key} value={bt.key} className="text-xs">
                {bt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {bookTypes.map((bt) => (
          <TabsContent key={bt.key} value={bt.key}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{bt.label}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <BookTab bookKey={bt.key} dateFrom={dateFrom} dateTo={dateTo} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}