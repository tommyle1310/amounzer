'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatVND } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Plus, Trash2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Account {
  id: string;
  code: string;
  name: string;
}

interface JournalLine {
  accountId: string;
  accountSearch: string;
  description: string;
  debit: string;
  credit: string;
}

const emptyLine = (): JournalLine => ({ accountId: '', accountSearch: '', description: '', debit: '', credit: '' });

export default function NewJournalEntryPage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [entryType, setEntryType] = useState('GENERAL');
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts-flat'],
    queryFn: () => apiClient.get('/chart-of-accounts/flat'),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.post('/journal-entries', body),
    onSuccess: () => router.push('/journal-entries'),
  });

  const updateLine = (index: number, field: keyof JournalLine, value: string) => {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0), [lines]);
  const balance = totalDebit - totalCredit;
  const isBalanced = Math.abs(balance) < 0.01;

  const getFilteredAccounts = (search: string) => {
    if (!search) return [];
    const lower = search.toLowerCase();
    return accounts.filter(a => a.code.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower)).slice(0, 8);
  };

  const selectAccount = (index: number, account: Account) => {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, accountId: account.id, accountSearch: `${account.code} - ${account.name}` } : l));
  };

  const handleSubmit = () => {
    createMutation.mutate({
      date,
      description,
      entryType,
      lines: lines.filter(l => l.accountId).map(l => ({
        accountId: l.accountId,
        description: l.description,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      })),
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tạo bút toán mới</h1>

      <Card>
        <CardHeader><CardTitle className="text-lg">Thông tin chung</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div><Label>Ngày</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><Label>Diễn giải</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Nội dung bút toán" /></div>
            <div>
              <Label>Loại</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={entryType} onChange={e => setEntryType(e.target.value)}>
                <option value="GENERAL">Bút toán chung</option>
                <option value="ADJUSTMENT">Điều chỉnh</option>
                <option value="CLOSING">Kết chuyển</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Dòng bút toán</CardTitle>
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="mr-2 h-4 w-4" />Thêm dòng</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Tài khoản</TableHead>
                <TableHead>Diễn giải</TableHead>
                <TableHead className="w-40 text-right">Nợ (₫)</TableHead>
                <TableHead className="w-40 text-right">Có (₫)</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="relative">
                      <Input
                        value={line.accountSearch}
                        onChange={e => {
                          updateLine(i, 'accountSearch', e.target.value);
                          updateLine(i, 'accountId', '');
                        }}
                        placeholder="Nhập mã/tên TK..."
                      />
                      {line.accountSearch && !line.accountId && (
                        <div className="absolute z-10 mt-1 w-full rounded border bg-background shadow-lg max-h-48 overflow-auto">
                          {getFilteredAccounts(line.accountSearch).map(acc => (
                            <button key={acc.id} className="w-full px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => selectAccount(i, acc)}>
                              <span className="font-mono">{acc.code}</span> — {acc.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Diễn giải dòng" /></TableCell>
                  <TableCell><Input type="number" className="text-right" value={line.debit} onChange={e => { updateLine(i, 'debit', e.target.value); if (e.target.value) updateLine(i, 'credit', ''); }} placeholder="0" /></TableCell>
                  <TableCell><Input type="number" className="text-right" value={line.credit} onChange={e => { updateLine(i, 'credit', e.target.value); if (e.target.value) updateLine(i, 'debit', ''); }} placeholder="0" /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(i)} disabled={lines.length <= 2}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="text-right font-medium">Tổng cộng</TableCell>
                <TableCell className="text-right font-bold">{formatVND(totalDebit)}</TableCell>
                <TableCell className="text-right font-bold">{formatVND(totalCredit)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className={cn('text-sm font-medium', isBalanced ? 'text-green-600' : 'text-red-600')}>
            {isBalanced ? '✓ Cân bằng' : `✗ Chênh lệch: ${formatVND(Math.abs(balance))} ₫`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/journal-entries')}>Hủy</Button>
            <Button onClick={handleSubmit} disabled={!isBalanced || createMutation.isPending || lines.every(l => !l.accountId)}>
              <Save className="mr-2 h-4 w-4" />Lưu nháp
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
