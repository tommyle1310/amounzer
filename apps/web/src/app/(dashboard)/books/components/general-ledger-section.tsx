'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDateVN } from '@amounzer/shared';
import { AlertTriangle, ChevronDown, Search, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import type { ApiBookResponse, JournalEntryLine, LedgerAccount } from '../types';
import { COLUMN_WIDTHS } from '../constants';
import { fmtAmt, fmtBal, toNumber } from '../utils';
import { useResizableColumns } from '../hooks/use-resizable-columns';
import { ResizeHandle } from './resize-handle';
import { NegativeBalanceWarning } from './negative-balance-warning';

// ── Types ────────────────────────────────────────────────────────────────────

interface GeneralLedgerSectionProps {
  dateFrom: string;
  dateTo: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function GeneralLedgerSection({ dateFrom, dateTo }: GeneralLedgerSectionProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const { widths, startResize } = useResizableColumns(COLUMN_WIDTHS.generalLedger);

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

  const openingBal = toNumber(data?.openingBalance?.balance);
  const closingBal = toNumber(data?.closingBalance?.balance);
  const hasNegativeBalance = lines.some((l) => l.isNegativeBalance);

  return (
    <div className="space-y-3">
      <AccountSelector
        accounts={accounts ?? []}
        selectedAccountId={selectedAccountId}
        onSelect={setSelectedAccountId}
      />

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
          {hasNegativeBalance && (
            <NegativeBalanceWarning message="Tài khoản có số dư âm trong kỳ. Kiểm tra lại bút toán đầu kỳ hoặc thứ tự ghi sổ." />
          )}
          <Table className="table-fixed">
            <colgroup>
              {widths.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="relative text-center overflow-visible" title="STT dòng Nhật ký chung">
                  STT NKC
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
                  Nội dung
                  <ResizeHandle onMouseDown={startResize(4)} />
                </TableHead>
                <TableHead className="relative overflow-visible">
                  TK đối ứng
                  <ResizeHandle onMouseDown={startResize(5)} />
                </TableHead>
                <TableHead className="relative text-right overflow-visible">
                  Nợ (₫)
                  <ResizeHandle onMouseDown={startResize(6)} />
                </TableHead>
                <TableHead className="relative text-right overflow-visible">
                  Có (₫)
                  <ResizeHandle onMouseDown={startResize(7)} />
                </TableHead>
                <TableHead className="relative text-right overflow-visible">
                  Số dư (₫)
                  <ResizeHandle onMouseDown={startResize(8)} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <OpeningBalanceRow
                accountCode={selectedAccount?.code}
                accountName={selectedAccount?.name}
                balance={openingBal}
              />

              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted-foreground text-sm">
                    Chưa có chứng từ ghi sổ trong kỳ này
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line) => (
                  <LedgerLineRow key={line.id} line={line} openingBal={openingBal} />
                ))
              )}

              <ClosingBalanceRow
                totalDebit={toNumber(data?.totals?.totalDebit)}
                totalCredit={toNumber(data?.totals?.totalCredit)}
                closingBal={closingBal}
              />
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function AccountSelector({
  accounts,
  selectedAccountId,
  onSelect,
}: {
  accounts: LedgerAccount[];
  selectedAccountId: string;
  onSelect: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return accounts;
    const query = searchQuery.toLowerCase();
    return accounts.filter(
      (a) =>
        a.code.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query)
    );
  }, [accounts, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (account: LedgerAccount) => {
    onSelect(account.id);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    onSelect('');
    setSearchQuery('');
  };

  return (
    <div className="flex items-center gap-3 px-4 pt-4">
      <label className="text-sm font-medium whitespace-nowrap">Tài khoản:</label>
      <div className="relative w-96" ref={dropdownRef}>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between text-left font-normal"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={selectedAccount ? '' : 'text-muted-foreground'}>
            {selectedAccount
              ? `${selectedAccount.code} — ${selectedAccount.name}`
              : '— Chọn tài khoản để xem sổ cái —'}
          </span>
          <div className="flex items-center gap-1">
            {selectedAccount && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
              />
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
            <div className="flex items-center border-b px-3 py-2">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                ref={inputRef}
                placeholder="Tìm mã hoặc tên tài khoản..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filteredAccounts.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Không tìm thấy tài khoản
                </div>
              ) : (
                filteredAccounts.map((a) => (
                  <div
                    key={a.id}
                    className={`flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                      a.id === selectedAccountId ? 'bg-accent' : ''
                    }`}
                    onClick={() => handleSelect(a)}
                  >
                    <span className="font-mono text-xs w-16">{a.code}</span>
                    <span className="ml-2">{a.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OpeningBalanceRow({
  accountCode,
  accountName,
  balance,
}: {
  accountCode?: string;
  accountName?: string;
  balance: number;
}) {
  return (
    <TableRow className="bg-muted/40 font-medium">
      <TableCell colSpan={8} className="text-xs italic">
        Số dư đầu kỳ — TK {accountCode} {accountName}
      </TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtBal(balance)}</TableCell>
    </TableRow>
  );
}

function LedgerLineRow({ line, openingBal }: { line: JournalEntryLine; openingBal: number }) {
  const runBal =
    toNumber(line.runningBalance) ||
    openingBal + toNumber(line.debitAmount) - toNumber(line.creditAmount);
  const contra = line.contraAccounts?.[0];
  const je = line.journalEntry;
  const v = line.voucher;
  const isNeg = line.isNegativeBalance || runBal < 0;

  // Get content from voucher.description first, then fall back to line/journalEntry
  const noiDung = v?.description || line.description || je?.description || '';

  return (
    <TableRow className={isNeg ? 'bg-red-50 text-red-700' : ''}>
      <TableCell className="text-center text-xs text-muted-foreground">{line.sttNkc ?? ''}</TableCell>
      <TableCell className="text-xs">{je?.postingDate ? formatDateVN(je.postingDate) : ''}</TableCell>
      <TableCell className="text-xs">
        {je?.documentDate ? formatDateVN(je.documentDate) : je?.postingDate ? formatDateVN(je.postingDate) : ''}
      </TableCell>
      <TableCell className="font-medium text-xs">{je?.entryNumber ?? ''}</TableCell>
      <TableCell className="max-w-[200px] truncate text-xs">
        {noiDung}
      </TableCell>
      <TableCell className="font-mono text-xs" title={contra?.name || undefined}>
        {contra ? contra.code : ''}
      </TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtAmt(toNumber(line.debitAmount))}</TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtAmt(toNumber(line.creditAmount))}</TableCell>
      <TableCell className={`text-right font-mono text-xs font-medium ${isNeg ? 'text-red-600' : ''}`}>
        {isNeg && <AlertTriangle className="inline h-3 w-3 mr-1" />}
        {fmtBal(runBal)}
      </TableCell>
    </TableRow>
  );
}

function ClosingBalanceRow({
  totalDebit,
  totalCredit,
  closingBal,
}: {
  totalDebit: number;
  totalCredit: number;
  closingBal: number;
}) {
  return (
    <TableRow className="bg-muted/40 font-semibold border-t-2">
      <TableCell colSpan={6} className="text-xs">
        Tổng cộng & Số dư cuối kỳ
      </TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtAmt(totalDebit)}</TableCell>
      <TableCell className="text-right font-mono text-xs">{fmtAmt(totalCredit)}</TableCell>
      <TableCell className="text-right font-mono text-xs font-bold">{fmtBal(closingBal)}</TableCell>
    </TableRow>
  );
}
