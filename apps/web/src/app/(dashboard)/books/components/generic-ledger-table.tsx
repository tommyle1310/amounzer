'use client';

import { formatDateVN } from '@amounzer/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { ApiBookResponse, JournalEntryLine } from '../types';
import { COLUMN_WIDTHS } from '../constants';
import { fmtAmt, fmtBal, toNumber } from '../utils';
import { useResizableColumns } from '../hooks/use-resizable-columns';
import { ResizeHandle } from './resize-handle';
import { EmptyState } from './empty-state';

// ── Types ────────────────────────────────────────────────────────────────────

interface GenericLedgerTableProps {
  data: ApiBookResponse;
}

// ── Component ────────────────────────────────────────────────────────────────

export function GenericLedgerTable({ data }: GenericLedgerTableProps) {
  const lines = data.data as JournalEntryLine[];
  const { widths, startResize } = useResizableColumns(COLUMN_WIDTHS.genericLedger);

  if (!lines || lines.length === 0) return <EmptyState />;

  const openingBal = toNumber(data.openingBalance?.balance);

  return (
    <Table className="table-fixed">
      <colgroup>
        {widths.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead className="relative overflow-visible">
            Ngày
            <ResizeHandle onMouseDown={startResize(0)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Số CT
            <ResizeHandle onMouseDown={startResize(1)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Diễn giải
            <ResizeHandle onMouseDown={startResize(2)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            TK đối ứng
            <ResizeHandle onMouseDown={startResize(3)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Đối tượng
            <ResizeHandle onMouseDown={startResize(4)} />
          </TableHead>
          <TableHead className="relative text-right overflow-visible">
            Nợ (₫)
            <ResizeHandle onMouseDown={startResize(5)} />
          </TableHead>
          <TableHead className="relative text-right overflow-visible">
            Có (₫)
            <ResizeHandle onMouseDown={startResize(6)} />
          </TableHead>
          <TableHead className="relative text-right overflow-visible">
            Số dư (₫)
            <ResizeHandle onMouseDown={startResize(7)} />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="bg-muted/40 font-medium">
          <TableCell colSpan={7} className="text-xs italic">
            Số dư đầu kỳ
          </TableCell>
          <TableCell className="text-right font-mono text-xs">{fmtBal(openingBal)}</TableCell>
        </TableRow>

        {lines.map((line) => (
          <LedgerLineRow key={line.id} line={line} />
        ))}

        <TableRow className="bg-muted/40 font-semibold border-t-2">
          <TableCell colSpan={5} className="text-xs">
            Tổng cộng & Số dư cuối kỳ
          </TableCell>
          <TableCell className="text-right font-mono text-xs">
            {fmtAmt(toNumber(data.totals?.totalDebit))}
          </TableCell>
          <TableCell className="text-right font-mono text-xs">
            {fmtAmt(toNumber(data.totals?.totalCredit))}
          </TableCell>
          <TableCell className="text-right font-mono text-xs font-bold">
            {fmtBal(toNumber(data.closingBalance?.balance))}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function LedgerLineRow({ line }: { line: JournalEntryLine }) {
  const debit = toNumber(line.debitAmount);
  const credit = toNumber(line.creditAmount);
  const runBal = toNumber(line.runningBalance);
  const contra = line.contraAccounts?.[0];
  const je = line.journalEntry;

  return (
    <TableRow>
      <TableCell className="text-xs">{je?.postingDate ? formatDateVN(je.postingDate) : ''}</TableCell>
      <TableCell className="font-medium text-xs">{je?.entryNumber ?? ''}</TableCell>
      <TableCell className="max-w-[200px] truncate text-xs">
        {line.description || je?.description || ''}
      </TableCell>
      <TableCell className="font-mono text-xs">{contra?.code ?? line.account?.code ?? ''}</TableCell>
      <TableCell className="text-xs">{line.customer?.name ?? line.vendor?.name ?? ''}</TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtAmt(debit)}</TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtAmt(credit)}</TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtBal(runBal)}</TableCell>
    </TableRow>
  );
}
