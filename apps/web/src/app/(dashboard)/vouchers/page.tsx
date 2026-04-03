'use client';

import { useState } from 'react';
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

export default function VouchersPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const queryParams = new URLSearchParams();
  if (typeFilter) queryParams.set('type', typeFilter);
  if (statusFilter) queryParams.set('status', statusFilter);
  if (dateFrom) queryParams.set('dateFrom', dateFrom);
  if (dateTo) queryParams.set('dateTo', dateTo);

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
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Số chứng từ</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Đối tượng</TableHead>
                <TableHead>Nội dung</TableHead>
                <TableHead className="text-right">Số tiền (₫)</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
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
                    <TableCell className="font-medium">{v.voucherNumber}</TableCell>
                    <TableCell>{VOUCHER_TYPE_LABELS[v.voucherType]?.vi ?? v.voucherType}</TableCell>
                    <TableCell>{formatDateVN(v.date)}</TableCell>
                    <TableCell>{v.counterpartyName ?? '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{v.description}</TableCell>
                    <TableCell className="text-right font-mono">{formatVND(v.totalAmount)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[v.status] ?? ''}`}
                      >
                        {statusLabels[v.status] ?? v.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
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
