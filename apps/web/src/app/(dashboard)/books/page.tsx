'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { BOOK_TYPES } from './constants';
import { getDefaultDateRange } from './utils';
import { BookTab } from './components';

// ── Page Component ───────────────────────────────────────────────────────────

export default function BooksPage() {
  const [activeTab, setActiveTab] = useState<string>(BOOK_TYPES[0]?.key ?? 'general-journal');
  const defaultDates = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState<string>(defaultDates.startDate);
  const [dateTo, setDateTo] = useState<string>(defaultDates.endDate);

  const handleExport = (format: 'excel' | 'pdf') => {
    const params = new URLSearchParams({ format });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1310/api'}/books/${activeTab}/export?${params.toString()}`,
      '_blank'
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader onExport={handleExport} />
      <DateRangeFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />
      <BookTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PageHeader({ onExport }: { onExport: (format: 'excel' | 'pdf') => void }) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">Sổ sách kế toán</h1>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onExport('excel')}>
          <Download className="mr-1 h-4 w-4" />
          Xuất Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => onExport('pdf')}>
          <Download className="mr-1 h-4 w-4" />
          Xuất PDF
        </Button>
      </div>
    </div>
  );
}

function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap gap-3 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Từ ngày:</span>
          <Input
            type="date"
            className="w-40"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Đến ngày:</span>
          <Input
            type="date"
            className="w-40"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function BookTabs({
  activeTab,
  onTabChange,
  dateFrom,
  dateTo,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  dateFrom: string;
  dateTo: string;
}) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <div className="overflow-x-auto">
        <TabsList className="inline-flex w-auto">
          {BOOK_TYPES.map((bt) => (
            <TabsTrigger key={bt.key} value={bt.key} className="text-xs">
              {bt.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {BOOK_TYPES.map((bt) => (
        <TabsContent key={bt.key} value={bt.key}>
          <Card>
            {bt.key !== 'general-journal' && (
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{bt.label}</CardTitle>
              </CardHeader>
            )}
            <CardContent className={bt.key === 'general-journal' ? 'p-0' : 'p-0'}>
              <BookTab bookKey={bt.key} dateFrom={dateFrom} dateTo={dateTo} title={bt.label} />
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}