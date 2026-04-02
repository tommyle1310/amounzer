'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomField {
  id: string;
  entityType: string;
  fieldName: string;
  label: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'BOOLEAN';
  options: string[];
  isActive: boolean;
  sortOrder: number;
}

const entityTypeLabels: Record<string, string> = {
  CUSTOMER: 'Khách hàng',
  VENDOR: 'Nhà cung cấp',
  VOUCHER: 'Chứng từ',
  ACCOUNT: 'Tài khoản',
  INVENTORY_ITEM: 'Hàng hóa',
  FIXED_ASSET: 'TSCĐ',
  EMPLOYEE: 'Nhân viên',
};

const fieldTypeLabels: Record<string, string> = {
  TEXT: 'Văn bản',
  NUMBER: 'Số',
  DATE: 'Ngày',
  SELECT: 'Lựa chọn',
  BOOLEAN: 'Có/Không',
};

export default function CustomFieldsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [form, setForm] = useState({ entityType: 'CUSTOMER', fieldName: '', label: '', fieldType: 'TEXT', options: '' });

  const { data: fields = [] } = useQuery<CustomField[]>({
    queryKey: ['custom-fields'],
    queryFn: () => apiClient.get('/custom-fields'),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      data.id ? apiClient.patch(`/custom-fields/${data.id}`, data) : apiClient.post('/custom-fields', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/custom-fields/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-fields'] }),
  });

  const reorderMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      apiClient.post(`/custom-fields/${id}/reorder`, { direction }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-fields'] }),
  });

  const openEdit = (field: CustomField) => {
    setEditing(field);
    setForm({ entityType: field.entityType, fieldName: field.fieldName, label: field.label, fieldType: field.fieldType, options: field.options.join(', ') });
    setShowForm(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      ...form,
      options: form.options ? form.options.split(',').map(s => s.trim()) : [],
      id: editing?.id,
    });
  };

  const grouped = fields.reduce<Record<string, CustomField[]>>((acc, f) => {
    (acc[f.entityType] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trường tùy chỉnh</h1>
        <Button size="sm" onClick={() => { setEditing(null); setForm({ entityType: 'CUSTOMER', fieldName: '', label: '', fieldType: 'TEXT', options: '' }); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" />Thêm trường
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div>
                <Label>Đối tượng</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}>
                  {Object.entries(entityTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><Label>Tên trường</Label><Input value={form.fieldName} onChange={e => setForm(f => ({ ...f, fieldName: e.target.value }))} /></div>
              <div><Label>Nhãn</Label><Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} /></div>
              <div>
                <Label>Loại</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.fieldType} onChange={e => setForm(f => ({ ...f, fieldType: e.target.value }))}>
                  {Object.entries(fieldTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><Label>Tùy chọn (phẩy cách)</Label><Input value={form.options} onChange={e => setForm(f => ({ ...f, options: e.target.value }))} placeholder="A, B, C" /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>{editing ? 'Cập nhật' : 'Lưu'}</Button>
              <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Hủy</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([entityType, entityFields]) => (
        <Card key={entityType}>
          <CardHeader><CardTitle className="text-lg">{entityTypeLabels[entityType] ?? entityType}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên trường</TableHead>
                  <TableHead>Nhãn</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Tùy chọn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entityFields.sort((a, b) => a.sortOrder - b.sortOrder).map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono">{f.fieldName}</TableCell>
                    <TableCell>{f.label}</TableCell>
                    <TableCell>{fieldTypeLabels[f.fieldType]}</TableCell>
                    <TableCell className="text-xs">{f.options.join(', ') || '—'}</TableCell>
                    <TableCell>
                      <span className={cn('text-xs px-2 py-1 rounded', f.isActive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50')}>
                        {f.isActive ? 'Hoạt động' : 'Tắt'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderMutation.mutate({ id: f.id, direction: 'up' })}><ChevronUp className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderMutation.mutate({ id: f.id, direction: 'down' })}><ChevronDown className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(f.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {fields.length === 0 && <p className="text-center text-muted-foreground">Chưa có trường tùy chỉnh</p>}
    </div>
  );
}
