'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatVND } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save, Share2, BarChart3, TableIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterRow {
  field: string;
  operator: string;
  value: string;
}

interface ReportResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

const dimensions = [
  { key: 'account', label: 'Tài khoản' },
  { key: 'customer', label: 'Khách hàng' },
  { key: 'vendor', label: 'Nhà cung cấp' },
  { key: 'department', label: 'Phòng ban' },
  { key: 'month', label: 'Tháng' },
  { key: 'quarter', label: 'Quý' },
  { key: 'year', label: 'Năm' },
  { key: 'customField', label: 'Trường tùy chỉnh' },
];

const measures = [
  { key: 'sumRevenue', label: 'Tổng doanh thu' },
  { key: 'sumDebit', label: 'Tổng Nợ' },
  { key: 'sumCredit', label: 'Tổng Có' },
  { key: 'count', label: 'Số lượng' },
  { key: 'avg', label: 'Trung bình' },
];

const filterFields = ['account', 'customer', 'vendor', 'department', 'date', 'amount', 'status'];
const operators = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN'];

export default function ReportBuilderPage() {
  const [selectedDims, setSelectedDims] = useState<string[]>(['account', 'month']);
  const [selectedMeasures, setSelectedMeasures] = useState<string[]>(['sumDebit', 'sumCredit']);
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [templateName, setTemplateName] = useState('');

  const previewMutation = useMutation({
    mutationFn: () => apiClient.post<ReportResult>('/dynamic-reports/preview', {
      dimensions: selectedDims,
      measures: selectedMeasures,
      filters,
    }),
  });

  const saveMutation = useMutation({
    mutationFn: () => apiClient.post('/dynamic-reports/templates', {
      name: templateName,
      dimensions: selectedDims,
      measures: selectedMeasures,
      filters,
    }),
  });

  const toggleDim = (key: string) => {
    setSelectedDims(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);
  };

  const toggleMeasure = (key: string) => {
    setSelectedMeasures(prev => prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]);
  };

  const addFilter = () => setFilters(prev => [...prev, { field: 'account', operator: '=', value: '' }]);
  const removeFilter = (i: number) => setFilters(prev => prev.filter((_, idx) => idx !== i));
  const updateFilter = (i: number, field: keyof FilterRow, value: string) => {
    setFilters(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f));
  };

  const result = previewMutation.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Báo cáo động</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Chiều phân tích</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {dimensions.map(d => (
                <label key={d.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedDims.includes(d.key)} onChange={() => toggleDim(d.key)} className="rounded" />
                  <span className="text-sm">{d.label}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Chỉ số</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {measures.map(m => (
                <label key={m.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedMeasures.includes(m.key)} onChange={() => toggleMeasure(m.key)} className="rounded" />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Bộ lọc</CardTitle>
              <Button size="sm" variant="outline" onClick={addFilter}><Plus className="mr-1 h-3 w-3" />Thêm</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {filters.map((f, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select className="h-8 rounded border border-input bg-background px-2 text-xs flex-1" value={f.field} onChange={e => updateFilter(i, 'field', e.target.value)}>
                    {filterFields.map(ff => <option key={ff} value={ff}>{ff}</option>)}
                  </select>
                  <select className="h-8 rounded border border-input bg-background px-2 text-xs w-16" value={f.operator} onChange={e => updateFilter(i, 'operator', e.target.value)}>
                    {operators.map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <Input className="h-8 text-xs flex-1" value={f.value} onChange={e => updateFilter(i, 'value', e.target.value)} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeFilter(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
              {filters.length === 0 && <p className="text-xs text-muted-foreground">Không có bộ lọc</p>}
            </CardContent>
          </Card>

          <Button className="w-full" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
            Xem trước báo cáo
          </Button>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}>
                <TableIcon className="mr-1 h-4 w-4" />Bảng
              </Button>
              <Button variant={viewMode === 'chart' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('chart')}>
                <BarChart3 className="mr-1 h-4 w-4" />Biểu đồ
              </Button>
            </div>
            <div className="flex gap-2">
              <Input className="w-48 h-9" placeholder="Tên mẫu báo cáo" value={templateName} onChange={e => setTemplateName(e.target.value)} />
              <Button size="sm" variant="outline" onClick={() => saveMutation.mutate()} disabled={!templateName}>
                <Save className="mr-1 h-4 w-4" />Lưu
              </Button>
              <Button size="sm" variant="outline">
                <Share2 className="mr-1 h-4 w-4" />Chia sẻ
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              {!result && !previewMutation.isPending && (
                <p className="text-center text-muted-foreground py-12">Chọn chiều phân tích, chỉ số và nhấn &quot;Xem trước báo cáo&quot;</p>
              )}
              {previewMutation.isPending && (
                <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
              )}
              {result && viewMode === 'table' && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {result.columns.map(col => <TableHead key={col}>{col}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((row, i) => (
                      <TableRow key={i}>
                        {result.columns.map(col => (
                          <TableCell key={col} className={typeof row[col] === 'number' ? 'text-right' : ''}>
                            {typeof row[col] === 'number' ? formatVND(row[col] as number) : String(row[col] ?? '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {result.rows.length === 0 && <TableRow><TableCell colSpan={result.columns.length} className="text-center text-muted-foreground">Không có dữ liệu</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
              {result && viewMode === 'chart' && (
                <div className="space-y-2">
                  {result.rows.slice(0, 20).map((row, i) => {
                    const label = String(result.columns[0] ? row[result.columns[0]] ?? '' : '');
                    const numCols = result.columns.filter(c => typeof row[c] === 'number');
                    const maxVal = Math.max(...result.rows.flatMap(r => numCols.map(c => Number(r[c]) || 0)), 1);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-32 truncate text-xs text-right">{label}</span>
                        <div className="flex-1 flex gap-1">
                          {numCols.map(col => {
                            const val = Number(row[col]) || 0;
                            const pct = (val / maxVal) * 100;
                            return (
                              <div key={col} className="flex-1">
                                <div className="h-5 rounded bg-primary/20" style={{ width: `${Math.max(pct, 2)}%` }}>
                                  <div className="h-full rounded bg-primary text-[10px] text-primary-foreground px-1 leading-5 truncate" style={{ width: '100%' }}>
                                    {formatVND(val)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
