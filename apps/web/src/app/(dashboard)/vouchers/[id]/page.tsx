'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatVND, formatDateVN, VOUCHER_TYPE_LABELS, type VoucherTypeCode } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, BookCheck, XCircle, Printer, Edit } from 'lucide-react';

interface JournalLine {
  id: string;
  lineOrder: number;
  description: string | null;
  debitAmount: number;
  creditAmount: number;
  account: { id: string; code: string; name: string };
  customer?: { id: string; code: string; name: string } | null;
  vendor?: { id: string; code: string; name: string } | null;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  postingDate: string;
  status: string;
  lines: JournalLine[];
}

interface VoucherDetail {
  id: string;
  voucherNumber: string;
  voucherType: VoucherTypeCode;
  date: string;
  counterpartyName: string | null;
  counterpartyId: string | null;
  counterpartyType: string | null;
  description: string;
  totalAmount: number;
  status: 'DRAFT' | 'POSTED' | 'VOIDED';
  postedAt: string | null;
  journalEntry: JournalEntry | null;
  createdAt: string;
  updatedAt: string;
  // Legal fields (TT200/TT133)
  voucherBookNo?: string | null;
  partyFullName?: string | null;
  partyAddress?: string | null;
  partyIdNumber?: string | null;
  amountInWords?: string | null;
  currency?: string | null;
  originalAmount?: number | null;
  exchangeRate?: number | null;
  attachmentCount?: number | null;
  originalDocRefs?: string | null;
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Nháp',
  POSTED: 'Đã ghi sổ',
  VOIDED: 'Đã hủy',
};

const statusColors: Record<string, string> = {
  DRAFT: 'text-yellow-600 bg-yellow-50',
  POSTED: 'text-green-600 bg-green-50',
  VOIDED: 'text-red-600 bg-red-50',
};

export default function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: voucher, isLoading, error } = useQuery<VoucherDetail>({
    queryKey: ['voucher', id],
    queryFn: () => apiClient.get(`/vouchers/${id}`),
  });

  const postMutation = useMutation({
    mutationFn: () => apiClient.post(`/vouchers/${id}/post`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voucher', id] });
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
    },
  });

  const voidMutation = useMutation({
    mutationFn: () => apiClient.post(`/vouchers/${id}/void`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voucher', id] });
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    );
  }

  if (error || !voucher) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/vouchers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
        <div className="flex h-64 items-center justify-center">
          <div className="text-destructive">Không tìm thấy chứng từ</div>
        </div>
      </div>
    );
  }

  const totalDebit = voucher.journalEntry?.lines.reduce((sum, l) => sum + l.debitAmount, 0) ?? 0;
  const totalCredit = voucher.journalEntry?.lines.reduce((sum, l) => sum + l.creditAmount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/vouchers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{voucher.voucherNumber}</h1>
            <p className="text-muted-foreground">
              {VOUCHER_TYPE_LABELS[voucher.voucherType]?.vi ?? voucher.voucherType}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusColors[voucher.status] ?? ''}`}
        >
          {statusLabels[voucher.status] ?? voucher.status}
        </span>
      </div>

      {/* Error messages */}
      {postMutation.isError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {postMutation.error instanceof Error ? postMutation.error.message : 'Lỗi ghi sổ'}
        </div>
      )}
      {voidMutation.isError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {voidMutation.error instanceof Error ? voidMutation.error.message : 'Lỗi hủy chứng từ'}
        </div>
      )}

      {/* Voucher info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Thông tin chứng từ</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Ngày chứng từ</dt>
              <dd className="text-sm">{formatDateVN(voucher.date)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Đối tượng</dt>
              <dd className="text-sm">{voucher.counterpartyName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Số tiền</dt>
              <dd className="text-sm font-mono font-medium">{formatVND(voucher.totalAmount)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Ngày tạo</dt>
              <dd className="text-sm">{formatDateVN(voucher.createdAt)}</dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-sm font-medium text-muted-foreground">Nội dung</dt>
              <dd className="text-sm">{voucher.description}</dd>
            </div>
            {voucher.postedAt && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Ngày ghi sổ</dt>
                <dd className="text-sm">{formatDateVN(voucher.postedAt)}</dd>
              </div>
            )}
            {voucher.partyFullName && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">Họ tên người {voucher.voucherType === 'PT' ? 'nộp' : 'nhận'} tiền</dt>
                <dd className="text-sm">{voucher.partyFullName}</dd>
              </div>
            )}
            {voucher.partyAddress && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">Địa chỉ</dt>
                <dd className="text-sm">{voucher.partyAddress}</dd>
              </div>
            )}
            {voucher.partyIdNumber && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">CMND/CCCD</dt>
                <dd className="text-sm">{voucher.partyIdNumber}</dd>
              </div>
            )}
            {voucher.currency && voucher.currency !== 'VND' && (
              <>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Loại tiền</dt>
                  <dd className="text-sm font-mono">{voucher.currency}</dd>
                </div>
                {voucher.originalAmount && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Số tiền nguyên tệ</dt>
                    <dd className="text-sm font-mono">{voucher.originalAmount} {voucher.currency}</dd>
                  </div>
                )}
                {voucher.exchangeRate && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Tỷ giá</dt>
                    <dd className="text-sm font-mono">{voucher.exchangeRate}</dd>
                  </div>
                )}
              </>
            )}
            {voucher.amountInWords && (
              <div className="sm:col-span-2 lg:col-span-4">
                <dt className="text-sm font-medium text-muted-foreground">Số tiền bằng chữ</dt>
                <dd className="text-sm italic">{voucher.amountInWords}</dd>
              </div>
            )}
            {(voucher.attachmentCount ?? 0) > 0 && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Chứng từ gốc</dt>
                <dd className="text-sm">Kèm theo {voucher.attachmentCount} chứng từ</dd>
              </div>
            )}
            {voucher.originalDocRefs && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-sm font-medium text-muted-foreground">Tham chiếu</dt>
                <dd className="text-sm">{voucher.originalDocRefs}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Journal lines */}
      {voucher.journalEntry && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Bút toán - {voucher.journalEntry.entryNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="min-w-[200px]">Tài khoản</TableHead>
                  <TableHead>Diễn giải</TableHead>
                  <TableHead className="w-40 text-right">Nợ (₫)</TableHead>
                  <TableHead className="w-40 text-right">Có (₫)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {voucher.journalEntry.lines.map((line, idx) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <span className="font-mono font-medium">{line.account.code}</span>
                      <span className="ml-2">{line.account.name}</span>
                    </TableCell>
                    <TableCell>{line.description ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {line.debitAmount > 0 ? formatVND(line.debitAmount) : ''}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {line.creditAmount > 0 ? formatVND(line.creditAmount) : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">
                    Tổng cộng
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatVND(totalDebit)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatVND(totalCredit)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {!voucher.journalEntry && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Chứng từ chưa có bút toán liên kết
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm">
          <Printer className="mr-2 h-4 w-4" />
          In
        </Button>
        {voucher.status === 'DRAFT' && (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/vouchers/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Sửa
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={() => postMutation.mutate()}
              disabled={postMutation.isPending || !voucher.journalEntry}
            >
              <BookCheck className="mr-2 h-4 w-4" />
              {postMutation.isPending ? 'Đang ghi sổ...' : 'Ghi sổ'}
            </Button>
          </>
        )}
        {voucher.status === 'POSTED' && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => voidMutation.mutate()}
            disabled={voidMutation.isPending}
          >
            <XCircle className="mr-2 h-4 w-4" />
            {voidMutation.isPending ? 'Đang hủy...' : 'Hủy chứng từ'}
          </Button>
        )}
      </div>
    </div>
  );
}
