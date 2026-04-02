'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreviewRow {
  row: number;
  data: Record<string, string>;
  errors: string[];
}

interface ImportPreview {
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: PreviewRow[];
  columns: string[];
}

interface Template {
  entityType: string;
  label: string;
  downloadUrl: string;
}

const entityTypes = [
  { value: 'ACCOUNT', label: 'Tài khoản' },
  { value: 'CUSTOMER', label: 'Khách hàng' },
  { value: 'VENDOR', label: 'Nhà cung cấp' },
  { value: 'INVENTORY_ITEM', label: 'Hàng hóa' },
  { value: 'FIXED_ASSET', label: 'Tài sản cố định' },
  { value: 'EMPLOYEE', label: 'Nhân viên' },
  { value: 'JOURNAL_ENTRY', label: 'Bút toán' },
];

const exportFormats = [
  { value: 'excel', label: 'Excel (.xlsx)' },
  { value: 'pdf', label: 'PDF' },
];

export default function ImportExportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importEntity, setImportEntity] = useState('ACCOUNT');
  const [importStep, setImportStep] = useState<'select' | 'preview' | 'done'>('select');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [exportEntity, setExportEntity] = useState('ACCOUNT');
  const [exportFormat, setExportFormat] = useState('excel');

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['import-templates'],
    queryFn: () => apiClient.get('/import-export/templates'),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', importEntity);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1310/api'}/import-export/preview`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json() as Promise<ImportPreview>;
    },
    onSuccess: (data) => {
      setPreview(data);
      setImportStep('preview');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => apiClient.post('/import-export/confirm', { entityType: importEntity }),
    onSuccess: () => setImportStep('done'),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const handleExport = () => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1310/api'}/import-export/export?entityType=${exportEntity}&format=${exportFormat}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nhập / Xuất dữ liệu</h1>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">Nhập liệu</TabsTrigger>
          <TabsTrigger value="templates">Mẫu nhập</TabsTrigger>
          <TabsTrigger value="export">Xuất dữ liệu</TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <Card>
            <CardHeader><CardTitle className="text-lg">Nhập dữ liệu từ file</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {importStep === 'select' && (
                <>
                  <div className="max-w-sm space-y-3">
                    <div>
                      <Label>Loại dữ liệu</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={importEntity} onChange={e => setImportEntity(e.target.value)}>
                        {entityTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Chọn file (Excel/CSV)</Label>
                      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="mt-1 block w-full text-sm file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:text-primary-foreground" />
                    </div>
                  </div>
                  {uploadMutation.isPending && <p className="text-sm text-muted-foreground">Đang tải lên...</p>}
                </>
              )}

              {importStep === 'preview' && preview && (
                <>
                  <div className="flex gap-4 text-sm">
                    <span>Tổng: <strong>{preview.totalRows}</strong> dòng</span>
                    <span className="text-green-600">Hợp lệ: <strong>{preview.validRows}</strong></span>
                    <span className="text-red-600">Lỗi: <strong>{preview.errorRows}</strong></span>
                  </div>
                  <div className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Dòng</TableHead>
                          {preview.columns.map(col => <TableHead key={col}>{col}</TableHead>)}
                          <TableHead>Lỗi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.rows.map(row => (
                          <TableRow key={row.row} className={cn(row.errors.length > 0 && 'bg-red-50')}>
                            <TableCell>{row.row}</TableCell>
                            {preview.columns.map(col => <TableCell key={col} className="text-xs">{row.data[col] ?? ''}</TableCell>)}
                            <TableCell>
                              {row.errors.length > 0 && (
                                <div className="flex items-start gap-1">
                                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                  <span className="text-xs text-red-600">{row.errors.join('; ')}</span>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => confirmMutation.mutate()} disabled={preview.validRows === 0}>
                      <Upload className="mr-2 h-4 w-4" />Xác nhận nhập ({preview.validRows} dòng)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setImportStep('select'); setPreview(null); }}>Hủy</Button>
                  </div>
                </>
              )}

              {importStep === 'done' && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Nhập dữ liệu thành công!</span>
                  <Button size="sm" variant="outline" className="ml-4" onClick={() => { setImportStep('select'); setPreview(null); }}>Nhập tiếp</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader><CardTitle className="text-lg">Mẫu nhập dữ liệu</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(templates.length > 0 ? templates : entityTypes.map(t => ({ entityType: t.value, label: t.label, downloadUrl: `/import-export/templates/${t.value}` }))).map(t => (
                  <Card key={t.entityType} className="cursor-pointer hover:bg-accent/50" onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1310/api'}${t.downloadUrl}`, '_blank')}>
                    <CardContent className="flex items-center gap-3 pt-4">
                      <FileSpreadsheet className="h-8 w-8 text-green-600 shrink-0" />
                      <div>
                        <p className="font-medium">{t.label}</p>
                        <p className="text-xs text-muted-foreground">Tải mẫu Excel</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader><CardTitle className="text-lg">Xuất dữ liệu</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label>Loại dữ liệu</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={exportEntity} onChange={e => setExportEntity(e.target.value)}>
                    {entityTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    <option value="BALANCE_SHEET">Bảng cân đối kế toán</option>
                    <option value="INCOME_STATEMENT">Báo cáo kết quả kinh doanh</option>
                    <option value="CASH_FLOW">Lưu chuyển tiền tệ</option>
                    <option value="TRIAL_BALANCE">Bảng cân đối phát sinh</option>
                  </select>
                </div>
                <div>
                  <Label>Định dạng</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
                    {exportFormats.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <Button size="sm" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />Xuất
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
