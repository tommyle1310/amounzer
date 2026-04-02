'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();
  const { isLoading, company, setCompany } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    taxCode: '',
    address: '',
    legalRepresentative: '',
    phone: '',
    accountingStandard: 'TT200' as 'TT200' | 'TT133',
  });

  // Redirect to dashboard if user already has a company selected
  useEffect(() => {
    if (!isLoading && company) {
      router.push('/dashboard');
    }
  }, [isLoading, company, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Vui lòng nhập tên công ty');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // 1. Create company
      const company = await apiClient.post<{ id: string; name: string }>('/companies', formData);
      
      // 2. Set company in context (this also sets apiClient headers)
      setCompany(company);
      
      // 3. Seed chart of accounts with the selected standard
      // Need to set header manually since setCompany might be async
      apiClient.setCompanyId(company.id);
      await apiClient.post('/chart-of-accounts/seed', { 
        standard: formData.accountingStandard 
      });
      
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tạo công ty');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Thiết lập công ty</CardTitle>
          <CardDescription>
            Tạo công ty đầu tiên để bắt đầu sử dụng phần mềm kế toán
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Tên công ty *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Công ty TNHH ABC"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxCode">Mã số thuế</Label>
              <Input
                id="taxCode"
                value={formData.taxCode}
                onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                placeholder="0123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Địa chỉ</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Nguyễn Văn A, Quận 1, TP.HCM"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="legalRepresentative">Người đại diện</Label>
                <Input
                  id="legalRepresentative"
                  value={formData.legalRepresentative}
                  onChange={(e) => setFormData({ ...formData, legalRepresentative: e.target.value })}
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0901234567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Chế độ kế toán</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="accountingStandard"
                    value="TT200"
                    checked={formData.accountingStandard === 'TT200'}
                    onChange={(e) => setFormData({ ...formData, accountingStandard: e.target.value as 'TT200' | 'TT133' })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Thông tư 200 (DN lớn)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="accountingStandard"
                    value="TT133"
                    checked={formData.accountingStandard === 'TT133'}
                    onChange={(e) => setFormData({ ...formData, accountingStandard: e.target.value as 'TT200' | 'TT133' })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Thông tư 133 (DN nhỏ)</span>
                </label>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Đang tạo...' : 'Tạo công ty & bắt đầu'}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
