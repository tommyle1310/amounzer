'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatVND, VOUCHER_TYPE_LABELS, type VoucherTypeCode } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
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

export default function NewVoucherPage() {
  const router = useRouter();
  const [voucherType, setVoucherType] = useState<VoucherTypeCode>('PT');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);
  const [counterpartyQuery, setCounterpartyQuery] = useState('');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState('');
  const [showCounterpartySuggestions, setShowCounterpartySuggestions] = useState(false);
  const [activeAccountLine, setActiveAccountLine] = useState<number | null>(null);

  // Accounts search
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts-search', activeAccountLine !== null ? lines[activeAccountLine]?.accountQuery : ''],
    queryFn: () =>
      apiClient.get(
        `/accounts?search=${encodeURIComponent(lines[activeAccountLine!]?.accountQuery ?? '')}`,
      ),
    enabled: activeAccountLine !== null && (lines[activeAccountLine]?.accountQuery?.length ?? 0) >= 1,
  });

  // Counterparty search
  const { data: counterparties = [] } = useQuery<{ id: string; name: string; taxCode?: string }[]>({
    queryKey: ['counterparty-search', counterpartyQuery],
    queryFn: () =>
      apiClient.get(`/counterparties?search=${encodeURIComponent(counterpartyQuery)}`),
    enabled: counterpartyQuery.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => apiClient.post('/vouchers', payload),
    onSuccess: () => router.push('/vouchers'),
    onError: (err) => setError(err instanceof Error ? err.message : 'Lỗi tạo chứng từ'),
  });

  const updateLine = useCallback((index: number, field: keyof JournalLine, value: string | number) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }, []);

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debitAmount) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.creditAmount) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      voucherType,
      date: new Date(date).toISOString(),
      counterpartyId: counterpartyId || undefined,
      counterpartyName: counterpartyName || undefined,
      description,
      totalAmount: totalDebit,
      lines: validLines.map(({ accountId, description: desc, debitAmount, creditAmount }) => ({
        accountId,
        description: desc,
        debitAmount: Number(debitAmount) || 0,
        creditAmount: Number(creditAmount) || 0,
      })),
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Tạo chứng từ mới</h1>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Thông tin chứng từ</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Loại chứng từ</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value as VoucherTypeCode)}
              >
                {Object.entries(VOUCHER_TYPE_LABELS).map(([code, labels]) => (
                  <option key={code} value={code}>
                    {code} - {labels.vi}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Ngày chứng từ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="relative space-y-2 sm:col-span-2">
              <Label>Đối tượng</Label>
              <Input
                value={counterpartyQuery}
                onChange={(e) => {
                  setCounterpartyQuery(e.target.value);
                  setShowCounterpartySuggestions(true);
                }}
                onFocus={() => setShowCounterpartySuggestions(true)}
                placeholder="Tìm khách hàng / nhà cung cấp..."
              />
              {showCounterpartySuggestions && counterparties.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border bg-background shadow-md">
                  {counterparties.map((cp) => (
                    <button
                      key={cp.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => {
                        setCounterpartyId(cp.id);
                        setCounterpartyName(cp.name);
                        setCounterpartyQuery(cp.name);
                        setShowCounterpartySuggestions(false);
                      }}
                    >
                      <span className="font-medium">{cp.name}</span>
                      {cp.taxCode && (
                        <span className="text-muted-foreground">MST: {cp.taxCode}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-4">
              <Label>Nội dung</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Diễn giải chứng từ"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Journal lines */}
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bút toán</CardTitle>
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
                  <TableHead className="w-40 text-right">Nợ (₫)</TableHead>
                  <TableHead className="w-40 text-right">Có (₫)</TableHead>
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
                                  setActiveAccountLine(null);
                                }}
                              >
                                <span className="font-mono font-medium">{acc.code}</span>
                                <span>{acc.name}</span>
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
          <Button type="submit" disabled={createMutation.isPending || !isBalanced}>
            {createMutation.isPending ? 'Đang lưu...' : 'Lưu nháp'}
          </Button>
        </div>
      </form>
    </div>
  );
}
