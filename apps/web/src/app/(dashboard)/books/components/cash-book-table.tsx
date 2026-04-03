'use client';

import { formatDateVN } from '@amounzer/shared';
import { AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { ApiBookResponse, JournalEntryLine, ContraAccount } from '../types';
import { COLUMN_WIDTHS } from '../constants';
import { fmtAmt, fmtBal, toNumber } from '../utils';
import { useResizableColumns } from '../hooks/use-resizable-columns';
import { ResizeHandle } from './resize-handle';
import { EmptyState } from './empty-state';
import { NegativeBalanceWarning } from './negative-balance-warning';
import { BookSignatureFooter } from './book-signature-footer';

// ── Types ────────────────────────────────────────────────────────────────────

interface CashBookTableProps {
  data: ApiBookResponse;
}

interface CashRowData {
  dateGhiSo: string;
  dateCT: string;
  soPT: string;
  soPC: string;
  dienGiai: string;
  doiTuong: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CashBookTable({ data }: CashBookTableProps) {
  const lines = data.data as JournalEntryLine[];
  const openingBal = toNumber(data.openingBalance?.balance);
  const hasNegative = lines.some((l) => l.isNegativeBalance || toNumber(l.runningBalance) < 0);
  const { widths, startResize } = useResizableColumns(COLUMN_WIDTHS.cashBook);

  if (!lines || lines.length === 0) {
    return <EmptyState />;
  }

  return (
    <div>
      {hasNegative && (
        <NegativeBalanceWarning message="Một hoặc nhiều dòng làm tồn quỹ xuống dưới 0. Kiểm tra lại chứng từ chi." />
      )}
      <Table className="table-fixed">
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <CashBookHeader startResize={startResize} />
        <TableBody>
          <OpeningBalanceRow balance={openingBal} />
          {lines.map((line) => (
            <CashBookLineRows key={line.id} line={line} />
          ))}
          <ClosingBalanceRow data={data} />
        </TableBody>
      </Table>
      <BookSignatureFooter />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CashBookHeader({ startResize }: { startResize: (idx: number) => (e: React.MouseEvent) => void }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="relative overflow-visible">
          Ngày ghi sổ
          <ResizeHandle onMouseDown={startResize(0)} />
        </TableHead>
        <TableHead className="relative overflow-visible">
          Ngày CT
          <ResizeHandle onMouseDown={startResize(1)} />
        </TableHead>
        <TableHead className="relative overflow-visible">
          Số PT
          <ResizeHandle onMouseDown={startResize(2)} />
        </TableHead>
        <TableHead className="relative overflow-visible">
          Số PC
          <ResizeHandle onMouseDown={startResize(3)} />
        </TableHead>
        <TableHead className="relative overflow-visible">
          Diễn giải
          <ResizeHandle onMouseDown={startResize(4)} />
        </TableHead>
        <TableHead className="relative overflow-visible">
          Đối tượng
          <ResizeHandle onMouseDown={startResize(5)} />
        </TableHead>
        <TableHead className="relative overflow-visible">
          TK đối ứng
          <ResizeHandle onMouseDown={startResize(6)} />
        </TableHead>
        <TableHead className="relative text-right overflow-visible">
          Thu (₫)
          <ResizeHandle onMouseDown={startResize(7)} />
        </TableHead>
        <TableHead className="relative text-right overflow-visible">
          Chi (₫)
          <ResizeHandle onMouseDown={startResize(8)} />
        </TableHead>
        <TableHead className="relative text-right overflow-visible">
          Tồn quỹ (₫)
          <ResizeHandle onMouseDown={startResize(9)} />
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

function OpeningBalanceRow({ balance }: { balance: number }) {
  return (
    <TableRow className="bg-muted/40 font-medium">
      <TableCell colSpan={9} className="text-xs italic">
        Số dư đầu kỳ (TK 111)
      </TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtBal(balance)}</TableCell>
    </TableRow>
  );
}

function CashBookLineRows({ line }: { line: JournalEntryLine }) {
  const debit = toNumber(line.debitAmount);
  const credit = toNumber(line.creditAmount);
  const runBal = toNumber(line.runningBalance);
  const contras = line.contraAccounts ?? [];
  const je = line.journalEntry;
  const v = line.voucher;

  const rowData: CashRowData = {
    dateGhiSo: je?.postingDate ? formatDateVN(je.postingDate) : '',
    dateCT: v?.voucherDate
      ? formatDateVN(v.voucherDate)
      : je?.documentDate
        ? formatDateVN(je.documentDate)
        : je?.postingDate
          ? formatDateVN(je.postingDate)
          : '',
    soPT: v?.receiptNo ?? '',
    soPC: v?.paymentNo ?? '',
    dienGiai: line.description || je?.description || '',
    doiTuong: v?.partyName ?? '',
  };

  // Calculate running balance for start of this voucher
  const totalContraDebit = contras.reduce((sum, c) => sum + toNumber(c.debitAmount), 0);
  const totalContraCredit = contras.reduce((sum, c) => sum + toNumber(c.creditAmount), 0);
  const balanceBeforeVoucher =
    runBal - (debit > 0 ? totalContraCredit : 0) + (credit > 0 ? totalContraDebit : 0);

  // Render single row if no contras
  if (contras.length === 0) {
    const isNeg = line.isNegativeBalance || runBal < 0;
    return (
      <CashBookRow
        rowData={rowData}
        contraCode=""
        contraName=""
        thu={debit}
        chi={credit}
        balance={runBal}
        isNeg={isNeg}
      />
    );
  }

  // Render each contra as separate row with incremental running balance
  let accumulatedBalance = balanceBeforeVoucher;
  return contras.map((contra, idx) => {
    const contraDebit = toNumber(contra.debitAmount);
    const contraCredit = toNumber(contra.creditAmount);

    // Update accumulated balance: Thu (cash debit) adds credit, Chi (cash credit) subtracts debit
    if (debit > 0) {
      accumulatedBalance += contraCredit;
    } else {
      accumulatedBalance -= contraDebit;
    }

    const rowBalance = accumulatedBalance;
    const rowIsNeg = rowBalance < 0;

    return (
      <CashBookRow
        key={`${line.id}-${idx}`}
        rowData={rowData}
        contraCode={contra.code}
        contraName={contra.name}
        thu={contraCredit}
        chi={contraDebit}
        balance={rowBalance}
        isNeg={rowIsNeg}
        isMultiContraFirst={idx === 0 && contras.length > 1}
      />
    );
  });
}

function CashBookRow({
  rowData,
  contraCode,
  contraName,
  thu,
  chi,
  balance,
  isNeg,
  isMultiContraFirst = false,
}: {
  rowData: CashRowData;
  contraCode: string;
  contraName?: string;
  thu: number;
  chi: number;
  balance: number;
  isNeg: boolean;
  isMultiContraFirst?: boolean;
}) {
  return (
    <TableRow
      className={`${isNeg ? 'bg-red-50 text-red-700' : ''} ${isMultiContraFirst ? 'border-t-2 border-muted' : ''}`}
    >
      <TableCell className="text-xs">{rowData.dateGhiSo}</TableCell>
      <TableCell className="text-xs">{rowData.dateCT}</TableCell>
      <TableCell className="font-mono text-xs">{rowData.soPT}</TableCell>
      <TableCell className="font-mono text-xs">{rowData.soPC}</TableCell>
      <TableCell className="max-w-[160px] truncate text-xs">{rowData.dienGiai}</TableCell>
      <TableCell className="text-xs">{rowData.doiTuong}</TableCell>
      <TableCell className="font-mono text-xs" title={contraName || undefined}>
        {contraCode}
      </TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtAmt(thu)}</TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtAmt(chi)}</TableCell>
      <TableCell className={`text-right font-mono text-xs font-medium ${isNeg ? 'text-red-600' : ''}`}>
        {isNeg && <AlertTriangle className="inline h-3 w-3 mr-1" />}
        {fmtBal(balance)}
      </TableCell>
    </TableRow>
  );
}

function ClosingBalanceRow({ data }: { data: ApiBookResponse }) {
  return (
    <TableRow className="bg-muted/40 font-semibold border-t-2">
      <TableCell colSpan={7} className="text-xs">
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
  );
}
