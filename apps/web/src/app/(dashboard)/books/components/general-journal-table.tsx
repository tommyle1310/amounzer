'use client';

import { useState } from 'react';
import { formatVND, formatDateVN } from '@amounzer/shared';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

import type { ApiBookResponse, JournalEntry } from '../types';
import { COLUMN_WIDTHS } from '../constants';
import { fmtAmt, fmtBal } from '../utils';
import { useResizableColumns } from '../hooks/use-resizable-columns';
import { ResizeHandle } from './resize-handle';
import { EmptyState } from './empty-state';

// ── Types ────────────────────────────────────────────────────────────────────

interface GeneralJournalTableProps {
  data: ApiBookResponse;
  totals?: { totalDebit: string | number; totalCredit: string | number };
}

type ViewMode = 'simplified' | 'detailed';

interface DetailedRow {
  rowKey: string;
  stt: number;
  postingDate: string;
  documentDate: string | null | undefined;
  entryNumber: string;
  voucherDescription: string; // Nội dung chứng từ
  lineDescription: string; // Diễn giải tài khoản
  taxCode: string | null; // Mã số thuế
  counterpartyName: string | null;
  isPostedToLedger: boolean;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  isFirstLineOfEntry: boolean;
  entryLinesCount: number;
}

interface SimplifiedRow {
  rowKey: string;
  stt: number;
  voucherNumber: string;
  voucherDate: string;
  counterpartyName: string | null;
  taxCode: string | null;
  description: string; // Nội dung
  debitAccounts: string; // Tiểu khoản Nợ
  creditAccounts: string; // Tiểu khoản Có
  amount: number; // Số tiền
}

// ── Component ────────────────────────────────────────────────────────────────

export function GeneralJournalTable({ data, totals }: GeneralJournalTableProps) {
  const entries = data.data as JournalEntry[];
  const [viewMode, setViewMode] = useState<ViewMode>('detailed');
  const { widths: detailedWidths, startResize: startDetailedResize } = useResizableColumns(COLUMN_WIDTHS.generalJournal);
  const { widths: simplifiedWidths, startResize: startSimplifiedResize } = useResizableColumns(COLUMN_WIDTHS.generalJournalSimplified);

  if (!entries || entries.length === 0) {
    return <EmptyState />;
  }

  const totalDebit = Number(totals?.totalDebit || 0);
  const totalCredit = Number(totals?.totalCredit || 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div>
      {/* View Mode Toggle */}
      <div className="flex justify-end mb-3">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <Button
            type="button"
            variant={viewMode === 'simplified' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('simplified')}
            className="rounded-r-none"
          >
            Rút gọn
          </Button>
          <Button
            type="button"
            variant={viewMode === 'detailed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('detailed')}
            className="rounded-l-none"
          >
            Chi tiết
          </Button>
        </div>
      </div>

      {viewMode === 'detailed' ? (
        <DetailedView entries={entries} widths={detailedWidths} startResize={startDetailedResize} />
      ) : (
        <SimplifiedView entries={entries} widths={simplifiedWidths} startResize={startSimplifiedResize} />
      )}

      <BalanceSummary
        isBalanced={isBalanced}
        totalDebit={totalDebit}
        totalCredit={totalCredit}
      />
    </div>
  );
}

// ── Detailed View ────────────────────────────────────────────────────────────

function DetailedView({
  entries,
  widths,
  startResize,
}: {
  entries: JournalEntry[];
  widths: number[];
  startResize: (index: number) => (e: React.MouseEvent) => void;
}) {
  const rows = buildDetailedRows(entries);

  return (
    <Table className="table-fixed">
      <colgroup>
        {widths.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead className="relative text-center overflow-visible">
            STT
            <ResizeHandle onMouseDown={startResize(0)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Ngày ghi sổ
            <ResizeHandle onMouseDown={startResize(1)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Ngày CT
            <ResizeHandle onMouseDown={startResize(2)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Số CT
            <ResizeHandle onMouseDown={startResize(3)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Đối tượng
            <ResizeHandle onMouseDown={startResize(4)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Mã số thuế
            <ResizeHandle onMouseDown={startResize(5)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Nội dung
            <ResizeHandle onMouseDown={startResize(6)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Diễn giải
            <ResizeHandle onMouseDown={startResize(7)} />
          </TableHead>
          <TableHead className="relative text-center overflow-visible" title="Đã ghi Sổ Cái">
            ✓SC
            <ResizeHandle onMouseDown={startResize(8)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Số hiệu TK
            <ResizeHandle onMouseDown={startResize(9)} />
          </TableHead>
          <TableHead className="relative text-right overflow-visible">
            Nợ (₫)
            <ResizeHandle onMouseDown={startResize(10)} />
          </TableHead>
          <TableHead className="relative text-right overflow-visible">
            Có (₫)
            <ResizeHandle onMouseDown={startResize(11)} />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <DetailedTableRow key={row.rowKey} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}

// ── Simplified View ──────────────────────────────────────────────────────────

function SimplifiedView({
  entries,
  widths,
  startResize,
}: {
  entries: JournalEntry[];
  widths: number[];
  startResize: (index: number) => (e: React.MouseEvent) => void;
}) {
  const rows = buildSimplifiedRows(entries);

  return (
    <Table className="table-fixed">
      <colgroup>
        {widths.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead className="relative text-center overflow-visible">
            STT
            <ResizeHandle onMouseDown={startResize(0)} />
          </TableHead>
          <TableHead colSpan={2} className="text-center border-b-0 relative overflow-visible">
            Hóa đơn
            <ResizeHandle onMouseDown={startResize(2)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Khách hàng
            <ResizeHandle onMouseDown={startResize(3)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Mã số thuế
            <ResizeHandle onMouseDown={startResize(4)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Nội dung
            <ResizeHandle onMouseDown={startResize(5)} />
          </TableHead>
          <TableHead colSpan={2} className="text-center border-b-0 relative overflow-visible">
            Tiểu khoản
            <ResizeHandle onMouseDown={startResize(7)} />
          </TableHead>
          <TableHead className="relative text-right overflow-visible">
            Số tiền
            <ResizeHandle onMouseDown={startResize(8)} />
          </TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="border-t-0"></TableHead>
          <TableHead className="text-xs text-muted-foreground border-t-0 relative overflow-visible">
            Số
            <ResizeHandle onMouseDown={startResize(1)} />
          </TableHead>
          <TableHead className="text-xs text-muted-foreground border-t-0 relative overflow-visible">
            Ngày
            <ResizeHandle onMouseDown={startResize(2)} />
          </TableHead>
          <TableHead className="border-t-0"></TableHead>
          <TableHead className="border-t-0"></TableHead>
          <TableHead className="border-t-0"></TableHead>
          <TableHead className="text-xs text-muted-foreground border-t-0 relative overflow-visible">
            Nợ
            <ResizeHandle onMouseDown={startResize(6)} />
          </TableHead>
          <TableHead className="text-xs text-muted-foreground border-t-0 relative overflow-visible">
            Có
            <ResizeHandle onMouseDown={startResize(7)} />
          </TableHead>
          <TableHead className="border-t-0"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <SimplifiedTableRow key={row.rowKey} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function DetailedTableRow({ row }: { row: DetailedRow }) {
  return (
    <TableRow
      className={row.isFirstLineOfEntry && row.entryLinesCount > 1 ? 'border-t-2 border-muted' : ''}
    >
      <TableCell className="text-center text-xs text-muted-foreground">{row.stt}</TableCell>
      <TableCell className="text-xs">{formatDateVN(row.postingDate)}</TableCell>
      <TableCell className="text-xs">
        {row.documentDate ? formatDateVN(row.documentDate) : formatDateVN(row.postingDate)}
      </TableCell>
      <TableCell className="font-medium text-xs">{row.entryNumber}</TableCell>
      <TableCell className="max-w-[150px] truncate text-xs" title={row.counterpartyName || undefined}>
        {row.counterpartyName || '—'}
      </TableCell>
      <TableCell className="font-mono text-xs">{row.taxCode || '—'}</TableCell>
      <TableCell className="max-w-[180px] truncate text-xs" title={row.voucherDescription}>
        {row.voucherDescription}
      </TableCell>
      <TableCell className="max-w-[180px] truncate text-xs" title={row.lineDescription}>
        {row.lineDescription}
      </TableCell>
      <TableCell className="text-center">
        {row.isPostedToLedger && <CheckCircle2 className="h-3 w-3 text-green-600 mx-auto" />}
      </TableCell>
      <TableCell className="font-mono text-xs" title={row.accountName || undefined}>
        {row.accountCode}
      </TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtAmt(row.debit)}</TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtAmt(row.credit)}</TableCell>
    </TableRow>
  );
}

function SimplifiedTableRow({ row }: { row: SimplifiedRow }) {
  return (
    <TableRow>
      <TableCell className="text-center text-xs text-muted-foreground">{row.stt}</TableCell>
      <TableCell className="text-xs font-medium">{row.voucherNumber}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatDateVN(row.voucherDate)}</TableCell>
      <TableCell className="text-xs truncate" title={row.counterpartyName || undefined}>
        {row.counterpartyName || '—'}
      </TableCell>
      <TableCell className="font-mono text-xs">{row.taxCode || '—'}</TableCell>
      <TableCell className="text-xs truncate max-w-[200px]" title={row.description}>
        {row.description}
      </TableCell>
      <TableCell className="font-mono text-xs">{row.debitAccounts || '—'}</TableCell>
      <TableCell className="font-mono text-xs">{row.creditAccounts || '—'}</TableCell>
      <TableCell className="text-right font-mono text-xs">{formatVND(row.amount)}</TableCell>
    </TableRow>
  );
}

function BalanceSummary({
  isBalanced,
  totalDebit,
  totalCredit,
}: {
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
}) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-2 bg-muted/30">
      <span
        className={`text-xs font-semibold flex items-center gap-1 ${
          isBalanced ? 'text-green-700' : 'text-red-600'
        }`}
      >
        {isBalanced ? (
          <>
            <CheckCircle2 className="h-3 w-3" /> Cân đối Nợ/Có
          </>
        ) : (
          <>
            <AlertTriangle className="h-3 w-3" /> Chênh lệch {fmtBal(totalDebit - totalCredit)}
          </>
        )}
      </span>
      <div className="text-xs font-mono space-x-6">
        <span>
          Tổng Nợ: <strong>{formatVND(totalDebit)}</strong>
        </span>
        <span>
          Tổng Có: <strong>{formatVND(totalCredit)}</strong>
        </span>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract parent account code (first 3 digits)
 * E.g., "33382" → "333", "111" → "111", "4111" → "411"
 */
function getParentAccountCode(code: string | undefined): string {
  if (!code) return '';
  return code.substring(0, 3);
}

function buildDetailedRows(entries: JournalEntry[]): DetailedRow[] {
  const rows: DetailedRow[] = [];
  let sttCounter = 0;

  for (const je of entries) {
    je.lines.forEach((line, lineIdx) => {
      sttCounter++;
      
      // Get counterparty and tax code from voucher first, then fall back to line data
      const customer = je.voucher?.customer;
      const vendor = je.voucher?.vendor;
      const employee = je.voucher?.employee;
      
      const counterpartyName = 
        customer?.name || 
        vendor?.name || 
        employee?.name ||
        je.voucher?.counterpartyName ||
        line.customer?.name || 
        line.vendor?.name ||
        null;
      
      const taxCode = 
        customer?.taxCode || 
        vendor?.taxCode || 
        employee?.taxCode ||
        line.customer?.taxCode || 
        line.vendor?.taxCode ||
        null;

      rows.push({
        rowKey: line.id || `${je.id}-${lineIdx}`,
        stt: sttCounter,
        postingDate: je.postingDate,
        documentDate: je.documentDate,
        entryNumber: je.entryNumber,
        voucherDescription: je.description, // Nội dung chứng từ
        lineDescription: line.description || '', // Diễn giải tài khoản
        taxCode,
        counterpartyName,
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

  return rows;
}

function buildSimplifiedRows(entries: JournalEntry[]): SimplifiedRow[] {
  const rows: SimplifiedRow[] = [];
  let sttCounter = 0;

  for (const je of entries) {
    sttCounter++;
    
    // Get first line for reference data
    const firstLine = je.lines[0];
    if (!firstLine) continue;

    // Get counterparty and tax code from voucher first, then fall back to line data
    const customer = je.voucher?.customer;
    const vendor = je.voucher?.vendor;
    const employee = je.voucher?.employee;
    
    const counterpartyName = 
      customer?.name || 
      vendor?.name || 
      employee?.name ||
      je.voucher?.counterpartyName ||
      firstLine.customer?.name || 
      firstLine.vendor?.name ||
      null;
    
    const taxCode = 
      customer?.taxCode || 
      vendor?.taxCode || 
      employee?.taxCode ||
      firstLine.customer?.taxCode || 
      firstLine.vendor?.taxCode ||
      null;

    // Collect account codes separately for Nợ and Có
    // Use parent account codes (first 3 digits) and keep unique values
    const debitParentCodes = Array.from(new Set(
      je.lines
        .filter(l => Number(l.debitAmount) > 0)
        .map(l => getParentAccountCode(l.account?.code))
        .filter(Boolean)
    ));
    
    const creditParentCodes = Array.from(new Set(
      je.lines
        .filter(l => Number(l.creditAmount) > 0)
        .map(l => getParentAccountCode(l.account?.code))
        .filter(Boolean)
    ));
    
    const debitAccounts = debitParentCodes.join(', ');
    const creditAccounts = creditParentCodes.join(', ');
    
    // Total amount (use total debit or credit, they should be equal)
    const amount = Number(je.totalDebit) || Number(je.totalCredit) || 0;

    rows.push({
      rowKey: je.id,
      stt: sttCounter,
      voucherNumber: je.entryNumber,
      voucherDate: je.documentDate || je.postingDate,
      counterpartyName,
      taxCode,
      description: je.description,
      debitAccounts,
      creditAccounts,
      amount,
    });
  }

  return rows;
}
