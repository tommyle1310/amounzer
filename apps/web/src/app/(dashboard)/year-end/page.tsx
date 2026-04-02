'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatVND, formatDateVN } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Lock, Unlock, ArrowRight, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  key: string;
  label: string;
  passed: boolean;
  message: string;
}

interface ClosingEntry {
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
}

interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
}

export default function YearEndPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: checklist = [] } = useQuery<ChecklistItem[]>({
    queryKey: ['year-end-checklist', selectedYear],
    queryFn: () => apiClient.get(`/year-end-closing/${selectedYear}/checklist`),
    enabled: step >= 2,
  });

  const { data: closingEntries = [] } = useQuery<ClosingEntry[]>({
    queryKey: ['closing-entries-preview', selectedYear],
    queryFn: () => apiClient.get(`/year-end-closing/${selectedYear}/preview`),
    enabled: step >= 3,
  });

  const { data: periods = [] } = useQuery<FiscalPeriod[]>({
    queryKey: ['fiscal-periods'],
    queryFn: () => apiClient.get('/year-end-closing/periods'),
  });

  const closeMutation = useMutation({
    mutationFn: () => apiClient.post(`/year-end-closing/${selectedYear}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] });
      setStep(1);
    },
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/year-end-closing/periods/${id}/lock`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] }),
  });

  const unlockMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/year-end-closing/periods/${id}/unlock`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] }),
  });

  const carryForwardMutation = useMutation({
    mutationFn: () => apiClient.post(`/year-end-closing/${selectedYear}/carry-forward`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] }),
  });

  const allPassed = checklist.length > 0 && checklist.every(c => c.passed);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Khóa sổ cuối năm</h1>

      {/* Steps wizard */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => setStep(s)}
              className={cn('flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium', step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}
            >
              {s}
            </button>
            {s < 4 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Bước 1: Chọn năm tài chính</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <div>
                <Label>Năm tài chính</Label>
                <Input type="number" className="w-32" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
              </div>
              <Button onClick={() => setStep(2)}>Tiếp theo</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Bước 2: Bảng kiểm tra trước khóa sổ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {checklist.map(item => (
              <div key={item.key} className="flex items-center gap-3 rounded border p-3">
                {item.passed ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" /> : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                </div>
              </div>
            ))}
            {checklist.length === 0 && <p className="text-sm text-muted-foreground">Đang tải...</p>}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Quay lại</Button>
              <Button onClick={() => setStep(3)} disabled={!allPassed}>Tiếp theo</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Bước 3: Xem trước bút toán kết chuyển</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tài khoản</TableHead>
                  <TableHead>Tên TK</TableHead>
                  <TableHead>Diễn giải</TableHead>
                  <TableHead className="text-right">Nợ (₫)</TableHead>
                  <TableHead className="text-right">Có (₫)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closingEntries.map((entry, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{entry.accountCode}</TableCell>
                    <TableCell>{entry.accountName}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell className="text-right">{entry.debit ? formatVND(entry.debit) : ''}</TableCell>
                    <TableCell className="text-right">{entry.credit ? formatVND(entry.credit) : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Quay lại</Button>
              <Button onClick={() => setStep(4)}>Tiếp theo</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Bước 4: Xác nhận & Khóa sổ</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded border border-yellow-300 bg-yellow-50 p-4">
              <p className="text-sm font-medium text-yellow-800">Cảnh báo: Thao tác này sẽ khóa sổ năm {selectedYear} và tạo bút toán kết chuyển. Bạn không thể hoàn tác.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>Quay lại</Button>
              <Button variant="destructive" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
                <Lock className="mr-2 h-4 w-4" />Xác nhận khóa sổ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period lock/unlock table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Quản lý kỳ kế toán</CardTitle>
          <Button size="sm" variant="outline" onClick={() => carryForwardMutation.mutate()}>Kết chuyển sang năm mới</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kỳ</TableHead>
                <TableHead>Từ ngày</TableHead>
                <TableHead>Đến ngày</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{formatDateVN(p.startDate)}</TableCell>
                  <TableCell>{formatDateVN(p.endDate)}</TableCell>
                  <TableCell>
                    <span className={cn('text-xs px-2 py-1 rounded', p.isLocked ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50')}>
                      {p.isLocked ? 'Đã khóa' : 'Mở'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => p.isLocked ? unlockMutation.mutate(p.id) : lockMutation.mutate(p.id)}>
                      {p.isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {periods.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có kỳ kế toán</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
