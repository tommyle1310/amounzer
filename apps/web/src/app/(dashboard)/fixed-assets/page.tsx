'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatVND, formatDateVN } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Play, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FixedAsset {
  id: string;
  code: string;
  name: string;
  category: string;
  acquisitionDate: string;
  originalCost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  usefulLifeMonths: number;
  depreciationMethod: 'STRAIGHT_LINE' | 'DECLINING_BALANCE';
  status: 'ACTIVE' | 'DISPOSED' | 'FULLY_DEPRECIATED';
}

interface DepreciationRecord {
  id: string;
  assetId: string;
  assetName: string;
  period: string;
  amount: number;
  accumulatedAmount: number;
  remainingValue: number;
}

const statusLabels: Record<string, string> = { ACTIVE: 'Đang sử dụng', DISPOSED: 'Đã thanh lý', FULLY_DEPRECIATED: 'Hết khấu hao' };
const statusColors: Record<string, string> = { ACTIVE: 'text-green-600 bg-green-50', DISPOSED: 'text-gray-600 bg-gray-50', FULLY_DEPRECIATED: 'text-yellow-600 bg-yellow-50' };

export default function FixedAssetsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FixedAsset | null>(null);
  const [form, setForm] = useState({ code: '', name: '', category: '', acquisitionDate: '', originalCost: '', usefulLifeMonths: '', depreciationMethod: 'STRAIGHT_LINE' });
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [showDisposeForm, setShowDisposeForm] = useState(false);
  const [disposeForm, setDisposeForm] = useState({ assetId: '', disposalDate: '', saleAmount: '', reason: '' });
  const [deprPeriod, setDeprPeriod] = useState('');

  const { data: assets = [] } = useQuery<FixedAsset[]>({
    queryKey: ['fixed-assets'],
    queryFn: () => apiClient.get('/fixed-assets'),
  });

  const { data: depreciations = [] } = useQuery<DepreciationRecord[]>({
    queryKey: ['depreciations', selectedAssetId],
    queryFn: () => apiClient.get(`/fixed-assets/${selectedAssetId}/depreciations`),
    enabled: !!selectedAssetId,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      data.id ? apiClient.patch(`/fixed-assets/${data.id}`, data) : apiClient.post('/fixed-assets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/fixed-assets/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }),
  });

  const runDepreciationMutation = useMutation({
    mutationFn: (period: string) => apiClient.post('/fixed-assets/run-depreciation', { period }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['depreciations'] });
    },
  });

  const disposeMutation = useMutation({
    mutationFn: (data: typeof disposeForm) => apiClient.post(`/fixed-assets/${data.assetId}/dispose`, {
      disposalDate: data.disposalDate,
      saleAmount: Number(data.saleAmount),
      reason: data.reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      setShowDisposeForm(false);
    },
  });

  const openEdit = (asset: FixedAsset) => {
    setEditing(asset);
    setForm({ code: asset.code, name: asset.name, category: asset.category, acquisitionDate: asset.acquisitionDate.slice(0, 10), originalCost: String(asset.originalCost), usefulLifeMonths: String(asset.usefulLifeMonths), depreciationMethod: asset.depreciationMethod });
    setShowForm(true);
  };

  const handleSave = () => {
    saveMutation.mutate({ ...form, originalCost: Number(form.originalCost), usefulLifeMonths: Number(form.usefulLifeMonths), id: editing?.id });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tài sản cố định</h1>

      <Tabs defaultValue="register">
        <TabsList>
          <TabsTrigger value="register">Danh sách TSCĐ</TabsTrigger>
          <TabsTrigger value="depreciation">Khấu hao</TabsTrigger>
          <TabsTrigger value="disposal">Thanh lý</TabsTrigger>
        </TabsList>

        <TabsContent value="register">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Sổ tài sản cố định</CardTitle>
              <Button size="sm" onClick={() => { setEditing(null); setForm({ code: '', name: '', category: '', acquisitionDate: '', originalCost: '', usefulLifeMonths: '', depreciationMethod: 'STRAIGHT_LINE' }); setShowForm(true); }}>
                <Plus className="mr-2 h-4 w-4" />Thêm TSCĐ
              </Button>
            </CardHeader>
            <CardContent>
              {showForm && (
                <div className="mb-4 rounded border p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div><Label>Mã TSCĐ</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} /></div>
                    <div><Label>Tên TSCĐ</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div><Label>Nhóm</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
                    <div><Label>Ngày mua</Label><Input type="date" value={form.acquisitionDate} onChange={e => setForm(f => ({ ...f, acquisitionDate: e.target.value }))} /></div>
                    <div><Label>Nguyên giá (₫)</Label><Input type="number" value={form.originalCost} onChange={e => setForm(f => ({ ...f, originalCost: e.target.value }))} /></div>
                    <div><Label>Thời gian KH (tháng)</Label><Input type="number" value={form.usefulLifeMonths} onChange={e => setForm(f => ({ ...f, usefulLifeMonths: e.target.value }))} /></div>
                    <div>
                      <Label>Phương pháp KH</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.depreciationMethod} onChange={e => setForm(f => ({ ...f, depreciationMethod: e.target.value }))}>
                        <option value="STRAIGHT_LINE">Đường thẳng</option>
                        <option value="DECLINING_BALANCE">Số dư giảm dần</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave}>{editing ? 'Cập nhật' : 'Lưu'}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Hủy</Button>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Tên TSCĐ</TableHead>
                    <TableHead>Nhóm</TableHead>
                    <TableHead>Ngày mua</TableHead>
                    <TableHead className="text-right">Nguyên giá (₫)</TableHead>
                    <TableHead className="text-right">KH lũy kế (₫)</TableHead>
                    <TableHead className="text-right">GTCL (₫)</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{a.category}</TableCell>
                      <TableCell>{formatDateVN(a.acquisitionDate)}</TableCell>
                      <TableCell className="text-right">{formatVND(a.originalCost)}</TableCell>
                      <TableCell className="text-right">{formatVND(a.accumulatedDepreciation)}</TableCell>
                      <TableCell className="text-right font-medium">{formatVND(a.netBookValue)}</TableCell>
                      <TableCell><span className={cn('text-xs px-2 py-1 rounded', statusColors[a.status])}>{statusLabels[a.status]}</span></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(a.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {assets.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Chưa có TSCĐ</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="depreciation">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Bảng khấu hao</CardTitle>
              <div className="flex gap-2 items-end">
                <div>
                  <Label>Kỳ (yyyy-MM)</Label>
                  <Input className="w-36" placeholder="2026-04" value={deprPeriod} onChange={e => setDeprPeriod(e.target.value)} />
                </div>
                <Button size="sm" onClick={() => runDepreciationMutation.mutate(deprPeriod)} disabled={!deprPeriod}>
                  <Play className="mr-2 h-4 w-4" />Chạy khấu hao
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Chọn tài sản</Label>
                <select className="ml-2 h-9 rounded-md border border-input bg-background px-3 text-sm" value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)}>
                  <option value="">-- Chọn TSCĐ --</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              {selectedAssetId && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kỳ</TableHead>
                      <TableHead className="text-right">Khấu hao kỳ (₫)</TableHead>
                      <TableHead className="text-right">KH lũy kế (₫)</TableHead>
                      <TableHead className="text-right">Giá trị còn lại (₫)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {depreciations.map(d => (
                      <TableRow key={d.id}>
                        <TableCell>{d.period}</TableCell>
                        <TableCell className="text-right">{formatVND(d.amount)}</TableCell>
                        <TableCell className="text-right">{formatVND(d.accumulatedAmount)}</TableCell>
                        <TableCell className="text-right">{formatVND(d.remainingValue)}</TableCell>
                      </TableRow>
                    ))}
                    {depreciations.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Chưa có dữ liệu khấu hao</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disposal">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thanh lý TSCĐ</CardTitle>
            </CardHeader>
            <CardContent>
              {!showDisposeForm ? (
                <Button size="sm" onClick={() => setShowDisposeForm(true)}>
                  <XCircle className="mr-2 h-4 w-4" />Tạo phiếu thanh lý
                </Button>
              ) : (
                <div className="rounded border p-4 space-y-3 max-w-lg">
                  <div>
                    <Label>Tài sản</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={disposeForm.assetId} onChange={e => setDisposeForm(f => ({ ...f, assetId: e.target.value }))}>
                      <option value="">-- Chọn TSCĐ --</option>
                      {assets.filter(a => a.status === 'ACTIVE').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name} (GTCL: {formatVND(a.netBookValue)} ₫)</option>)}
                    </select>
                  </div>
                  <div><Label>Ngày thanh lý</Label><Input type="date" value={disposeForm.disposalDate} onChange={e => setDisposeForm(f => ({ ...f, disposalDate: e.target.value }))} /></div>
                  <div><Label>Số tiền thu được (₫)</Label><Input type="number" value={disposeForm.saleAmount} onChange={e => setDisposeForm(f => ({ ...f, saleAmount: e.target.value }))} /></div>
                  <div><Label>Lý do</Label><Input value={disposeForm.reason} onChange={e => setDisposeForm(f => ({ ...f, reason: e.target.value }))} /></div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => disposeMutation.mutate(disposeForm)}>Thanh lý</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowDisposeForm(false)}>Hủy</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
