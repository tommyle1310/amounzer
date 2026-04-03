'use client';

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

interface JournalRow {
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
}

// ── Component ────────────────────────────────────────────────────────────────

export function GeneralJournalTable({ data, totals }: GeneralJournalTableProps) {
  const entries = data.data as JournalEntry[];
  const { widths, startResize } = useResizableColumns(COLUMN_WIDTHS.generalJournal);

  if (!entries || entries.length === 0) {
    return <EmptyState />;
  }

  const rows = buildJournalRows(entries);
  const totalDebit = Number(totals?.totalDebit || 0);
  const totalCredit = Number(totals?.totalCredit || 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div>
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
              Diễn giải
              <ResizeHandle onMouseDown={startResize(4)} />
            </TableHead>
            <TableHead className="relative text-center overflow-visible" title="Đã ghi Sổ Cái">
              ✓SC
              <ResizeHandle onMouseDown={startResize(5)} />
            </TableHead>
            <TableHead className="relative overflow-visible">
              Số hiệu TK
              <ResizeHandle onMouseDown={startResize(6)} />
            </TableHead>
            <TableHead className="relative text-right overflow-visible">
              Nợ (₫)
              <ResizeHandle onMouseDown={startResize(7)} />
            </TableHead>
            <TableHead className="relative text-right overflow-visible">
              Có (₫)
              <ResizeHandle onMouseDown={startResize(8)} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <JournalTableRow key={row.rowKey} row={row} />
          ))}
        </TableBody>
      </Table>
      <BalanceSummary
        isBalanced={isBalanced}
        totalDebit={totalDebit}
        totalCredit={totalCredit}
      />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function JournalTableRow({ row }: { row: JournalRow }) {
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
      <TableCell className="max-w-[220px] truncate text-xs">{row.description}</TableCell>
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

function buildJournalRows(entries: JournalEntry[]): JournalRow[] {
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

  return rows;
}
