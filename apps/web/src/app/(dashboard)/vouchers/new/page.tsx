'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatVND, VOUCHER_TYPE_LABELS, numberToVietnameseWords, type VoucherTypeCode } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
}

interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
}

interface JournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  isExpanded?: boolean;
}

const emptyLine = (): JournalLine => ({
  accountId: '',
  accountCode: '',
  accountName: '',
  debitAmount: 0,
  creditAmount: 0,
  isExpanded: false,
});

// Currency options for foreign currency support
const CURRENCIES = [
  { code: 'VND', name: 'Việt Nam Đồng' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
];

export default function NewVoucherPage() {
  const router = useRouter();
  const { company } = useAuth();
  const [voucherType, setVoucherType] = useState<VoucherTypeCode>('PT');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);
  const [counterpartyQuery, setCounterpartyQuery] = useState('');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState('');
  const [showCounterpartySuggestions, setShowCounterpartySuggestions] = useState(false);
  const [counterpartyHighlightIndex, setCounterpartyHighlightIndex] = useState(-1);
  const [activeAccountLine, setActiveAccountLine] = useState<number | null>(null);
  const [debouncedAccountQuery, setDebouncedAccountQuery] = useState('');
  const [accountHighlightIndex, setAccountHighlightIndex] = useState(-1);
  
  // Legal document fields (TT200/TT133 compliance)
  const [showLegalFields, setShowLegalFields] = useState(false);
  const [voucherBookNo, setVoucherBookNo] = useState('');
  const [partyFullName, setPartyFullName] = useState('');
  const [partyAddress, setPartyAddress] = useState('');
  const [partyTaxCode, setPartyTaxCode] = useState('');
  const [partyIdNumber, setPartyIdNumber] = useState('');
  const [amountInWords, setAmountInWords] = useState('');
  const [amountInWordsOverride, setAmountInWordsOverride] = useState(false);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [originalDocRefs, setOriginalDocRefs] = useState('');
  
  // Foreign currency fields
  const [currency, setCurrency] = useState('VND');
  const [originalAmount, setOriginalAmount] = useState<number | ''>('');
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  // Fetch fiscal years for the company
  const { data: fiscalYears = [] } = useQuery<FiscalYear[]>({
    queryKey: ['fiscal-years', company?.id],
    queryFn: () => apiClient.get(`/companies/${company!.id}/fiscal-years`),
    enabled: !!company?.id,
  });

  // Find the fiscal year that contains the selected date
  const currentFiscalYear = useMemo(() => {
    if (!date || fiscalYears.length === 0) return null;
    const voucherDate = new Date(date);
    return fiscalYears.find((fy) => {
      const start = new Date(fy.startDate);
      const end = new Date(fy.endDate);
      return voucherDate >= start && voucherDate <= end && fy.status === 'OPEN';
    }) ?? null;
  }, [date, fiscalYears]);

  // Debounce account search query (300ms)
  useEffect(() => {
    const query = activeAccountLine !== null ? lines[activeAccountLine]?.accountCode ?? '' : '';
    const timer = setTimeout(() => {
      setDebouncedAccountQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [activeAccountLine, lines]);

  // Accounts search with debounced query
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts-search', debouncedAccountQuery],
    queryFn: () =>
      apiClient.get(
        `/chart-of-accounts/search?q=${encodeURIComponent(debouncedAccountQuery)}`,
      ),
    enabled: debouncedAccountQuery.length >= 1,
    staleTime: 0,
    gcTime: 30_000, // 30 seconds cache
  });

  // Counterparty search (customers + vendors)
  const { data: customersData } = useQuery<{ data: { id: string; name: string; taxCode?: string; address?: string }[] }>({
    queryKey: ['customers-search', counterpartyQuery],
    queryFn: () => apiClient.get(`/customers?search=${encodeURIComponent(counterpartyQuery)}`),
    enabled: counterpartyQuery.length >= 2,
  });

  const { data: vendorsData } = useQuery<{ data: { id: string; name: string; taxCode?: string; address?: string }[] }>({
    queryKey: ['vendors-search', counterpartyQuery],
    queryFn: () => apiClient.get(`/vendors?search=${encodeURIComponent(counterpartyQuery)}`),
    enabled: counterpartyQuery.length >= 2,
  });

  const counterparties = [
    ...(customersData?.data ?? []).map((c) => ({ ...c, type: 'customer' as const })),
    ...(vendorsData?.data ?? []).map((v) => ({ ...v, type: 'vendor' as const })),
  ];

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => apiClient.post('/vouchers', payload),
    onSuccess: () => router.push('/vouchers'),
    onError: (err) => setError(err instanceof Error ? err.message : 'Lỗi tạo chứng từ'),
  });

  const updateLine = useCallback((index: number, field: keyof JournalLine, value: string | number | boolean) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }, []);

  // Reset highlight index when results change
  useEffect(() => {
    setCounterpartyHighlightIndex(-1);
  }, [counterparties.length]);

  useEffect(() => {
    setAccountHighlightIndex(-1);
  }, [accounts]);

  // Keyboard handler for counterparty dropdown
  const handleCounterpartyKeyDown = (e: React.KeyboardEvent) => {
    if (!showCounterpartySuggestions || counterparties.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCounterpartyHighlightIndex((prev) => (prev < counterparties.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCounterpartyHighlightIndex((prev) => (prev > 0 ? prev - 1 : counterparties.length - 1));
    } else if (e.key === 'Enter' && counterpartyHighlightIndex >= 0) {
      e.preventDefault();
      const cp = counterparties[counterpartyHighlightIndex];
      if (cp) {
        setCounterpartyId(cp.id);
        setCounterpartyName(cp.name);
        setCounterpartyQuery(cp.name);
        // Auto-fill legal fields if available
        if (cp.taxCode) {
          setPartyTaxCode(cp.taxCode);
        }
        if (cp.address) {
          setPartyAddress(cp.address);
        }
        if (cp.name && !partyFullName) {
          setPartyFullName(cp.name);
        }
        setShowCounterpartySuggestions(false);
        setCounterpartyHighlightIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setShowCounterpartySuggestions(false);
      setCounterpartyHighlightIndex(-1);
    }
  };

  // Keyboard handler for account dropdown
  const handleAccountKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (activeAccountLine !== idx || accounts.length === 0) return;
    const line = lines[idx];
    if (!line || line.accountCode.length < 1) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAccountHighlightIndex((prev) => (prev < accounts.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAccountHighlightIndex((prev) => (prev > 0 ? prev - 1 : accounts.length - 1));
    } else if (e.key === 'Enter' && accountHighlightIndex >= 0) {
      e.preventDefault();
      const acc = accounts[accountHighlightIndex];
      if (acc) {
        updateLine(idx, 'accountId', acc.id);
        updateLine(idx, 'accountCode', acc.code);
        updateLine(idx, 'accountName', acc.name);
        setActiveAccountLine(null);
        setAccountHighlightIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setActiveAccountLine(null);
      setAccountHighlightIndex(-1);
    }
  };

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debitAmount) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.creditAmount) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const noFiscalYearForDate = !currentFiscalYear && fiscalYears.length > 0;
  const noFiscalYearAtAll = fiscalYears.length === 0;

  // Auto-generate amount in words when total changes (unless manually overridden)
  useEffect(() => {
    if (!amountInWordsOverride && totalDebit > 0) {
      const currencyWord = currency === 'VND' ? 'đồng' : currency;
      const amount = currency === 'VND' ? totalDebit : (originalAmount || totalDebit);
      setAmountInWords(numberToVietnameseWords(amount, currencyWord));
    }
  }, [totalDebit, currency, originalAmount, amountInWordsOverride]);

  // Auto-fill partyFullName from counterparty when selected
  useEffect(() => {
    if (counterpartyName && !partyFullName) {
      setPartyFullName(counterpartyName);
    }
  }, [counterpartyName, partyFullName]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentFiscalYear) {
      setError('Không tìm thấy năm tài chính mở cho ngày chứng từ này');
      return;
    }
    if (!isBalanced) {
      setError('Tổng Nợ và Có phải bằng nhau');
      return;
    }
    const validLines = lines.filter((l) => l.accountId && (l.debitAmount > 0 || l.creditAmount > 0));
    if (validLines.length < 1) {
      setError('Cần ít nhất 1 dòng bút toán hợp lệ');
      return;
    }
    setError('');
    // Use counterpartyQuery as fallback name if user typed but didn't select from dropdown
    const finalCounterpartyName = counterpartyName || counterpartyQuery || undefined;
    createMutation.mutate({
      voucherType,
      date: new Date(date).toISOString(),
      voucherBookNo: voucherBookNo || undefined,
      
      // Transaction party info
      counterpartyId: counterpartyId || undefined,
      counterpartyName: finalCounterpartyName,
      partyFullName: partyFullName || finalCounterpartyName,
      partyAddress: partyAddress || undefined,
      partyTaxCode: partyTaxCode || undefined,
      partyIdNumber: partyIdNumber || undefined,
      
      description,
      totalAmount: totalDebit,
      amountInWords: amountInWords || undefined,
      
      // Foreign currency
      currency: currency !== 'VND' ? currency : undefined,
      originalAmount: currency !== 'VND' && originalAmount ? originalAmount : undefined,
      exchangeRate: currency !== 'VND' ? exchangeRate : undefined,
      
      // Supporting documents
      attachmentCount: attachmentCount || 0,
      originalDocRefs: originalDocRefs || undefined,
      
      fiscalYearId: currentFiscalYear.id,
      lines: validLines.map(({ accountId, debitAmount, creditAmount }) => ({
        accountId,
        description, // Use voucher description for all lines
        debitAmount: Number(debitAmount) || 0,
        creditAmount: Number(creditAmount) || 0,
      })),
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Tạo chứng từ mới</h1>

      {noFiscalYearAtAll && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Chưa có năm tài chính.{' '}
          <Link href="/settings" className="underline font-medium">
            Tạo năm tài chính
          </Link>{' '}
          trong phần Cài đặt.
        </div>
      )}

      {noFiscalYearForDate && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Không tìm thấy năm tài chính mở cho ngày {date}.{' '}
          <Link href="/settings" className="underline font-medium">
            Quản lý năm tài chính
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Thông tin chứng từ</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Loại chứng từ</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value as VoucherTypeCode)}
              >
                {Object.entries(VOUCHER_TYPE_LABELS).map(([code, labels]) => (
                  <option key={code} value={code}>
                    {code} - {labels.vi}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Ngày chứng từ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="relative space-y-2 sm:col-span-2">
              <Label>Đối tượng</Label>
              <Input
                value={counterpartyQuery}
                onChange={(e) => {
                  setCounterpartyQuery(e.target.value);
                  setShowCounterpartySuggestions(true);
                }}
                onFocus={() => setShowCounterpartySuggestions(true)}
                onBlur={() => setTimeout(() => setShowCounterpartySuggestions(false), 200)}
                onKeyDown={handleCounterpartyKeyDown}
                placeholder="Tìm khách hàng / nhà cung cấp..."
              />
              {showCounterpartySuggestions && counterparties.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border bg-background shadow-md">
                  {counterparties.map((cp) => (
                    <button
                      key={cp.id}
                      type="button"
                      className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent ${counterparties.indexOf(cp) === counterpartyHighlightIndex ? 'bg-accent' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCounterpartyId(cp.id);
                        setCounterpartyName(cp.name);
                        setCounterpartyQuery(cp.name);
                        // Auto-fill legal fields if available
                        if (cp.taxCode) {
                          setPartyTaxCode(cp.taxCode);
                        }
                        if (cp.address) {
                          setPartyAddress(cp.address);
                        }
                        if (cp.name && !partyFullName) {
                          setPartyFullName(cp.name);
                        }
                        setShowCounterpartySuggestions(false);
                        setCounterpartyHighlightIndex(-1);
                      }}
                    >
                      <span className="font-medium">{cp.name}</span>
                      {cp.taxCode && (
                        <span className="text-muted-foreground">MST: {cp.taxCode}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-4">
              <Label>Nội dung</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Diễn giải chứng từ"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Tổng số tiền</Label>
              <Input
                value={formatVND(totalDebit)}
                readOnly
                className="bg-muted font-mono font-bold"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Số tiền bằng chữ</Label>
              <Input
                value={amountInWords || numberToVietnameseWords(totalDebit, currency === 'VND' ? 'đồng' : currency)}
                readOnly
                className="bg-muted italic"
              />
            </div>
          </CardContent>
        </Card>

        {/* Legal Document Fields (TT200/TT133 Compliance) - Collapsible */}
        <Card className="mt-4">
          <CardHeader 
            className="flex flex-row items-center justify-between cursor-pointer"
            onClick={() => setShowLegalFields(!showLegalFields)}
          >
            <CardTitle className="text-base">Thông tin pháp lý (TT200/TT133)</CardTitle>
            <Button type="button" variant="ghost" size="sm">
              {showLegalFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {showLegalFields && (
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Party Information */}
              <div className="space-y-2 sm:col-span-2">
                <Label>Họ tên người {voucherType === 'PT' ? 'nộp' : 'nhận'} tiền</Label>
                <Input
                  value={partyFullName}
                  onChange={(e) => setPartyFullName(e.target.value)}
                  placeholder={`Họ tên người ${voucherType === 'PT' ? 'nộp' : 'nhận'} tiền`}
                />
              </div>
              <div className="space-y-2">
                <Label>Địa chỉ</Label>
                <Input
                  value={partyAddress}
                  onChange={(e) => setPartyAddress(e.target.value)}
                  placeholder="Địa chỉ người giao dịch"
                />
              </div>
              <div className="space-y-2">
                <Label>Mã số thuế (MST)</Label>
                <Input
                  value={partyTaxCode}
                  onChange={(e) => setPartyTaxCode(e.target.value)}
                  placeholder="Mã số thuế"
                />
              </div>
              {/* <div className="space-y-2">
                <Label>CMND/CCCD</Label>
                <Input
                  value={partyIdNumber}
                  onChange={(e) => setPartyIdNumber(e.target.value)}
                  placeholder="Số CMND/CCCD/Hộ chiếu"
                />
              </div> */}

              {/* Override Amount in Words - Optional */}
              <div className="space-y-2 sm:col-span-2 lg:col-span-4">
                <div className="flex items-center gap-2">
                  <Label>Ghi đè số tiền bằng chữ (nếu cần)</Label>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={amountInWordsOverride}
                      onChange={(e) => setAmountInWordsOverride(e.target.checked)}
                      className="h-3 w-3"
                    />
                    Chỉnh sửa
                  </label>
                </div>
                <Input
                  value={amountInWords}
                  onChange={(e) => {
                    setAmountInWords(e.target.value);
                    setAmountInWordsOverride(true);
                  }}
                  placeholder="Để trống sẽ tự động tạo"
                  readOnly={!amountInWordsOverride}
                  className={!amountInWordsOverride ? 'bg-muted' : ''}
                />
              </div>

              {/* Foreign Currency */}
              <div className="space-y-2">
                <Label>Loại tiền</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {currency !== 'VND' && (
                <>
                  <div className="space-y-2">
                    <Label>Số tiền nguyên tệ</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={originalAmount}
                      onChange={(e) => setOriginalAmount(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder={`Số tiền ${currency}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tỷ giá</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.000001"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                      placeholder="Tỷ giá quy đổi VND"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Số tiền quy đổi VND</Label>
                    <Input
                      value={originalAmount ? formatVND(Number(originalAmount) * exchangeRate) : ''}
                      readOnly
                      className="bg-muted font-mono"
                    />
                  </div>
                </>
              )}

              {/* Supporting Documents */}
              <div className="space-y-2">
                <Label>Quyển số</Label>
                <Input
                  value={voucherBookNo}
                  onChange={(e) => setVoucherBookNo(e.target.value)}
                  placeholder="Quyển số (nếu có)"
                />
              </div>
              <div className="space-y-2">
                <Label>Kèm theo ... chứng từ gốc</Label>
                <Input
                  type="number"
                  min={0}
                  value={attachmentCount || ''}
                  onChange={(e) => setAttachmentCount(parseInt(e.target.value) || 0)}
                  placeholder="Số chứng từ kèm theo"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Chứng từ gốc</Label>
                <Input
                  value={originalDocRefs}
                  onChange={(e) => setOriginalDocRefs(e.target.value)}
                  placeholder="Hóa đơn số..., Hợp đồng số..., Phiếu nhập kho..."
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* Journal lines */}
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bút toán</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              <Plus className="mr-1 h-4 w-4" />
              Thêm dòng
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="w-32">TK đối ứng</TableHead>
                  <TableHead className="min-w-[200px]">Diễn giải (Tên TK)</TableHead>
                  <TableHead className="w-40 text-right">Nợ (₫)</TableHead>
                  <TableHead className="w-40 text-right">Có (₫)</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="relative">
                        <Input
                          value={line.accountCode}
                          onChange={(e) => {
                            updateLine(idx, 'accountCode', e.target.value);
                            updateLine(idx, 'accountId', '');
                            updateLine(idx, 'accountName', '');
                            setActiveAccountLine(idx);
                          }}
                          onFocus={() => setActiveAccountLine(idx)}
                          onBlur={() => setTimeout(() => { setActiveAccountLine(null); setAccountHighlightIndex(-1); }, 200)}
                          onKeyDown={(e) => handleAccountKeyDown(e, idx)}
                          placeholder="Mã TK"
                          className="text-sm font-mono w-24"
                        />
                        {activeAccountLine === idx && accounts.length > 0 && line.accountCode.length >= 1 && (
                          <div className="absolute left-0 top-full z-10 mt-1 min-w-[300px] max-h-48 overflow-y-auto rounded-md border bg-background shadow-md">
                            {accounts.map((acc) => (
                              <button
                                key={acc.id}
                                type="button"
                                className={`flex w-full gap-2 px-3 py-2 text-sm hover:bg-accent ${accounts.indexOf(acc) === accountHighlightIndex ? 'bg-accent' : ''}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  updateLine(idx, 'accountId', acc.id);
                                  updateLine(idx, 'accountCode', acc.code);
                                  updateLine(idx, 'accountName', acc.name);
                                  setActiveAccountLine(null);
                                  setAccountHighlightIndex(-1);
                                }}
                              >
                                <span className="font-mono font-medium">{acc.code}</span>
                                <span>{acc.name}</span>
                                {acc.nameEn && <span className="text-muted-foreground">({acc.nameEn})</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {line.accountName ? (
                        <div
                          className="text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
                          onClick={() => updateLine(idx, 'isExpanded', !line.isExpanded)}
                          title="Click để mở rộng"
                        >
                          <div className={`${line.isExpanded ? '' : 'truncate max-w-[180px]'}`}>
                            {line.accountName}
                          </div>
                          {!line.isExpanded && line.accountName.length > 25 && (
                            <ChevronDown className="inline h-3 w-3 text-muted-foreground ml-1" />
                          )}
                          {line.isExpanded && (
                            <ChevronUp className="inline h-3 w-3 text-muted-foreground ml-1" />
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">Chọn tài khoản</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.debitAmount || ''}
                        onChange={(e) => updateLine(idx, 'debitAmount', parseFloat(e.target.value) || 0)}
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData('text').replace(/,/g, '');
                          const num = parseFloat(pasted) || 0;
                          if (num) {
                            e.preventDefault();
                            updateLine(idx, 'debitAmount', num);
                          }
                        }}
                        className="text-right text-sm font-mono"
                        tabIndex={0}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.creditAmount || ''}
                        onChange={(e) => updateLine(idx, 'creditAmount', parseFloat(e.target.value) || 0)}
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData('text').replace(/,/g, '');
                          const num = parseFloat(pasted) || 0;
                          if (num) {
                            e.preventDefault();
                            updateLine(idx, 'creditAmount', num);
                          }
                        }}
                        className="text-right text-sm font-mono"
                        tabIndex={0}
                      />
                    </TableCell>
                    <TableCell>
                      {lines.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
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
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">
                    Chênh lệch
                  </TableCell>
                  <TableCell
                    colSpan={2}
                    className={`text-center font-mono font-bold ${isBalanced ? 'text-green-600' : 'text-destructive'}`}
                  >
                    {isBalanced ? 'Cân' : `Lệch: ${formatVND(Math.abs(totalDebit - totalCredit))} ₫`}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push('/vouchers')}>
            Hủy
          </Button>
          <Button type="submit" disabled={createMutation.isPending || !isBalanced || !currentFiscalYear}>
            {createMutation.isPending ? 'Đang lưu...' : 'Lưu nháp'}
          </Button>
        </div>
      </form>
    </div>
  );
}
