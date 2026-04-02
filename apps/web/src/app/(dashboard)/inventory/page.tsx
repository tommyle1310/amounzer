'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatVND, formatDateVN } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Package, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  totalValue: number;
  costMethod: 'FIFO' | 'WEIGHTED_AVG' | 'SPECIFIC';
}

interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
  address: string;
  isActive: boolean;
}

interface Movement {
  id: string;
  movementNumber: string;
  date: string;
  type: 'NHAP' | 'XUAT' | 'CHUYEN';
  itemName: string;
  warehouseName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

const costMethodLabels: Record<string, string> = {
  FIFO: 'FIFO',
  WEIGHTED_AVG: 'Bình quân gia quyền',
  SPECIFIC: 'Đích danh',
};

const movementTypeLabels: Record<string, string> = {
  NHAP: 'Nhập kho',
  XUAT: 'Xuất kho',
  CHUYEN: 'Chuyển kho',
};

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [showItemForm, setShowItemForm] = useState(false);
  const [showWarehouseForm, setShowWarehouseForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRecord | null>(null);
  const [itemForm, setItemForm] = useState({ code: '', name: '', unit: '', costMethod: 'WEIGHTED_AVG' });
  const [warehouseForm, setWarehouseForm] = useState({ code: '', name: '', address: '' });
  const [movementForm, setMovementForm] = useState({ itemId: '', warehouseId: '', type: 'NHAP', quantity: '', unitCost: '' });
  const [movFilter, setMovFilter] = useState({ type: '', itemId: '', warehouseId: '', dateFrom: '', dateTo: '' });

  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ['inventory-items'],
    queryFn: () => apiClient.get('/inventory/items'),
  });

  const { data: warehouses = [] } = useQuery<WarehouseRecord[]>({
    queryKey: ['warehouses'],
    queryFn: () => apiClient.get('/inventory/warehouses'),
  });

  const movParams = new URLSearchParams();
  if (movFilter.type) movParams.set('type', movFilter.type);
  if (movFilter.itemId) movParams.set('itemId', movFilter.itemId);
  if (movFilter.warehouseId) movParams.set('warehouseId', movFilter.warehouseId);
  if (movFilter.dateFrom) movParams.set('dateFrom', movFilter.dateFrom);
  if (movFilter.dateTo) movParams.set('dateTo', movFilter.dateTo);

  const { data: movements = [] } = useQuery<Movement[]>({
    queryKey: ['movements', movFilter],
    queryFn: () => apiClient.get(`/inventory/movements?${movParams.toString()}`),
  });

  const saveItemMutation = useMutation({
    mutationFn: (data: typeof itemForm & { id?: string }) =>
      data.id ? apiClient.patch(`/inventory/items/${data.id}`, data) : apiClient.post('/inventory/items', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setShowItemForm(false);
      setEditingItem(null);
      setItemForm({ code: '', name: '', unit: '', costMethod: 'WEIGHTED_AVG' });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/inventory/items/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-items'] }),
  });

  const saveWarehouseMutation = useMutation({
    mutationFn: (data: typeof warehouseForm & { id?: string }) =>
      data.id ? apiClient.patch(`/inventory/warehouses/${data.id}`, data) : apiClient.post('/inventory/warehouses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setShowWarehouseForm(false);
      setEditingWarehouse(null);
      setWarehouseForm({ code: '', name: '', address: '' });
    },
  });

  const deleteWarehouseMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/inventory/warehouses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['warehouses'] }),
  });

  const createMovementMutation = useMutation({
    mutationFn: (data: typeof movementForm) => apiClient.post('/inventory/movements', {
      ...data,
      quantity: Number(data.quantity),
      unitCost: Number(data.unitCost),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setShowMovementForm(false);
      setMovementForm({ itemId: '', warehouseId: '', type: 'NHAP', quantity: '', unitCost: '' });
    },
  });

  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setItemForm({ code: item.code, name: item.name, unit: item.unit, costMethod: item.costMethod });
    setShowItemForm(true);
  };

  const openEditWarehouse = (wh: WarehouseRecord) => {
    setEditingWarehouse(wh);
    setWarehouseForm({ code: wh.code, name: wh.name, address: wh.address });
    setShowWarehouseForm(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Quản lý kho hàng</h1>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Danh mục hàng hóa</TabsTrigger>
          <TabsTrigger value="warehouses">Kho hàng</TabsTrigger>
          <TabsTrigger value="movements">Phiếu nhập/xuất</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Danh mục hàng hóa</CardTitle>
              <Button size="sm" onClick={() => { setEditingItem(null); setItemForm({ code: '', name: '', unit: '', costMethod: 'WEIGHTED_AVG' }); setShowItemForm(true); }}>
                <Plus className="mr-2 h-4 w-4" />Thêm
              </Button>
            </CardHeader>
            <CardContent>
              {showItemForm && (
                <div className="mb-4 rounded border p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div><Label>Mã hàng</Label><Input value={itemForm.code} onChange={e => setItemForm(f => ({ ...f, code: e.target.value }))} /></div>
                    <div><Label>Tên hàng</Label><Input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div><Label>Đơn vị</Label><Input value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} /></div>
                    <div>
                      <Label>Phương pháp giá</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={itemForm.costMethod} onChange={e => setItemForm(f => ({ ...f, costMethod: e.target.value }))}>
                        <option value="WEIGHTED_AVG">Bình quân gia quyền</option>
                        <option value="FIFO">FIFO</option>
                        <option value="SPECIFIC">Đích danh</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveItemMutation.mutate({ ...itemForm, id: editingItem?.id })}>{editingItem ? 'Cập nhật' : 'Lưu'}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowItemForm(false); setEditingItem(null); }}>Hủy</Button>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Tên hàng</TableHead>
                    <TableHead>Đơn vị</TableHead>
                    <TableHead className="text-right">Số lượng</TableHead>
                    <TableHead className="text-right">Giá trị (₫)</TableHead>
                    <TableHead>PP giá</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.code}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">{item.quantity.toLocaleString('vi-VN')}</TableCell>
                      <TableCell className="text-right">{formatVND(item.totalValue)}</TableCell>
                      <TableCell>{costMethodLabels[item.costMethod]}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItemMutation.mutate(item.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Chưa có dữ liệu</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warehouses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Kho hàng</CardTitle>
              <Button size="sm" onClick={() => { setEditingWarehouse(null); setWarehouseForm({ code: '', name: '', address: '' }); setShowWarehouseForm(true); }}>
                <Plus className="mr-2 h-4 w-4" />Thêm kho
              </Button>
            </CardHeader>
            <CardContent>
              {showWarehouseForm && (
                <div className="mb-4 rounded border p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Mã kho</Label><Input value={warehouseForm.code} onChange={e => setWarehouseForm(f => ({ ...f, code: e.target.value }))} /></div>
                    <div><Label>Tên kho</Label><Input value={warehouseForm.name} onChange={e => setWarehouseForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div><Label>Địa chỉ</Label><Input value={warehouseForm.address} onChange={e => setWarehouseForm(f => ({ ...f, address: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveWarehouseMutation.mutate({ ...warehouseForm, id: editingWarehouse?.id })}>{editingWarehouse ? 'Cập nhật' : 'Lưu'}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowWarehouseForm(false); setEditingWarehouse(null); }}>Hủy</Button>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã kho</TableHead>
                    <TableHead>Tên kho</TableHead>
                    <TableHead>Địa chỉ</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.map(wh => (
                    <TableRow key={wh.id}>
                      <TableCell className="font-mono">{wh.code}</TableCell>
                      <TableCell>{wh.name}</TableCell>
                      <TableCell>{wh.address}</TableCell>
                      <TableCell><span className={cn('text-xs px-2 py-1 rounded', wh.isActive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50')}>{wh.isActive ? 'Hoạt động' : 'Ngưng'}</span></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditWarehouse(wh)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteWarehouseMutation.mutate(wh.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {warehouses.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có kho hàng</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Phiếu nhập/xuất kho</CardTitle>
              <Button size="sm" onClick={() => setShowMovementForm(true)}>
                <Plus className="mr-2 h-4 w-4" />Tạo phiếu
              </Button>
            </CardHeader>
            <CardContent>
              {showMovementForm && (
                <div className="mb-4 rounded border p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div>
                      <Label>Hàng hóa</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={movementForm.itemId} onChange={e => setMovementForm(f => ({ ...f, itemId: e.target.value }))}>
                        <option value="">-- Chọn --</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.code} - {i.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Kho</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={movementForm.warehouseId} onChange={e => setMovementForm(f => ({ ...f, warehouseId: e.target.value }))}>
                        <option value="">-- Chọn --</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Loại</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={movementForm.type} onChange={e => setMovementForm(f => ({ ...f, type: e.target.value }))}>
                        <option value="NHAP">Nhập kho</option>
                        <option value="XUAT">Xuất kho</option>
                        <option value="CHUYEN">Chuyển kho</option>
                      </select>
                    </div>
                    <div><Label>Số lượng</Label><Input type="number" value={movementForm.quantity} onChange={e => setMovementForm(f => ({ ...f, quantity: e.target.value }))} /></div>
                    <div><Label>Đơn giá</Label><Input type="number" value={movementForm.unitCost} onChange={e => setMovementForm(f => ({ ...f, unitCost: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => createMovementMutation.mutate(movementForm)}>Tạo phiếu</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowMovementForm(false)}>Hủy</Button>
                  </div>
                </div>
              )}
              <div className="mb-4 flex flex-wrap gap-3">
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={movFilter.type} onChange={e => setMovFilter(f => ({ ...f, type: e.target.value }))}>
                  <option value="">Tất cả loại</option>
                  <option value="NHAP">Nhập kho</option>
                  <option value="XUAT">Xuất kho</option>
                  <option value="CHUYEN">Chuyển kho</option>
                </select>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={movFilter.itemId} onChange={e => setMovFilter(f => ({ ...f, itemId: e.target.value }))}>
                  <option value="">Tất cả hàng</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <Input type="date" className="h-9 w-40" value={movFilter.dateFrom} onChange={e => setMovFilter(f => ({ ...f, dateFrom: e.target.value }))} />
                <Input type="date" className="h-9 w-40" value={movFilter.dateTo} onChange={e => setMovFilter(f => ({ ...f, dateTo: e.target.value }))} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Số phiếu</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Hàng hóa</TableHead>
                    <TableHead>Kho</TableHead>
                    <TableHead className="text-right">Số lượng</TableHead>
                    <TableHead className="text-right">Đơn giá</TableHead>
                    <TableHead className="text-right">Thành tiền (₫)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono">{m.movementNumber}</TableCell>
                      <TableCell>{formatDateVN(m.date)}</TableCell>
                      <TableCell><span className={cn('text-xs px-2 py-1 rounded', m.type === 'NHAP' ? 'bg-green-50 text-green-700' : m.type === 'XUAT' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700')}>{movementTypeLabels[m.type]}</span></TableCell>
                      <TableCell>{m.itemName}</TableCell>
                      <TableCell>{m.warehouseName}</TableCell>
                      <TableCell className="text-right">{m.quantity.toLocaleString('vi-VN')}</TableCell>
                      <TableCell className="text-right">{formatVND(m.unitCost)}</TableCell>
                      <TableCell className="text-right font-medium">{formatVND(m.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                  {movements.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Chưa có phiếu nhập/xuất</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
