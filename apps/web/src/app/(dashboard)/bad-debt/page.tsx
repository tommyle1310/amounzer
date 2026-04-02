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
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BadDebtProvision {
  id: string;
  customerName: string;
  amount: number;
  reason: string;
  status: 'PROVISIONED' | 'REVERSED' | 'WRITTEN_OFF';
  provisionDate: string;
  dueDate: string;
}

interface BadDebtSummary {
  opening: number;
  additions: number;
  reversals: number;
  writeOffs: number;
  closing: number;
}

const statusLabels: Record<string, string> = { PROVISIONED: 'Đã trích lập', REVERSED: 'Đã hoàn nhập', WRITTEN_OFF: 'Đã xoá sổ' };
const statusColors: Record<string, string> = { PROVISIONED: 'text-yellow-600 bg-yellow-50', REVERSED: 'text-green-600 bg-green-50', WRITTEN_OFF: 'text-red-600 bg-red-50' };

export default function BadDebtPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerName: '', amount: '', reason: '', dueDate: '' });

  const { data: provisions = [] } = useQuery<BadDebtProvision[]>({
    queryKey: ['bad-debt-provisions'],
    queryFn: () => apiClient.get('/bad-debt/provisions'),
  });

  const { data: summary } = useQuery<BadDebtSummary>({
    queryKey: ['bad-debt-summary'],
    queryFn: () => apiClient.get('/bad-debt/summary'),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiClient.post('/bad-debt/provisions', { ...data, amount: Number(data.amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bad-debt'] });
      setShowForm(false);
      setForm({ customerName: '', amount: '', reason: '', dueDate: '' });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/bad-debt/provisions/${id}/reverse`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bad-debt'] }),
  });

  const writeOffMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/bad-debt/provisions/${id}/write-off`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bad-debt'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dự phòng nợ xấu</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />Tạo dự phòng
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Đầu kỳ</p><p className="text-lg font-bold">{formatVND(summary.opening)} ₫</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Trích lập thêm</p><p className="text-lg font-bold text-yellow-600">{formatVND(summary.additions)} ₫</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Hoàn nhập</p><p className="text-lg font-bold text-green-600">{formatVND(summary.reversals)} ₫</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Xoá sổ</p><p className="text-lg font-bold text-red-600">{formatVND(summary.writeOffs)} ₫</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Cuối kỳ</p><p className="text-lg font-bold">{formatVND(summary.closing)} ₫</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {showForm && (
            <div className="mb-4 rounded border p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><Label>Khách hàng</Label><Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} /></div>
                <div><Label>Số tiền (₫)</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div><Label>Lý do</Label><Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></div>
                <div><Label>Ngày đáo hạn</Label><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createMutation.mutate(form)}>Tạo dự phòng</Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Hủy</Button>
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khách hàng</TableHead>
                <TableHead className="text-right">Số tiền (₫)</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày trích lập</TableHead>
                <TableHead>Ngày đáo hạn</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {provisions.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.customerName}</TableCell>
                  <TableCell className="text-right font-medium">{formatVND(p.amount)}</TableCell>
                  <TableCell>{p.reason}</TableCell>
                  <TableCell><span className={cn('text-xs px-2 py-1 rounded', statusColors[p.status])}>{statusLabels[p.status]}</span></TableCell>
                  <TableCell>{formatDateVN(p.provisionDate)}</TableCell>
                  <TableCell>{formatDateVN(p.dueDate)}</TableCell>
                  <TableCell>
                    {p.status === 'PROVISIONED' && (
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => reverseMutation.mutate(p.id)} title="Hoàn nhập">
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => writeOffMutation.mutate(p.id)} title="Xoá sổ">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {provisions.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Chưa có dữ liệu</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
