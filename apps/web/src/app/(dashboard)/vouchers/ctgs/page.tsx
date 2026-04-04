'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatVND, numberToVietnameseWords } from '@amounzer/shared';
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

interface Partner {
  id: string;
  code: string;
  name: string;
  taxCode?: string;
  address?: string;
}

type PartnerType = 'customer' | 'vendor' | 'employee' | 'other' | '';

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

export default function NewCTGSPage() {
  const router = useRouter();
  const { company } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState('');
  const [activeAccountLine, setActiveAccountLine] = useState<number | null>(null);
  const [debouncedAccountQuery, setDebouncedAccountQuery] = useState('');
  
  // Partner (đối tượng) fields
  const [partnerType, setPartnerType] = useState<PartnerType>('');
  const [partnerQuery, setPartnerQuery] = useState('');
  const [debouncedPartnerQuery, setDebouncedPartnerQuery] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showPartnerSuggestions, setShowPartnerSuggestions] = useState(false);
  const [partnerHighlightIndex, setPartnerHighlightIndex] = useState(-1);
  const [accountHighlightIndex, setAccountHighlightIndex] = useState(-1);
  
  // Manual input for 'other' type
  const [otherPartnerName, setOtherPartnerName] = useState('');
  const [otherPartnerTaxCode, setOtherPartnerTaxCode] = useState('');
  const [otherPartnerAddress, setOtherPartnerAddress] = useState('');

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

  // Debounce partner search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPartnerQuery(partnerQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [partnerQuery]);

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

  // Customer search
  const { data: customersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['customers-search', debouncedPartnerQuery],
    queryFn: () => apiClient.get(`/customers?search=${encodeURIComponent(debouncedPartnerQuery)}`),
    enabled: partnerType === 'customer' && debouncedPartnerQuery.length >= 1,
  });

  // Vendor search
  const { data: vendorsData } = useQuery<{ data: Partner[] }>({
    queryKey: ['vendors-search', debouncedPartnerQuery],
    queryFn: () => apiClient.get(`/vendors?search=${encodeURIComponent(debouncedPartnerQuery)}`),
    enabled: partnerType === 'vendor' && debouncedPartnerQuery.length >= 1,
  });

  // Employee search
  const { data: employeesData } = useQuery<{ data: Partner[] }>({
    queryKey: ['employees-search', debouncedPartnerQuery],
    queryFn: () => apiClient.get(`/payroll/employees?search=${encodeURIComponent(debouncedPartnerQuery)}`),
    enabled: partnerType === 'employee' && debouncedPartnerQuery.length >= 1,
  });

  const partners = useMemo(() => {
    switch (partnerType) {
      case 'customer': return customersData?.data ?? [];
      case 'vendor': return vendorsData?.data ?? [];
      case 'employee': return employeesData?.data ?? [];
      default: return [];
    }
  }, [partnerType, customersData?.data, vendorsData?.data, employeesData?.data]);

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => apiClient.post('/vouchers', payload),
    onSuccess: () => router.push('/vouchers'),
    onError: (err) => setError(err instanceof Error ? err.message : 'Lỗi tạo chứng từ ghi sổ'),
  });

  const updateLine = useCallback((index: number, field: keyof JournalLine, value: string | number | boolean) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }, []);

  // Reset highlight index when results change
  useEffect(() => {
    setPartnerHighlightIndex(-1);
  }, [partners]);

  useEffect(() => {
    setAccountHighlightIndex(-1);
  }, [accounts]);

  // Keyboard handler for partner dropdown
  const handlePartnerKeyDown = (e: React.KeyboardEvent) => {
    if (!showPartnerSuggestions || partners.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPartnerHighlightIndex((prev) => (prev < partners.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPartnerHighlightIndex((prev) => (prev > 0 ? prev - 1 : partners.length - 1));
    } else if (e.key === 'Enter' && partnerHighlightIndex >= 0) {
      e.preventDefault();
      const p = partners[partnerHighlightIndex];
      if (p) {
        setSelectedPartner(p);
        setPartnerQuery(`${p.code} - ${p.name}`);
        setShowPartnerSuggestions(false);
        setPartnerHighlightIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setShowPartnerSuggestions(false);
      setPartnerHighlightIndex(-1);
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
    
    // Determine partner info based on type
    const isOther = partnerType === 'other';
    const partyName = isOther ? otherPartnerName : selectedPartner?.name;
    const partyTaxCode = isOther ? otherPartnerTaxCode : selectedPartner?.taxCode;
    const partyAddress = isOther ? otherPartnerAddress : selectedPartner?.address;
    
    createMutation.mutate({
      voucherType: 'CTGS',
      date: new Date(date).toISOString(),
      description,
      totalAmount: totalDebit,
      amountInWords: numberToVietnameseWords(totalDebit, 'đồng'),
      fiscalYearId: currentFiscalYear.id,
      customerId: partnerType === 'customer' ? selectedPartner?.id : undefined,
      vendorId: partnerType === 'vendor' ? selectedPartner?.id : undefined,
      employeeId: partnerType === 'employee' ? selectedPartner?.id : undefined,
      partyName,
      partyTaxCode,
      partyAddress,
      lines: validLines.map(({ accountId, debitAmount, creditAmount }) => ({
        accountId,
        description: description, // Use main voucher description for all lines
        debitAmount: Number(debitAmount) || 0,
        creditAmount: Number(creditAmount) || 0,
      })),
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Chứng từ ghi sổ (CTGS)</h1>

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
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Số chứng từ</Label>
              <Input
                value="CTGS-XXXX (tự động)"
                readOnly
                className="bg-muted font-mono"
              />
              <p className="text-xs text-muted-foreground">Số chứng từ sẽ được tạo tự động khi lưu</p>
            </div>
            <div className="space-y-2">
              <Label>Ngày chứng từ *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            
            {/* Partner (đối tượng) fields */}
            <div className="space-y-2">
              <Label>Loại đối tượng</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={partnerType}
                onChange={(e) => {
                  setPartnerType(e.target.value as PartnerType);
                  setSelectedPartner(null);
                  setPartnerQuery('');
                  setOtherPartnerName('');
                  setOtherPartnerTaxCode('');
                  setOtherPartnerAddress('');
                }}
              >
                <option value="">-- Không chọn --</option>
                <option value="customer">Khách hàng</option>
                <option value="vendor">Nhà cung cấp</option>
                <option value="employee">Nhân viên</option>
                <option value="other">Đối tượng khác</option>
              </select>
            </div>
            
            {partnerType === 'other' ? (
              // Manual input for 'other' type
              <div className="space-y-2">
                <Label>Tên đối tượng *</Label>
                <Input
                  value={otherPartnerName}
                  onChange={(e) => setOtherPartnerName(e.target.value)}
                  placeholder="Nhập tên đối tượng"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Đối tượng {partnerType ? '' : '(tùy chọn)'}</Label>
                <div className="relative">
                  <Input
                    value={partnerQuery}
                    onChange={(e) => {
                      setPartnerQuery(e.target.value);
                      setShowPartnerSuggestions(true);
                    }}
                    onFocus={() => setShowPartnerSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowPartnerSuggestions(false), 200)}
                    onKeyDown={handlePartnerKeyDown}
                    placeholder={partnerType ? `Tìm ${partnerType === 'customer' ? 'khách hàng' : partnerType === 'vendor' ? 'nhà cung cấp' : 'nhân viên'}...` : 'Chọn loại đối tượng trước'}
                    disabled={!partnerType}
                  />
                  {showPartnerSuggestions && partners.length > 0 && partnerQuery.length >= 1 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border bg-background shadow-md">
                      {partners.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-sm hover:bg-accent ${partners.indexOf(p) === partnerHighlightIndex ? 'bg-accent' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedPartner(p);
                            setPartnerQuery(`${p.code} - ${p.name}`);
                            setShowPartnerSuggestions(false);
                            setPartnerHighlightIndex(-1);
                          }}
                        >
                          <span className="font-medium">{p.code} - {p.name}</span>
                          {p.taxCode && <span className="text-xs text-muted-foreground">MST: {p.taxCode}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>MST (Mã số thuế)</Label>
              {partnerType === 'other' ? (
                <Input
                  value={otherPartnerTaxCode}
                  onChange={(e) => setOtherPartnerTaxCode(e.target.value)}
                  placeholder="Nhập mã số thuế (tùy chọn)"
                />
              ) : (
                <Input
                  value={selectedPartner?.taxCode ?? ''}
                  readOnly
                  className="bg-muted"
                  placeholder="Tự động điền từ đối tượng"
                />
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Địa chỉ</Label>
              {partnerType === 'other' ? (
                <Input
                  value={otherPartnerAddress}
                  onChange={(e) => setOtherPartnerAddress(e.target.value)}
                  placeholder="Nhập địa chỉ (tùy chọn)"
                />
              ) : (
                <Input
                  value={selectedPartner?.address ?? ''}
                  readOnly
                  className="bg-muted"
                  placeholder="Tự động điền từ đối tượng"
                />
              )}
            </div>
            
            <div className="space-y-2 sm:col-span-2">
              <Label>Nội dung *</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Diễn giải chứng từ ghi sổ"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tổng số tiền</Label>
              <Input
                value={formatVND(totalDebit)}
                readOnly
                className="bg-muted font-mono font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label>Số tiền bằng chữ</Label>
              <Input
                value={numberToVietnameseWords(totalDebit, 'đồng')}
                readOnly
                className="bg-muted italic text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Journal lines - Định khoản */}
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Định khoản (TK đối ứng)</CardTitle>
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
                  <TableHead className="w-36 text-right">Nợ (₫)</TableHead>
                  <TableHead className="w-36 text-right">Có (₫)</TableHead>
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
            {createMutation.isPending ? 'Đang lưu...' : 'Lưu chứng từ'}
          </Button>
        </div>
      </form>
    </div>
  );
}
