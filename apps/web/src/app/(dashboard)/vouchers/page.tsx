'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatVND, formatDateVN, VOUCHER_TYPE_LABELS, type VoucherTypeCode } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, BookCheck, Eye, CheckCircle, XCircle } from 'lucide-react';

interface Voucher {
  id: string;
  voucherNumber: string;
  voucherType: VoucherTypeCode;
  date: string;
  counterpartyName: string | null;
  description: string;
  totalAmount: number;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
}

interface VouchersResponse {
  data: Voucher[];
  total: number;
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Nháp',
  POSTED: 'Đã ghi sổ',
  CANCELLED: 'Đã hủy',
};

const statusColors: Record<string, string> = {
  DRAFT: 'text-yellow-600 bg-yellow-50',
  POSTED: 'text-green-600 bg-green-50',
  CANCELLED: 'text-red-600 bg-red-50',
};

// Column definitions with default widths
const defaultColumnWidths: Record<string, number> = {
  voucherNumber: 140,
  voucherType: 100,
  date: 100,
  counterparty: 180,
  description: 200,
  amount: 140,
  status: 100,
  actions: 100,
};

export default function VouchersPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Column resize state
  const [columnWidths, setColumnWidths] = useState(defaultColumnWidths);
  const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);

  // Handle column resize
  const handleResizeStart = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = {
      column,
      startX: e.clientX,
      startWidth: columnWidths[column] ?? 100,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = moveEvent.clientX - resizingRef.current.startX;
      const newWidth = Math.max(50, resizingRef.current.startWidth + diff);
      setColumnWidths((prev) => ({
        ...prev,
        [resizingRef.current!.column]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  const queryParams = new URLSearchParams();
  if (typeFilter) queryParams.set('voucherType', typeFilter);
  if (statusFilter) queryParams.set('status', statusFilter);
  if (dateFrom) queryParams.set('startDate', dateFrom);
  if (dateTo) queryParams.set('endDate', dateTo);

  const { data, isLoading } = useQuery<VouchersResponse>({
    queryKey: ['vouchers', typeFilter, statusFilter, dateFrom, dateTo],
    queryFn: () => apiClient.get(`/vouchers?${queryParams.toString()}`),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/vouchers/${id}/post`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vouchers'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/vouchers/${id}/void`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vouchers'] }),
  });

  const bulkPostMutation = useMutation({
    mutationFn: () => {
      // Get all DRAFT voucher IDs from current data
      const draftIds = vouchers.filter((v) => v.status === 'DRAFT').map((v) => v.id);
      if (draftIds.length === 0) {
        return Promise.reject(new Error('Không có chứng từ nháp'));
      }
      return apiClient.post('/vouchers/batch-post', { ids: draftIds });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vouchers'] }),
  });

  const vouchers = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chứng từ</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => bulkPostMutation.mutate()}>
            <BookCheck className="mr-2 h-4 w-4" />
            Ghi sổ hàng loạt
          </Button>
          <Button variant="outline" asChild>
            <Link href="/vouchers/ctgs">
              <Plus className="mr-2 h-4 w-4" />
              Chứng từ ghi sổ
            </Link>
          </Button>
          <Button asChild>
            <Link href="/vouchers/new">
              <Plus className="mr-2 h-4 w-4" />
              Tạo mới
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Tất cả loại</option>
            <option value="PT">PT - Phiếu thu</option>
            <option value="PC">PC - Phiếu chi</option>
            <option value="BDN">BDN - Giấy báo nợ</option>
            <option value="BCN">BCN - Giấy báo có</option>
            <option value="BT">BT - Chuyển khoản</option>
            <option value="CTGS">CTGS - Chứng từ ghi sổ</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="POSTED">Đã ghi sổ</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
          <Input
            type="date"
            className="w-40"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="Từ ngày"
          />
          <Input
            type="date"
            className="w-40"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="Đến ngày"
          />
        </CardContent>
      </Card>

      {/* Data table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table style={{ tableLayout: 'fixed', width: Object.values(columnWidths).reduce((a, b) => a + b, 0) }}>
            <TableHeader>
              <TableRow>
                <TableHead className="relative" style={{ width: columnWidths.voucherNumber }}>
                  Số chứng từ
                  <div
                    className="absolute inset-y-0 right-0 w-1 cursor-col-resize select-none hover:bg-primary/50 z-10"
                    onMouseDown={(e) => handleResizeStart('voucherNumber', e)}
                  />
                </TableHead>
                <TableHead className="relative" style={{ width: columnWidths.voucherType }}>
                  Loại
                  <div
                    className="absolute inset-y-0 right-0 w-1 cursor-col-resize select-none hover:bg-primary/50 z-10"
                    onMouseDown={(e) => handleResizeStart('voucherType', e)}
                  />
                </TableHead>
                <TableHead className="relative" style={{ width: columnWidths.date }}>
                  Ngày
                  <div
                    className="absolute inset-y-0 right-0 w-1 cursor-col-resize select-none hover:bg-primary/50 z-10"
                    onMouseDown={(e) => handleResizeStart('date', e)}
                  />
                </TableHead>
                <TableHead className="relative" style={{ width: columnWidths.counterparty }}>
                  Đối tượng
                  <div
                    className="absolute inset-y-0 right-0 w-1 cursor-col-resize select-none hover:bg-primary/50 z-10"
                    onMouseDown={(e) => handleResizeStart('counterparty', e)}
                  />
                </TableHead>
                <TableHead className="relative" style={{ width: columnWidths.description }}>
                  Nội dung
                  <div
                    className="absolute inset-y-0 right-0 w-1 cursor-col-resize select-none hover:bg-primary/50 z-10"
                    onMouseDown={(e) => handleResizeStart('description', e)}
                  />
                </TableHead>
                <TableHead className="relative text-right" style={{ width: columnWidths.amount }}>
                  Số tiền (₫)
                  <div
                    className="absolute inset-y-0 right-0 w-1 cursor-col-resize select-none hover:bg-primary/50 z-10"
                    onMouseDown={(e) => handleResizeStart('amount', e)}
                  />
                </TableHead>
                <TableHead className="relative" style={{ width: columnWidths.status }}>
                  Trạng thái
                  <div
                    className="absolute inset-y-0 right-0 w-1 cursor-col-resize select-none hover:bg-primary/50 z-10"
                    onMouseDown={(e) => handleResizeStart('status', e)}
                  />
                </TableHead>
                <TableHead className="text-right" style={{ width: columnWidths.actions }}>
                  Thao tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : vouchers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Chưa có chứng từ nào
                  </TableCell>
                </TableRow>
              ) : (
                vouchers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium truncate" style={{ width: columnWidths.voucherNumber }}>{v.voucherNumber}</TableCell>
                    <TableCell className="truncate" style={{ width: columnWidths.voucherType }}>{VOUCHER_TYPE_LABELS[v.voucherType]?.vi ?? v.voucherType}</TableCell>
                    <TableCell className="truncate" style={{ width: columnWidths.date }}>{formatDateVN(v.date)}</TableCell>
                    <TableCell className="truncate" style={{ width: columnWidths.counterparty }}>{v.counterpartyName ?? '—'}</TableCell>
                    <TableCell className="truncate" style={{ width: columnWidths.description }}>{v.description}</TableCell>
                    <TableCell className="text-right font-mono truncate" style={{ width: columnWidths.amount }}>{formatVND(v.totalAmount)}</TableCell>
                    <TableCell style={{ width: columnWidths.status }}>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[v.status] ?? ''}`}
                      >
                        {statusLabels[v.status] ?? v.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right" style={{ width: columnWidths.actions }}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/vouchers/${v.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {v.status === 'DRAFT' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => postMutation.mutate(v.id)}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => cancelMutation.mutate(v.id)}
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
