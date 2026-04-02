'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDateVN } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, Plus } from 'lucide-react';

interface CompanyInfo {
  id: string;
  name: string;
  taxCode: string | null;
  address: string | null;
  phone: string | null;
  legalRepresentative: string | null;
  accountingStandard: 'TT200' | 'TT133';
  baseCurrency: string;
  locale: string;
}

interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
  periods: { id: string; name: string; startDate: string; endDate: string }[];
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  const [showNewFiscalYear, setShowNewFiscalYear] = useState(false);
  const currentYear = new Date().getFullYear();
  const [newFiscalYear, setNewFiscalYear] = useState({
    name: `Năm tài chính ${currentYear}`,
    startDate: `${currentYear}-01-01`,
    endDate: `${currentYear}-12-31`,
  });

  const { data: companyInfo } = useQuery<CompanyInfo>({
    queryKey: ['company-info', company?.id],
    queryFn: () => apiClient.get(`/companies/${company!.id}`),
    enabled: !!company?.id,
  });

  const [companyForm, setCompanyForm] = useState<Partial<CompanyInfo>>({});
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [locale, setLocale] = useState('vi');

  // Initialize form when company info loads
  if (companyInfo && !isFormInitialized) {
    setCompanyForm(companyInfo);
    setLocale(companyInfo.locale ?? 'vi');
    setIsFormInitialized(true);
  }

  const { data: fiscalYears = [] } = useQuery<FiscalYear[]>({
    queryKey: ['fiscal-years', company?.id],
    queryFn: () => apiClient.get(`/companies/${company!.id}/fiscal-years`),
    enabled: !!company?.id,
  });

  const saveCompanyMutation = useMutation({
    mutationFn: (data: Partial<CompanyInfo>) => apiClient.patch(`/companies/${company!.id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company-info'] }),
  });

  const createFiscalYearMutation = useMutation({
    mutationFn: (data: { name: string; startDate: string; endDate: string }) =>
      apiClient.post(`/companies/${company!.id}/fiscal-years`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-years'] });
      setShowNewFiscalYear(false);
    },
  });

  const saveLocaleMutation = useMutation({
    mutationFn: (loc: string) => apiClient.patch(`/companies/${company!.id}`, { locale: loc }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company-info'] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cài đặt</h1>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Thông tin công ty</TabsTrigger>
          <TabsTrigger value="fiscal">Năm tài chính</TabsTrigger>
          <TabsTrigger value="locale">Ngôn ngữ</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader><CardTitle className="text-lg">Thông tin công ty</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><Label>Tên công ty</Label><Input value={companyForm.name ?? ''} onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Mã số thuế</Label><Input value={companyForm.taxCode ?? ''} onChange={e => setCompanyForm(f => ({ ...f, taxCode: e.target.value }))} /></div>
                <div className="sm:col-span-2"><Label>Địa chỉ</Label><Input value={companyForm.address ?? ''} onChange={e => setCompanyForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div><Label>Điện thoại</Label><Input value={companyForm.phone ?? ''} onChange={e => setCompanyForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><Label>Người đại diện pháp luật</Label><Input value={companyForm.legalRepresentative ?? ''} onChange={e => setCompanyForm(f => ({ ...f, legalRepresentative: e.target.value }))} /></div>
                <div>
                  <Label>Chế độ kế toán</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={companyForm.accountingStandard ?? 'TT200'} onChange={e => setCompanyForm(f => ({ ...f, accountingStandard: e.target.value as 'TT200' | 'TT133' }))}>
                    <option value="TT200">Thông tư 200/2014/TT-BTC</option>
                    <option value="TT133">Thông tư 133/2016/TT-BTC</option>
                  </select>
                </div>
              </div>
              <Button onClick={() => saveCompanyMutation.mutate(companyForm)} disabled={saveCompanyMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />Lưu thay đổi
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fiscal">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Năm tài chính</CardTitle>
              <Button size="sm" onClick={() => setShowNewFiscalYear(true)}>
                <Plus className="mr-2 h-4 w-4" />Tạo năm mới
              </Button>
            </CardHeader>
            <CardContent>
              {showNewFiscalYear && (
                <div className="mb-6 rounded-md border p-4 bg-muted/50">
                  <h3 className="text-base font-semibold mb-4">Tạo năm tài chính mới</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
                    <div>
                      <Label>Tên</Label>
                      <Input
                        value={newFiscalYear.name}
                        onChange={(e) => setNewFiscalYear((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Năm tài chính 2026"
                      />
                    </div>
                    <div>
                      <Label>Từ ngày</Label>
                      <Input
                        type="date"
                        value={newFiscalYear.startDate}
                        onChange={(e) => setNewFiscalYear((f) => ({ ...f, startDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Đến ngày</Label>
                      <Input
                        type="date"
                        value={newFiscalYear.endDate}
                        onChange={(e) => setNewFiscalYear((f) => ({ ...f, endDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => createFiscalYearMutation.mutate(newFiscalYear)}
                      disabled={createFiscalYearMutation.isPending}
                    >
                      {createFiscalYearMutation.isPending ? 'Đang tạo...' : 'Tạo'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowNewFiscalYear(false)}>
                      Hủy
                    </Button>
                  </div>
                </div>
              )}
              {fiscalYears.map((fy) => (
                <div key={fy.id} className="mb-6">
                  <h3 className="text-base font-semibold mb-2">
                    {fy.name}
                    <span
                      className={`ml-2 text-xs px-2 py-1 rounded ${fy.status === 'CLOSED' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}
                    >
                      {fy.status === 'CLOSED' ? 'Đã khóa' : 'Mở'}
                    </span>
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {formatDateVN(fy.startDate)} - {formatDateVN(fy.endDate)}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kỳ</TableHead>
                        <TableHead>Từ ngày</TableHead>
                        <TableHead>Đến ngày</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fy.periods.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>{formatDateVN(p.startDate)}</TableCell>
                          <TableCell>{formatDateVN(p.endDate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
              {fiscalYears.length === 0 && !showNewFiscalYear && (
                <p className="text-center text-muted-foreground">Chưa có năm tài chính</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locale">
          <Card>
            <CardHeader><CardTitle className="text-lg">Ngôn ngữ hiển thị</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-sm">
                <Label>Ngôn ngữ</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={locale} onChange={e => setLocale(e.target.value)}>
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>
              </div>
              <Button onClick={() => saveLocaleMutation.mutate(locale)} disabled={saveLocaleMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />Lưu
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
