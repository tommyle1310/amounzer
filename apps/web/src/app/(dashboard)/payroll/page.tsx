'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatVND } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Calculator, BookCheck, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  code: string;
  name: string;
  department: string;
  baseSalary: number;
  isActive: boolean;
}

interface PayrollRecord {
  id: string;
  period: string;
  status: 'DRAFT' | 'COMPUTED' | 'POSTED';
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employeeCount: number;
}

interface SalarySlip {
  id: string;
  employeeName: string;
  employeeCode: string;
  baseSalary: number;
  allowances: number;
  grossSalary: number;
  socialInsurance: number;
  healthInsurance: number;
  personalTax: number;
  totalDeductions: number;
  netSalary: number;
}

const payrollStatusLabels: Record<string, string> = { DRAFT: 'Nháp', COMPUTED: 'Đã tính', POSTED: 'Đã ghi sổ' };
const payrollStatusColors: Record<string, string> = { DRAFT: 'text-yellow-600 bg-yellow-50', COMPUTED: 'text-blue-600 bg-blue-50', POSTED: 'text-green-600 bg-green-50' };

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState({ code: '', name: '', department: '', baseSalary: '' });
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [payrollPeriod, setPayrollPeriod] = useState('');
  const [selectedPayrollId, setSelectedPayrollId] = useState('');

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => apiClient.get('/payroll/employees'),
  });

  const { data: payrolls = [] } = useQuery<PayrollRecord[]>({
    queryKey: ['payrolls'],
    queryFn: () => apiClient.get('/payroll'),
  });

  const { data: slips = [] } = useQuery<SalarySlip[]>({
    queryKey: ['salary-slips', selectedPayrollId],
    queryFn: () => apiClient.get(`/payroll/${selectedPayrollId}/slips`),
    enabled: !!selectedPayrollId,
  });

  const saveEmpMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      data.id ? apiClient.patch(`/payroll/employees/${data.id}`, data) : apiClient.post('/payroll/employees', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowEmpForm(false);
      setEditingEmp(null);
    },
  });

  const deleteEmpMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/payroll/employees/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const createPayrollMutation = useMutation({
    mutationFn: (period: string) => apiClient.post('/payroll', { period }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      setShowPayrollForm(false);
      setPayrollPeriod('');
    },
  });

  const computeMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/payroll/${id}/compute`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payrolls'] }),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/payroll/${id}/post`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payrolls'] }),
  });

  const openEditEmp = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpForm({ code: emp.code, name: emp.name, department: emp.department, baseSalary: String(emp.baseSalary) });
    setShowEmpForm(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bảng lương</h1>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Nhân viên</TabsTrigger>
          <TabsTrigger value="payrolls">Bảng lương</TabsTrigger>
          <TabsTrigger value="slips">Chi tiết bảng lương</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Danh sách nhân viên</CardTitle>
              <Button size="sm" onClick={() => { setEditingEmp(null); setEmpForm({ code: '', name: '', department: '', baseSalary: '' }); setShowEmpForm(true); }}>
                <Plus className="mr-2 h-4 w-4" />Thêm
              </Button>
            </CardHeader>
            <CardContent>
              {showEmpForm && (
                <div className="mb-4 rounded border p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div><Label>Mã NV</Label><Input value={empForm.code} onChange={e => setEmpForm(f => ({ ...f, code: e.target.value }))} /></div>
                    <div><Label>Họ tên</Label><Input value={empForm.name} onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div><Label>Phòng ban</Label><Input value={empForm.department} onChange={e => setEmpForm(f => ({ ...f, department: e.target.value }))} /></div>
                    <div><Label>Lương cơ bản (₫)</Label><Input type="number" value={empForm.baseSalary} onChange={e => setEmpForm(f => ({ ...f, baseSalary: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEmpMutation.mutate({ ...empForm, baseSalary: Number(empForm.baseSalary), id: editingEmp?.id })}>{editingEmp ? 'Cập nhật' : 'Lưu'}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowEmpForm(false); setEditingEmp(null); }}>Hủy</Button>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã NV</TableHead>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>Phòng ban</TableHead>
                    <TableHead className="text-right">Lương cơ bản (₫)</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono">{emp.code}</TableCell>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell className="text-right">{formatVND(emp.baseSalary)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEmp(emp)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteEmpMutation.mutate(emp.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {employees.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có nhân viên</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payrolls">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Bảng lương</CardTitle>
              <Button size="sm" onClick={() => setShowPayrollForm(true)}>
                <Plus className="mr-2 h-4 w-4" />Tạo bảng lương
              </Button>
            </CardHeader>
            <CardContent>
              {showPayrollForm && (
                <div className="mb-4 rounded border p-4 space-y-3 max-w-sm">
                  <div><Label>Kỳ lương (yyyy-MM)</Label><Input placeholder="2026-04" value={payrollPeriod} onChange={e => setPayrollPeriod(e.target.value)} /></div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => createPayrollMutation.mutate(payrollPeriod)}>Tạo</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowPayrollForm(false)}>Hủy</Button>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kỳ</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Tổng gross (₫)</TableHead>
                    <TableHead className="text-right">Tổng net (₫)</TableHead>
                    <TableHead>Số NV</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrolls.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.period}</TableCell>
                      <TableCell><span className={cn('text-xs px-2 py-1 rounded', payrollStatusColors[p.status])}>{payrollStatusLabels[p.status]}</span></TableCell>
                      <TableCell className="text-right">{formatVND(p.totalGross)}</TableCell>
                      <TableCell className="text-right">{formatVND(p.totalNet)}</TableCell>
                      <TableCell>{p.employeeCount}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.status === 'DRAFT' && (
                            <Button variant="outline" size="sm" onClick={() => computeMutation.mutate(p.id)}>
                              <Calculator className="mr-1 h-3 w-3" />Tính
                            </Button>
                          )}
                          {p.status === 'COMPUTED' && (
                            <Button variant="outline" size="sm" onClick={() => postMutation.mutate(p.id)}>
                              <BookCheck className="mr-1 h-3 w-3" />Ghi sổ
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setSelectedPayrollId(p.id)}>
                            <Eye className="mr-1 h-3 w-3" />Xem
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {payrolls.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chưa có bảng lương</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slips">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Chi tiết bảng lương</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Chọn bảng lương</Label>
                <select className="ml-2 h-9 rounded-md border border-input bg-background px-3 text-sm" value={selectedPayrollId} onChange={e => setSelectedPayrollId(e.target.value)}>
                  <option value="">-- Chọn --</option>
                  {payrolls.map(p => <option key={p.id} value={p.id}>{p.period} ({payrollStatusLabels[p.status]})</option>)}
                </select>
              </div>
              {selectedPayrollId && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã NV</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead className="text-right">Lương CB</TableHead>
                      <TableHead className="text-right">Phụ cấp</TableHead>
                      <TableHead className="text-right">Tổng gross</TableHead>
                      <TableHead className="text-right">BHXH</TableHead>
                      <TableHead className="text-right">BHYT</TableHead>
                      <TableHead className="text-right">TNCN</TableHead>
                      <TableHead className="text-right">Tổng KT</TableHead>
                      <TableHead className="text-right">Thực lĩnh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slips.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono">{s.employeeCode}</TableCell>
                        <TableCell>{s.employeeName}</TableCell>
                        <TableCell className="text-right">{formatVND(s.baseSalary)}</TableCell>
                        <TableCell className="text-right">{formatVND(s.allowances)}</TableCell>
                        <TableCell className="text-right">{formatVND(s.grossSalary)}</TableCell>
                        <TableCell className="text-right">{formatVND(s.socialInsurance)}</TableCell>
                        <TableCell className="text-right">{formatVND(s.healthInsurance)}</TableCell>
                        <TableCell className="text-right">{formatVND(s.personalTax)}</TableCell>
                        <TableCell className="text-right">{formatVND(s.totalDeductions)}</TableCell>
                        <TableCell className="text-right font-medium">{formatVND(s.netSalary)}</TableCell>
                      </TableRow>
                    ))}
                    {slips.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Chưa có dữ liệu</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
