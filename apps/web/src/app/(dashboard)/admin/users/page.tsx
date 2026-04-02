'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDateVN } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, UserCheck, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'VIEWER';
  isActive: boolean;
  lastLoginAt: string | null;
}

const roleLabels: Record<string, string> = { ADMIN: 'Quản trị', ACCOUNTANT: 'Kế toán', VIEWER: 'Xem' };

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'ACCOUNTANT', password: '' });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/auth/users'),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      data.id ? apiClient.patch(`/auth/users/${data.id}`, data) : apiClient.post('/auth/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/auth/users/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({ email: user.email, name: user.name, role: user.role, password: '' });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản lý người dùng</h1>
        <Button size="sm" onClick={() => { setEditing(null); setForm({ email: '', name: '', role: 'ACCOUNTANT', password: '' }); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" />Thêm người dùng
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {showForm && (
            <div className="mb-4 rounded border p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Họ tên</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div>
                  <Label>Vai trò</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="ADMIN">Quản trị</option>
                    <option value="ACCOUNTANT">Kế toán</option>
                    <option value="VIEWER">Xem</option>
                  </select>
                </div>
                {!editing && <div><Label>Mật khẩu</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveMutation.mutate({ ...form, id: editing?.id })}>{editing ? 'Cập nhật' : 'Tạo'}</Button>
                <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Hủy</Button>
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Đăng nhập lần cuối</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{roleLabels[u.role]}</TableCell>
                  <TableCell>
                    <span className={cn('text-xs px-2 py-1 rounded', u.isActive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50')}>
                      {u.isActive ? 'Hoạt động' : 'Vô hiệu'}
                    </span>
                  </TableCell>
                  <TableCell>{u.lastLoginAt ? formatDateVN(u.lastLoginAt) : '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })}>
                        {u.isActive ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chưa có người dùng</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
