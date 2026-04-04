'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

import type { ApiBookResponse } from '../types';
import { BOOK_API_MAP } from '../constants';
import { EmptyState } from './empty-state';
import { GeneralJournalTable } from './general-journal-table';
import { GeneralLedgerSection } from './general-ledger-section';
import { CashBookTable } from './cash-book-table';
import { GenericLedgerTable } from './generic-ledger-table';
import { PurchaseSalesJournalTable } from './purchase-sales-journal-table';

// ── Types ────────────────────────────────────────────────────────────────────

interface BookTabProps {
  bookKey: string;
  dateFrom: string;
  dateTo: string;
  title?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function BookTab({ bookKey, dateFrom, dateTo, title }: BookTabProps) {
  // General Ledger has its own account selector, render separately
  if (bookKey === 'general-ledger') {
    return <GeneralLedgerSection dateFrom={dateFrom} dateTo={dateTo} />;
  }

  const apiPath = BOOK_API_MAP[bookKey] ?? bookKey;
  const params = new URLSearchParams({ startDate: dateFrom, endDate: dateTo });

  const { data, isLoading, error } = useQuery<ApiBookResponse>({
    queryKey: ['books', bookKey, dateFrom, dateTo],
    queryFn: () => apiClient.get(`/accounting-books/${apiPath}?${params.toString()}`),
    enabled: !!dateFrom && !!dateTo,
  });

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Đang tải...</div>;
  }

  if (error) {
    return <div className="py-8 text-center text-red-500">Lỗi khi tải dữ liệu</div>;
  }

  if (!data) {
    return <EmptyState />;
  }

  // Route to appropriate table component based on book type
  switch (bookKey) {
    case 'general-journal':
      return <GeneralJournalTable data={data} totals={data.totals} title={title} />;

    case 'cash':
    case 'bank':
      return <CashBookTable data={data} />;

    case 'purchase-journal':
      return <PurchaseSalesJournalTable data={data} type="purchase" />;

    case 'sales-journal':
      return <PurchaseSalesJournalTable data={data} type="sales" />;

    default:
      return <GenericLedgerTable data={data} />;
  }
}
