'use client';

import { useState, useMemo } from 'react';
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
import { Download } from 'lucide-react';

interface BookEntry {
  id: string;
  date: string;
  voucherNumber?: string;
  description: string;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  balance?: number;
  counterpartyName?: string;
}

// Raw API response types
interface JournalEntryLine {
  id: string;
  accountId: string;
  debitAmount: string | number;
  creditAmount: string | number;
  description?: string;
  account?: { code: string; name: string };
  journalEntry?: {
    entryNumber: string;
    postingDate: string;
    description: string;
    lines?: Array<{ account: { code: string; name: string } }>;
  };
  customer?: { name: string } | null;
  vendor?: { name: string } | null;
  contraAccounts?: Array<{ code: string; name: string }>;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  postingDate: string;
  description: string;
  totalDebit: string | number;
  totalCredit: string | number;
  lines: JournalEntryLine[];
}

interface ApiBookResponse {
  data: JournalEntry[] | JournalEntryLine[] | unknown[];
  openingBalance?: { debit: string | number; credit: string | number; balance: string | number };
  closingBalance?: { debit: string | number; credit: string | number; balance: string | number };
  totals?: { totalDebit: string | number; totalCredit: string | number };
}

// Get default date range (current fiscal year or current month)
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  // Default to fiscal year start (January 1st) to today
  const startDate = `${year}-01-01`;
  const endDate = `${year}-${month}-${day}`;
  return { startDate, endDate };
}

// Transform API response to flat BookEntry format based on book type
function transformApiResponse(
  bookType: string,
  response: ApiBookResponse,
): BookEntry[] {
  const data = response.data;
  if (!data || !Array.isArray(data) || data.length === 0) return [];

  // General Journal: returns JournalEntry[] with nested lines - flatten to show each line
  if (bookType === 'general-journal') {
    const entries: BookEntry[] = [];
    for (const je of data as JournalEntry[]) {
      for (const line of je.lines || []) {
        entries.push({
          id: line.id || `${je.id}-${line.accountId}`,
          date: je.postingDate,
          voucherNumber: je.entryNumber,
          description: line.description || je.description,
          accountCode: line.account?.code,
          accountName: line.account?.name,
          debit: Number(line.debitAmount) || 0,
          credit: Number(line.creditAmount) || 0,
        });
      }
    }
    return entries;
  }

  // Ledger-type books: returns JournalEntryLine[] with journalEntry reference
  if (['general-ledger', 'cash', 'bank', 'ar-detail', 'ap-detail', 'payroll', 'advance', 'vat-input', 'vat-output'].includes(bookType)) {
    let runningBalance = Number(response.openingBalance?.balance) || 0;
    return (data as JournalEntryLine[]).map((line) => {
      const debit = Number(line.debitAmount) || 0;
      const credit = Number(line.creditAmount) || 0;
      runningBalance += debit - credit;
      
      // Get contra account info if available
      const contraAccount = line.contraAccounts?.[0];
      
      return {
        id: line.id,
        date: line.journalEntry?.postingDate || '',
        voucherNumber: line.journalEntry?.entryNumber,
        description: line.description || line.journalEntry?.description || '',
        accountCode: contraAccount?.code || line.account?.code,
        accountName: contraAccount?.name || line.account?.name,
        debit,
        credit,
        balance: runningBalance,
        counterpartyName: line.customer?.name || line.vendor?.name,
      };
    });
  }

  // For other book types, try to map directly or return empty
  return (data as unknown[]).map((item: unknown, idx: number) => {
    const obj = item as Record<string, unknown>;
    return {
      id: String(obj.id || idx),
      date: String(obj.postingDate || obj.date || ''),
      voucherNumber: String(obj.entryNumber || obj.voucherNumber || ''),
      description: String(obj.description || ''),
      accountCode: String((obj.account as { code?: string })?.code || obj.accountCode || ''),
      accountName: String((obj.account as { name?: string })?.name || obj.accountName || ''),
      debit: Number(obj.debitAmount || obj.debit || 0),
      credit: Number(obj.creditAmount || obj.credit || 0),
      balance: obj.balance != null ? Number(obj.balance) : undefined,
    };
  });
}

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
  { key: 'cost-center', label: 'DT theo khoản mục' },
  { key: 'equity-summary', label: 'Tổng hợp nguồn vốn' },
] as const;

// Map frontend bookType keys to API endpoint paths
const bookApiMap: Record<string, string> = {
  'general-journal': 'general-journal',
  'general-ledger': 'general-ledger',
  'cash': 'cash-book',
  'bank': 'bank-book',
  'ar-detail': 'customer-ledger',
  'ap-detail': 'vendor-ledger',
  'inventory': 'inventory-ledger',
  'fixed-asset': 'fixed-asset-ledger',
  'payroll': 'payroll-ledger',
  'advance': 'advance-ledger',
  'vat-input': 'vat-input-ledger',
  'vat-output': 'vat-output-ledger',
  'purchase-journal': 'purchase-journal',
  'sales-journal': 'sales-journal',
  'cost-center': 'cost-center',
  'equity-summary': 'equity-summary',
};

function BookTable({ bookKey, dateFrom, dateTo }: { bookKey: string; dateFrom: string; dateTo: string }) {
  const params = new URLSearchParams();
  params.set('startDate', dateFrom);
  params.set('endDate', dateTo);

  const apiPath = bookApiMap[bookKey] ?? bookKey;
  const { data, isLoading, error } = useQuery<ApiBookResponse>({
    queryKey: ['books', bookKey, dateFrom, dateTo],
    queryFn: () => apiClient.get(`/accounting-books/${apiPath}?${params.toString()}`),
    enabled: !!dateFrom && !!dateTo, // Only fetch when dates are set
  });

  const entries = useMemo(() => {
    if (!data) return [];
    return transformApiResponse(bookKey, data);
  }, [data, bookKey]);

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Đang tải...</div>;
  }

  if (error) {
    return <div className="py-8 text-center text-red-500">Lỗi khi tải dữ liệu</div>;
  }

  if (entries.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">Không có dữ liệu trong kỳ này</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ngày</TableHead>
          <TableHead>Số CT</TableHead>
          <TableHead>Diễn giải</TableHead>
          <TableHead>TK</TableHead>
          <TableHead>Đối tượng</TableHead>
          <TableHead className="text-right">Nợ (₫)</TableHead>
          <TableHead className="text-right">Có (₫)</TableHead>
          <TableHead className="text-right">Số dư (₫)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>{formatDateVN(entry.date)}</TableCell>
            <TableCell className="font-medium">{entry.voucherNumber ?? '—'}</TableCell>
            <TableCell className="max-w-[250px] truncate">{entry.description}</TableCell>
            <TableCell className="font-mono">{entry.accountCode ?? ''}</TableCell>
            <TableCell>{entry.counterpartyName ?? ''}</TableCell>
            <TableCell className="text-right font-mono">
              {entry.debit > 0 ? formatVND(entry.debit) : ''}
            </TableCell>
            <TableCell className="text-right font-mono">
              {entry.credit > 0 ? formatVND(entry.credit) : ''}
            </TableCell>
            <TableCell className="text-right font-mono">
              {entry.balance != null ? formatVND(entry.balance) : ''}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function BooksPage() {
  const [activeTab, setActiveTab] = useState<string>(bookTypes[0].key);
  // Initialize with current fiscal year dates
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

      {/* Period filter */}
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
                <CardTitle>{bt.label}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <BookTable bookKey={bt.key} dateFrom={dateFrom} dateTo={dateTo} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
