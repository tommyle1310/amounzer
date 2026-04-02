'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatVND, formatDateVN } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface ArApSummary {
  id: string;
  name: string;
  taxCode: string;
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
}

interface ArApDetail {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  amount: number;
  paid: number;
  outstanding: number;
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE';
}

interface ReconciliationRow {
  counterpartyName: string;
  ourBalance: number;
  theirBalance: number;
  difference: number;
  isMatch: boolean;
}

interface AgingBucket {
  counterpartyName: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

const detailStatusLabels: Record<string, string> = { OPEN: 'Chưa TT', PARTIAL: 'TT một phần', PAID: 'Đã TT', OVERDUE: 'Quá hạn' };
const detailStatusColors: Record<string, string> = { OPEN: 'text-yellow-600 bg-yellow-50', PARTIAL: 'text-blue-600 bg-blue-50', PAID: 'text-green-600 bg-green-50', OVERDUE: 'text-red-600 bg-red-50' };

export default function ArApPage() {
  const [selectedId, setSelectedId] = useState('');
  const [detailType, setDetailType] = useState<'AR' | 'AP'>('AR');
  const [reconType, setReconType] = useState<'AR' | 'AP'>('AR');
  const [agingType, setAgingType] = useState<'AR' | 'AP'>('AR');

  const { data: arSummary = [] } = useQuery<ArApSummary[]>({
    queryKey: ['ar-summary'],
    queryFn: () => apiClient.get('/ar-ap/ar/summary'),
  });

  const { data: apSummary = [] } = useQuery<ArApSummary[]>({
    queryKey: ['ap-summary'],
    queryFn: () => apiClient.get('/ar-ap/ap/summary'),
  });

  const { data: details = [] } = useQuery<ArApDetail[]>({
    queryKey: ['ar-ap-detail', detailType, selectedId],
    queryFn: () => apiClient.get(`/ar-ap/${detailType.toLowerCase()}/detail/${selectedId}`),
    enabled: !!selectedId,
  });

  const { data: reconciliation = [] } = useQuery<ReconciliationRow[]>({
    queryKey: ['ar-ap-recon', reconType],
    queryFn: () => apiClient.get(`/ar-ap/${reconType.toLowerCase()}/reconciliation`),
  });

  const { data: aging = [] } = useQuery<AgingBucket[]>({
    queryKey: ['ar-ap-aging', agingType],
    queryFn: () => apiClient.get(`/ar-ap/${agingType.toLowerCase()}/aging`),
  });

  const SummaryTable = ({ data, type }: { data: ArApSummary[]; type: 'AR' | 'AP' }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{type === 'AR' ? 'Khách hàng' : 'Nhà cung cấp'}</TableHead>
          <TableHead>MST</TableHead>
          <TableHead className="text-right">Phát sinh</TableHead>
          <TableHead className="text-right">Đã thanh toán</TableHead>
          <TableHead className="text-right">Còn lại</TableHead>
          <TableHead className="w-16"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map(row => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="font-mono">{row.taxCode}</TableCell>
            <TableCell className="text-right">{formatVND(row.totalInvoiced)}</TableCell>
            <TableCell className="text-right">{formatVND(row.totalPaid)}</TableCell>
            <TableCell className="text-right font-medium">{formatVND(row.outstanding)}</TableCell>
            <TableCell>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedId(row.id); setDetailType(type); }}>Chi tiết</Button>
            </TableCell>
          </TableRow>
        ))}
        {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chưa có dữ liệu</TableCell></TableRow>}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Công nợ phải thu / phải trả</h1>

      <Tabs defaultValue="ar">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ar">Phải thu (AR)</TabsTrigger>
          <TabsTrigger value="ap">Phải trả (AP)</TabsTrigger>
          <TabsTrigger value="detail">Công nợ chi tiết</TabsTrigger>
          <TabsTrigger value="recon">Đối chiếu</TabsTrigger>
          <TabsTrigger value="aging">Báo cáo tuổi nợ</TabsTrigger>
        </TabsList>

        <TabsContent value="ar">
          <Card>
            <CardHeader><CardTitle className="text-lg">Phải thu khách hàng</CardTitle></CardHeader>
            <CardContent><SummaryTable data={arSummary} type="AR" /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ap">
          <Card>
            <CardHeader><CardTitle className="text-lg">Phải trả nhà cung cấp</CardTitle></CardHeader>
            <CardContent><SummaryTable data={apSummary} type="AP" /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detail">
          <Card>
            <CardHeader><CardTitle className="text-lg">Công nợ chi tiết</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 items-end">
                <div>
                  <Label>Loại</Label>
                  <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={detailType} onChange={e => { setDetailType(e.target.value as 'AR' | 'AP'); setSelectedId(''); }}>
                    <option value="AR">Phải thu</option>
                    <option value="AP">Phải trả</option>
                  </select>
                </div>
                <div>
                  <Label>{detailType === 'AR' ? 'Khách hàng' : 'Nhà cung cấp'}</Label>
                  <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                    <option value="">-- Chọn --</option>
                    {(detailType === 'AR' ? arSummary : apSummary).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              {selectedId && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Số HĐ</TableHead>
                      <TableHead>Ngày</TableHead>
                      <TableHead>Hạn TT</TableHead>
                      <TableHead className="text-right">Số tiền</TableHead>
                      <TableHead className="text-right">Đã TT</TableHead>
                      <TableHead className="text-right">Còn lại</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono">{d.invoiceNumber}</TableCell>
                        <TableCell>{formatDateVN(d.date)}</TableCell>
                        <TableCell>{formatDateVN(d.dueDate)}</TableCell>
                        <TableCell className="text-right">{formatVND(d.amount)}</TableCell>
                        <TableCell className="text-right">{formatVND(d.paid)}</TableCell>
                        <TableCell className="text-right font-medium">{formatVND(d.outstanding)}</TableCell>
                        <TableCell><span className={cn('text-xs px-2 py-1 rounded', detailStatusColors[d.status])}>{detailStatusLabels[d.status]}</span></TableCell>
                      </TableRow>
                    ))}
                    {details.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Chưa có dữ liệu</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recon">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Đối chiếu công nợ</CardTitle>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={reconType} onChange={e => setReconType(e.target.value as 'AR' | 'AP')}>
                <option value="AR">Phải thu</option>
                <option value="AP">Phải trả</option>
              </select>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Đối tượng</TableHead>
                    <TableHead className="text-right">Số dư sổ sách</TableHead>
                    <TableHead className="text-right">Số dư đối tượng</TableHead>
                    <TableHead className="text-right">Chênh lệch</TableHead>
                    <TableHead>Kết quả</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliation.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.counterpartyName}</TableCell>
                      <TableCell className="text-right">{formatVND(r.ourBalance)}</TableCell>
                      <TableCell className="text-right">{formatVND(r.theirBalance)}</TableCell>
                      <TableCell className="text-right">{formatVND(r.difference)}</TableCell>
                      <TableCell><span className={cn('text-xs px-2 py-1 rounded', r.isMatch ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50')}>{r.isMatch ? 'Khớp' : 'Lệch'}</span></TableCell>
                    </TableRow>
                  ))}
                  {reconciliation.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có dữ liệu</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aging">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Báo cáo tuổi nợ</CardTitle>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={agingType} onChange={e => setAgingType(e.target.value as 'AR' | 'AP')}>
                <option value="AR">Phải thu</option>
                <option value="AP">Phải trả</option>
              </select>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Đối tượng</TableHead>
                    <TableHead className="text-right">Chưa đến hạn</TableHead>
                    <TableHead className="text-right">1-30 ngày</TableHead>
                    <TableHead className="text-right">31-60 ngày</TableHead>
                    <TableHead className="text-right">61-90 ngày</TableHead>
                    <TableHead className="text-right">&gt;90 ngày</TableHead>
                    <TableHead className="text-right">Tổng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aging.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell>{a.counterpartyName}</TableCell>
                      <TableCell className="text-right">{formatVND(a.current)}</TableCell>
                      <TableCell className="text-right">{formatVND(a.days30)}</TableCell>
                      <TableCell className="text-right">{formatVND(a.days60)}</TableCell>
                      <TableCell className="text-right">{formatVND(a.days90)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatVND(a.over90)}</TableCell>
                      <TableCell className="text-right font-bold">{formatVND(a.total)}</TableCell>
                    </TableRow>
                  ))}
                  {aging.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Chưa có dữ liệu</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
