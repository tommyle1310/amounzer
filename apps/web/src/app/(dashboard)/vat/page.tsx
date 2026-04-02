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
import { Plus, Pencil, Trash2, Calculator, FileCheck, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VatRecord {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  counterpartyName: string;
  counterpartyTaxCode: string;
  description: string;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  type: 'INPUT' | 'OUTPUT';
}

interface VatComputation {
  period: string;
  outputVat: number;
  inputVat: number;
  payable: number;
  refundable: number;
}

interface VatReconciliation {
  type: string;
  vatRecordsTotal: number;
  accountBalance: number;
  difference: number;
  isMatch: boolean;
}

export default function VatPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<VatRecord | null>(null);
  const [formType, setFormType] = useState<'INPUT' | 'OUTPUT'>('INPUT');
  const [form, setForm] = useState({ invoiceNumber: '', invoiceDate: '', counterpartyName: '', counterpartyTaxCode: '', description: '', netAmount: '', vatRate: '10' });
  const [computePeriod, setComputePeriod] = useState('');
  const [reconPeriod, setReconPeriod] = useState('');

  const { data: inputRecords = [] } = useQuery<VatRecord[]>({
    queryKey: ['vat-records', 'INPUT'],
    queryFn: () => apiClient.get('/vat/records?type=INPUT'),
  });

  const { data: outputRecords = [] } = useQuery<VatRecord[]>({
    queryKey: ['vat-records', 'OUTPUT'],
    queryFn: () => apiClient.get('/vat/records?type=OUTPUT'),
  });

  const { data: computation } = useQuery<VatComputation>({
    queryKey: ['vat-computation', computePeriod],
    queryFn: () => apiClient.get(`/vat/compute?period=${computePeriod}`),
    enabled: !!computePeriod,
  });

  const { data: reconciliation = [] } = useQuery<VatReconciliation[]>({
    queryKey: ['vat-reconciliation', reconPeriod],
    queryFn: () => apiClient.get(`/vat/reconcile?period=${reconPeriod}`),
    enabled: !!reconPeriod,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      data.id ? apiClient.patch(`/vat/records/${data.id}`, data) : apiClient.post('/vat/records', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vat-records'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/vat/records/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vat-records'] }),
  });

  const exportMutation = useMutation({
    mutationFn: (period: string) => apiClient.post<Blob>(`/vat/export-xml?period=${period}`),
  });

  const openAdd = (type: 'INPUT' | 'OUTPUT') => {
    setFormType(type);
    setEditing(null);
    setForm({ invoiceNumber: '', invoiceDate: '', counterpartyName: '', counterpartyTaxCode: '', description: '', netAmount: '', vatRate: '10' });
    setShowForm(true);
  };

  const openEdit = (record: VatRecord) => {
    setEditing(record);
    setFormType(record.type);
    setForm({ invoiceNumber: record.invoiceNumber, invoiceDate: record.invoiceDate.slice(0, 10), counterpartyName: record.counterpartyName, counterpartyTaxCode: record.counterpartyTaxCode, description: record.description, netAmount: String(record.netAmount), vatRate: String(record.vatRate) });
    setShowForm(true);
  };

  const handleSave = () => {
    saveMutation.mutate({ ...form, type: formType, netAmount: Number(form.netAmount), vatRate: Number(form.vatRate), vatAmount: Number(form.netAmount) * Number(form.vatRate) / 100, id: editing?.id });
  };

  const VatTable = ({ records, type }: { records: VatRecord[]; type: 'INPUT' | 'OUTPUT' }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{type === 'INPUT' ? 'Sổ VAT đầu vào' : 'Sổ VAT đầu ra'}</CardTitle>
        <Button size="sm" onClick={() => openAdd(type)}><Plus className="mr-2 h-4 w-4" />Thêm</Button>
      </CardHeader>
      <CardContent>
        {showForm && formType === type && (
          <div className="mb-4 rounded border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><Label>Số hóa đơn</Label><Input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} /></div>
              <div><Label>Ngày hóa đơn</Label><Input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} /></div>
              <div><Label>Đối tượng</Label><Input value={form.counterpartyName} onChange={e => setForm(f => ({ ...f, counterpartyName: e.target.value }))} /></div>
              <div><Label>MST</Label><Input value={form.counterpartyTaxCode} onChange={e => setForm(f => ({ ...f, counterpartyTaxCode: e.target.value }))} /></div>
              <div><Label>Diễn giải</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><Label>Giá trước thuế (₫)</Label><Input type="number" value={form.netAmount} onChange={e => setForm(f => ({ ...f, netAmount: e.target.value }))} /></div>
              <div>
                <Label>Thuế suất (%)</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.vatRate} onChange={e => setForm(f => ({ ...f, vatRate: e.target.value }))}>
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="8">8%</option>
                  <option value="10">10%</option>
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
              <TableHead>Số HĐ</TableHead>
              <TableHead>Ngày</TableHead>
              <TableHead>Đối tượng</TableHead>
              <TableHead>MST</TableHead>
              <TableHead>Diễn giải</TableHead>
              <TableHead className="text-right">Giá trước thuế</TableHead>
              <TableHead className="text-right">Thuế suất</TableHead>
              <TableHead className="text-right">Tiền thuế</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.invoiceNumber}</TableCell>
                <TableCell>{formatDateVN(r.invoiceDate)}</TableCell>
                <TableCell>{r.counterpartyName}</TableCell>
                <TableCell className="font-mono">{r.counterpartyTaxCode}</TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell className="text-right">{formatVND(r.netAmount)}</TableCell>
                <TableCell className="text-right">{r.vatRate}%</TableCell>
                <TableCell className="text-right font-medium">{formatVND(r.vatAmount)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {records.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Chưa có dữ liệu</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Quản lý thuế GTGT</h1>

      <Tabs defaultValue="input">
        <TabsList className="flex-wrap">
          <TabsTrigger value="input">Sổ VAT đầu vào</TabsTrigger>
          <TabsTrigger value="output">Sổ VAT đầu ra</TabsTrigger>
          <TabsTrigger value="compute">Tính thuế</TabsTrigger>
          <TabsTrigger value="reconcile">Đối chiếu</TabsTrigger>
          <TabsTrigger value="export">Xuất XML HTKK</TabsTrigger>
        </TabsList>

        <TabsContent value="input"><VatTable records={inputRecords} type="INPUT" /></TabsContent>
        <TabsContent value="output"><VatTable records={outputRecords} type="OUTPUT" /></TabsContent>

        <TabsContent value="compute">
          <Card>
            <CardHeader><CardTitle className="text-lg">Tính thuế GTGT</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3">
                <div><Label>Kỳ tính thuế (yyyy-MM)</Label><Input className="w-40" placeholder="2026-04" value={computePeriod} onChange={e => setComputePeriod(e.target.value)} /></div>
                <Button size="sm"><Calculator className="mr-2 h-4 w-4" />Tính</Button>
              </div>
              {computation && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Thuế đầu ra</p><p className="text-xl font-bold">{formatVND(computation.outputVat)} ₫</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Thuế đầu vào</p><p className="text-xl font-bold">{formatVND(computation.inputVat)} ₫</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Thuế phải nộp</p><p className="text-xl font-bold text-red-600">{formatVND(computation.payable)} ₫</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Thuế được hoàn</p><p className="text-xl font-bold text-green-600">{formatVND(computation.refundable)} ₫</p></CardContent></Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconcile">
          <Card>
            <CardHeader><CardTitle className="text-lg">Đối chiếu VAT</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3">
                <div><Label>Kỳ (yyyy-MM)</Label><Input className="w-40" placeholder="2026-04" value={reconPeriod} onChange={e => setReconPeriod(e.target.value)} /></div>
                <Button size="sm"><FileCheck className="mr-2 h-4 w-4" />Đối chiếu</Button>
              </div>
              {reconciliation.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loại</TableHead>
                      <TableHead className="text-right">Sổ VAT</TableHead>
                      <TableHead className="text-right">Số dư TK</TableHead>
                      <TableHead className="text-right">Chênh lệch</TableHead>
                      <TableHead>Kết quả</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliation.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.type}</TableCell>
                        <TableCell className="text-right">{formatVND(r.vatRecordsTotal)}</TableCell>
                        <TableCell className="text-right">{formatVND(r.accountBalance)}</TableCell>
                        <TableCell className="text-right">{formatVND(r.difference)}</TableCell>
                        <TableCell><span className={cn('text-xs px-2 py-1 rounded', r.isMatch ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50')}>{r.isMatch ? 'Khớp' : 'Lệch'}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader><CardTitle className="text-lg">Xuất XML HTKK</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Xuất file XML theo định dạng HTKK để nộp tờ khai thuế GTGT.</p>
              <div className="flex items-end gap-3">
                <div><Label>Kỳ (yyyy-MM)</Label><Input className="w-40" placeholder="2026-04" value={computePeriod} onChange={e => setComputePeriod(e.target.value)} /></div>
                <Button size="sm" onClick={() => exportMutation.mutate(computePeriod)}>
                  <Download className="mr-2 h-4 w-4" />Xuất XML
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
