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
import { fmtAmt, toNumber } from '../utils';
import { useResizableColumns } from '../hooks/use-resizable-columns';
import { ResizeHandle } from './resize-handle';
import { EmptyState } from './empty-state';

// ── Types ────────────────────────────────────────────────────────────────────

interface PurchaseSalesJournalTableProps {
  data: ApiBookResponse;
  type: 'purchase' | 'sales';
}

// ── Component ────────────────────────────────────────────────────────────────

export function PurchaseSalesJournalTable({ data, type }: PurchaseSalesJournalTableProps) {
  const lines = data.data as JournalEntryLine[];
  const { widths, startResize } = useResizableColumns(COLUMN_WIDTHS.purchaseSalesJournal);

  if (!lines || lines.length === 0) return <EmptyState />;

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
          <TableHead className="relative overflow-visible">
            MST
            <ResizeHandle onMouseDown={startResize(5)} />
          </TableHead>
          <TableHead className="relative overflow-visible">
            Địa chỉ
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
        {lines.map((line) => (
          <JournalLineRow key={line.id} line={line} type={type} />
        ))}

        <TableRow className="bg-muted/40 font-semibold border-t-2">
          <TableCell colSpan={7} className="text-xs">
            Tổng cộng
          </TableCell>
          <TableCell className="text-right font-mono text-xs">
            {fmtAmt(toNumber(data.totals?.totalDebit))}
          </TableCell>
          <TableCell className="text-right font-mono text-xs">
            {fmtAmt(toNumber(data.totals?.totalCredit))}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function JournalLineRow({ line, type }: { line: JournalEntryLine; type: 'purchase' | 'sales' }) {
  const debit = toNumber(line.debitAmount);
  const credit = toNumber(line.creditAmount);
  const contra = line.contraAccounts?.[0];
  const je = line.journalEntry;

  // Get partner info based on type
  const partner = type === 'purchase' ? line.vendor : line.customer;
  const partnerName = partner?.name ?? '';
  const partnerCode = partner?.code ?? '';
  const taxCode = partner?.taxCode ?? '';
  const address = partner?.address ?? '';

  return (
    <TableRow>
      <TableCell className="text-xs">{je?.postingDate ? formatDateVN(je.postingDate) : ''}</TableCell>
      <TableCell className="font-medium text-xs">{je?.entryNumber ?? ''}</TableCell>
      <TableCell className="max-w-[180px] truncate text-xs" title={line.description || je?.description || ''}>
        {line.description || je?.description || ''}
      </TableCell>
      <TableCell className="font-mono text-xs">{contra?.code ?? line.account?.code ?? ''}</TableCell>
      <TableCell className="text-xs truncate" title={partnerName}>
        {partnerCode && <span className="font-mono mr-1">{partnerCode}</span>}
        {partnerName}
      </TableCell>
      <TableCell className="text-xs font-mono">{taxCode}</TableCell>
      <TableCell className="text-xs truncate max-w-[150px]" title={address}>{address}</TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtAmt(debit)}</TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtAmt(credit)}</TableCell>
    </TableRow>
  );
}
