'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatVND, formatDateVN } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Eye, BookCheck, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  status: 'DRAFT' | 'POSTED';
  fiscalYear: number;
}

interface JournalListResponse {
  data: JournalEntry[];
  total: number;
}

const statusLabels: Record<string, string> = { DRAFT: 'Nháp', POSTED: 'Đã ghi sổ' };
const statusColors: Record<string, string> = { DRAFT: 'text-yellow-600 bg-yellow-50', POSTED: 'text-green-600 bg-green-50' };

export default function JournalEntriesPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ fiscalYear: String(new Date().getFullYear()), status: '', dateFrom: '', dateTo: '' });

  const params = new URLSearchParams();
  if (filters.fiscalYear) params.set('fiscalYear', filters.fiscalYear);
  if (filters.status) params.set('status', filters.status);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);

  const { data } = useQuery<JournalListResponse>({
    queryKey: ['journal-entries', filters],
    queryFn: () => apiClient.get(`/journal-entries?${params.toString()}`),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/journal-entries/${id}/post`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['journal-entries'] }),
  });

  const correctMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/journal-entries/${id}/correct`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['journal-entries'] }),
  });

  const entries = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bút toán</h1>
        <Button asChild>
          <Link href="/journal-entries/new"><Plus className="mr-2 h-4 w-4" />Tạo bút toán</Link>
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Bộ lọc</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div><Label>Năm tài chính</Label><Input type="number" className="w-28" value={filters.fiscalYear} onChange={e => setFilters(f => ({ ...f, fiscalYear: e.target.value }))} /></div>
            <div>
              <Label>Trạng thái</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="">Tất cả</option>
                <option value="DRAFT">Nháp</option>
                <option value="POSTED">Đã ghi sổ</option>
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
                <TableHead>Số bút toán</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Diễn giải</TableHead>
                <TableHead className="text-right">Tổng Nợ (₫)</TableHead>
                <TableHead className="text-right">Tổng Có (₫)</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono">{entry.entryNumber}</TableCell>
                  <TableCell>{formatDateVN(entry.date)}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell className="text-right">{formatVND(entry.totalDebit)}</TableCell>
                  <TableCell className="text-right">{formatVND(entry.totalCredit)}</TableCell>
                  <TableCell><span className={cn('text-xs px-2 py-1 rounded', statusColors[entry.status])}>{statusLabels[entry.status]}</span></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <Link href={`/journal-entries/${entry.id}`}><Eye className="h-3 w-3" /></Link>
                      </Button>
                      {entry.status === 'DRAFT' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => postMutation.mutate(entry.id)} title="Ghi sổ">
                          <BookCheck className="h-3 w-3" />
                        </Button>
                      )}
                      {entry.status === 'POSTED' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => correctMutation.mutate(entry.id)} title="Sửa lỗi">
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Chưa có bút toán</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
