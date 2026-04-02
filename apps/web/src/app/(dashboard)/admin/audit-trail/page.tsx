'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDateVN } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  changesBefore: Record<string, unknown> | null;
  changesAfter: Record<string, unknown> | null;
}

interface AuditResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

const actionLabels: Record<string, string> = { CREATE: 'Tạo', UPDATE: 'Sửa', DELETE: 'Xóa' };
const actionColors: Record<string, string> = { CREATE: 'text-green-600 bg-green-50', UPDATE: 'text-blue-600 bg-blue-50', DELETE: 'text-red-600 bg-red-50' };

export default function AuditTrailPage() {
  const [filters, setFilters] = useState({ user: '', entityType: '', action: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', '20');
  if (filters.user) params.set('user', filters.user);
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.action) params.set('action', filters.action);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);

  const { data } = useQuery<AuditResponse>({
    queryKey: ['audit-trail', filters, page],
    queryFn: () => apiClient.get(`/audit?${params.toString()}`),
  });

  const entries = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nhật ký hoạt động</h1>

      <Card>
        <CardHeader><CardTitle className="text-lg">Bộ lọc</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div>
              <Label>Người dùng</Label>
              <Input className="w-40" value={filters.user} onChange={e => setFilters(f => ({ ...f, user: e.target.value }))} placeholder="Tên/email" />
            </div>
            <div>
              <Label>Đối tượng</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.entityType} onChange={e => setFilters(f => ({ ...f, entityType: e.target.value }))}>
                <option value="">Tất cả</option>
                <option value="VOUCHER">Chứng từ</option>
                <option value="JOURNAL_ENTRY">Bút toán</option>
                <option value="ACCOUNT">Tài khoản</option>
                <option value="CUSTOMER">Khách hàng</option>
                <option value="VENDOR">Nhà cung cấp</option>
                <option value="INVENTORY">Kho hàng</option>
                <option value="FIXED_ASSET">TSCĐ</option>
                <option value="PAYROLL">Bảng lương</option>
              </select>
            </div>
            <div>
              <Label>Hành động</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
                <option value="">Tất cả</option>
                <option value="CREATE">Tạo</option>
                <option value="UPDATE">Sửa</option>
                <option value="DELETE">Xóa</option>
              </select>
            </div>
            <div><Label>Từ ngày</Label><Input type="date" className="w-40" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} /></div>
            <div><Label>Đến ngày</Label><Input type="date" className="w-40" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Người dùng</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>Đối tượng</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Chi tiết</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => (
                <TableRow key={entry.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(entry.timestamp).toLocaleString('vi-VN')}</TableCell>
                  <TableCell>{entry.userName}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-1 rounded ${actionColors[entry.action]}`}>{actionLabels[entry.action]}</span></TableCell>
                  <TableCell>{entry.entityType}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.entityId.slice(0, 8)}</TableCell>
                  <TableCell>
                    {expandedId === entry.id ? (
                      <div className="space-y-2 text-xs">
                        {entry.changesBefore && (
                          <div><span className="font-medium text-red-600">Trước:</span><pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2">{JSON.stringify(entry.changesBefore, null, 2)}</pre></div>
                        )}
                        {entry.changesAfter && (
                          <div><span className="font-medium text-green-600">Sau:</span><pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2">{JSON.stringify(entry.changesAfter, null, 2)}</pre></div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nhấn để xem</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Không có dữ liệu</TableCell></TableRow>}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">Trang {page} / {totalPages} ({total} bản ghi)</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
