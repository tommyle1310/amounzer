'use client';

import { useState } from 'react';
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

interface BookResponse {
  data: BookEntry[];
  total: number;
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

function BookTable({ bookKey, dateFrom, dateTo }: { bookKey: string; dateFrom: string; dateTo: string }) {
  const params = new URLSearchParams();
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  const { data, isLoading } = useQuery<BookResponse>({
    queryKey: ['books', bookKey, dateFrom, dateTo],
    queryFn: () => apiClient.get(`/books/${bookKey}?${params.toString()}`),
  });

  const entries = data?.data ?? [];

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Đang tải...</div>;
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
