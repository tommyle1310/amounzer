'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatVND, numberToVietnameseWords } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
}

interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
}

interface JournalLine {
  accountId: string;
  accountQuery: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
}

const emptyLine = (): JournalLine => ({
  accountId: '',
  accountQuery: '',
  description: '',
  debitAmount: 0,
  creditAmount: 0,
});

export default function NewCTGSPage() {
  const router = useRouter();
  const { company } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState('');
  const [activeAccountLine, setActiveAccountLine] = useState<number | null>(null);
  const [debouncedAccountQuery, setDebouncedAccountQuery] = useState('');

  // Fetch fiscal years for the company
  const { data: fiscalYears = [] } = useQuery<FiscalYear[]>({
    queryKey: ['fiscal-years', company?.id],
    queryFn: () => apiClient.get(`/companies/${company!.id}/fiscal-years`),
    enabled: !!company?.id,
  });

  // Find the fiscal year that contains the selected date
  const currentFiscalYear = useMemo(() => {
    if (!date || fiscalYears.length === 0) return null;
    const voucherDate = new Date(date);
    return fiscalYears.find((fy) => {
      const start = new Date(fy.startDate);
      const end = new Date(fy.endDate);
      return voucherDate >= start && voucherDate <= end && fy.status === 'OPEN';
    }) ?? null;
  }, [date, fiscalYears]);

  // Debounce account search query (300ms)
  useEffect(() => {
    const query = activeAccountLine !== null ? lines[activeAccountLine]?.accountQuery ?? '' : '';
    const timer = setTimeout(() => {
      setDebouncedAccountQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [activeAccountLine, lines]);

  // Accounts search with debounced query
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts-search', debouncedAccountQuery],
    queryFn: () =>
      apiClient.get(
        `/chart-of-accounts/search?q=${encodeURIComponent(debouncedAccountQuery)}`,
      ),
    enabled: debouncedAccountQuery.length >= 1,
  });

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => apiClient.post('/vouchers', payload),
    onSuccess: () => router.push('/vouchers'),
    onError: (err) => setError(err instanceof Error ? err.message : 'Lỗi tạo chứng từ ghi sổ'),
  });

  const updateLine = useCallback((index: number, field: keyof JournalLine, value: string | number) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }, []);

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debitAmount) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.creditAmount) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const noFiscalYearForDate = !currentFiscalYear && fiscalYears.length > 0;
  const noFiscalYearAtAll = fiscalYears.length === 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentFiscalYear) {
      setError('Không tìm thấy năm tài chính mở cho ngày chứng từ này');
      return;
    }
    if (!isBalanced) {
      setError('Tổng Nợ và Có phải bằng nhau');
      return;
    }
    const validLines = lines.filter((l) => l.accountId && (l.debitAmount > 0 || l.creditAmount > 0));
    if (validLines.length < 1) {
      setError('Cần ít nhất 1 dòng bút toán hợp lệ');
      return;
    }
    setError('');
    createMutation.mutate({
      voucherType: 'CTGS',
      date: new Date(date).toISOString(),
      description,
      totalAmount: totalDebit,
      amountInWords: numberToVietnameseWords(totalDebit, 'đồng'),
      fiscalYearId: currentFiscalYear.id,
      lines: validLines.map(({ accountId, description: desc, debitAmount, creditAmount }) => ({
        accountId,
        description: desc,
        debitAmount: Number(debitAmount) || 0,
        creditAmount: Number(creditAmount) || 0,
      })),
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Chứng từ ghi sổ (CTGS)</h1>

      {noFiscalYearAtAll && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Chưa có năm tài chính.{' '}
          <Link href="/settings" className="underline font-medium">
            Tạo năm tài chính
          </Link>{' '}
          trong phần Cài đặt.
        </div>
      )}

      {noFiscalYearForDate && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Không tìm thấy năm tài chính mở cho ngày {date}.{' '}
          <Link href="/settings" className="underline font-medium">
            Quản lý năm tài chính
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Thông tin chứng từ</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Số chứng từ</Label>
              <Input
                value="CTGS-XXXX (tự động)"
                readOnly
                className="bg-muted font-mono"
              />
              <p className="text-xs text-muted-foreground">Số chứng từ sẽ được tạo tự động khi lưu</p>
            </div>
            <div className="space-y-2">
              <Label>Ngày chứng từ *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Nội dung *</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Diễn giải chứng từ ghi sổ"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tổng số tiền</Label>
              <Input
                value={formatVND(totalDebit)}
                readOnly
                className="bg-muted font-mono font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label>Số tiền bằng chữ</Label>
              <Input
                value={numberToVietnameseWords(totalDebit, 'đồng')}
                readOnly
                className="bg-muted italic text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Journal lines - Định khoản */}
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Định khoản (TK đối ứng)</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              <Plus className="mr-1 h-4 w-4" />
              Thêm dòng
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="min-w-[200px]">Tài khoản</TableHead>
                  <TableHead>Diễn giải</TableHead>
                  <TableHead className="w-36 text-right">Nợ (₫)</TableHead>
                  <TableHead className="w-36 text-right">Có (₫)</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="relative">
                        <Input
                          value={line.accountQuery}
                          onChange={(e) => {
                            updateLine(idx, 'accountQuery', e.target.value);
                            setActiveAccountLine(idx);
                          }}
                          onFocus={() => setActiveAccountLine(idx)}
                          placeholder="Mã hoặc tên TK"
                          className="text-sm"
                        />
                        {activeAccountLine === idx && accounts.length > 0 && line.accountQuery.length >= 1 && (
                          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border bg-background shadow-md">
                            {accounts.map((acc) => (
                              <button
                                key={acc.id}
                                type="button"
                                className="flex w-full gap-2 px-3 py-2 text-sm hover:bg-accent"
                                onClick={() => {
                                  updateLine(idx, 'accountId', acc.id);
                                  updateLine(idx, 'accountQuery', `${acc.code} - ${acc.name}`);
                                  // Auto-fill description if empty
                                  if (!line.description) {
                                    updateLine(idx, 'description', acc.name);
                                  }
                                  setActiveAccountLine(null);
                                }}
                              >
                                <span className="font-mono font-medium">{acc.code}</span>
                                <span>{acc.name}</span>
                                {acc.nameEn && <span className="text-muted-foreground">({acc.nameEn})</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(idx, 'description', e.target.value)}
                        placeholder="Diễn giải dòng"
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.debitAmount || ''}
                        onChange={(e) => updateLine(idx, 'debitAmount', parseFloat(e.target.value) || 0)}
                        className="text-right text-sm font-mono"
                        tabIndex={0}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.creditAmount || ''}
                        onChange={(e) => updateLine(idx, 'creditAmount', parseFloat(e.target.value) || 0)}
                        className="text-right text-sm font-mono"
                        tabIndex={0}
                      />
                    </TableCell>
                    <TableCell>
                      {lines.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">
                    Tổng cộng
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatVND(totalDebit)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatVND(totalCredit)}
                  </TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">
                    Chênh lệch
                  </TableCell>
                  <TableCell
                    colSpan={2}
                    className={`text-center font-mono font-bold ${isBalanced ? 'text-green-600' : 'text-destructive'}`}
                  >
                    {isBalanced ? 'Cân' : `Lệch: ${formatVND(Math.abs(totalDebit - totalCredit))} ₫`}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push('/vouchers')}>
            Hủy
          </Button>
          <Button type="submit" disabled={createMutation.isPending || !isBalanced || !currentFiscalYear}>
            {createMutation.isPending ? 'Đang lưu...' : 'Lưu chứng từ'}
          </Button>
        </div>
      </form>
    </div>
  );
}
