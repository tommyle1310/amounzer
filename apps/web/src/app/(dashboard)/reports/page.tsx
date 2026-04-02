'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Download, BarChart3, Calculator } from 'lucide-react';

interface ReportItem {
  code?: string;
  label: string;
  description?: string;
}

const financialReports: ReportItem[] = [
  { code: 'B01-DN', label: 'Bảng cân đối kế toán', description: 'Tình hình tài sản, nguồn vốn' },
  { code: 'B02-DN', label: 'Báo cáo kết quả kinh doanh', description: 'Doanh thu, chi phí, lợi nhuận' },
  { code: 'B03-DN', label: 'Báo cáo lưu chuyển tiền tệ', description: 'Dòng tiền kinh doanh, đầu tư, tài chính' },
  { label: 'Thuyết minh BCTC', description: 'Thuyết minh báo cáo tài chính' },
  { label: 'Báo cáo khấu hao', description: 'Chi tiết khấu hao tài sản cố định' },
  { label: 'Bộ BCTC năm', description: 'Tổng hợp báo cáo tài chính năm' },
];

const managementReports: ReportItem[] = [
  { label: 'Phân tích tuổi nợ (Aging)', description: 'Phân tích tuổi nợ phải thu / phải trả' },
  { label: 'Báo cáo doanh thu', description: 'Doanh thu theo thời gian, khách hàng, sản phẩm' },
  { label: 'Báo cáo chi phí', description: 'Chi phí theo khoản mục, phòng ban' },
  { label: 'Xu hướng tài chính', description: 'Biểu đồ xu hướng qua các kỳ' },
  { label: 'Báo cáo dòng tiền', description: 'Phân tích dòng tiền chi tiết' },
];

function ReportCard({
  report,
  period,
  onExport,
}: {
  report: ReportItem;
  period: string;
  onExport: (format: 'pdf' | 'excel') => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
        <div>
          <div className="font-medium">
            {report.code && <span className="mr-2 font-mono text-sm text-muted-foreground">{report.code}</span>}
            {report.label}
          </div>
          {report.description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{report.description}</p>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm">
          Xem
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onExport('pdf')}>
          <Download className="mr-1 h-3 w-3" />
          PDF
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onExport('excel')}>
          <Download className="mr-1 h-3 w-3" />
          Excel
        </Button>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState(new Date().getFullYear().toString());

  function handleExport(reportLabel: string, format: 'pdf' | 'excel') {
    const slug = reportLabel
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1310/api'}/reports/${slug}/export?format=${format}&period=${period}`,
      '_blank',
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Báo cáo</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Kỳ báo cáo:</span>
          <Input
            className="w-32"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="2026"
          />
        </div>
      </div>

      {/* Financial reports */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle>Báo cáo tài chính</CardTitle>
          </div>
          <CardDescription>Báo cáo theo chuẩn mực kế toán Việt Nam</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {financialReports.map((r) => (
            <ReportCard
              key={r.label}
              report={r}
              period={period}
              onExport={(fmt) => handleExport(r.label, fmt)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Management reports */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle>Báo cáo quản trị</CardTitle>
          </div>
          <CardDescription>Báo cáo phân tích và quản lý nội bộ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {managementReports.map((r) => (
            <ReportCard
              key={r.label}
              report={r}
              period={period}
              onExport={(fmt) => handleExport(r.label, fmt)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Dynamic report builder */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle>Trình tạo báo cáo</CardTitle>
          </div>
          <CardDescription>Tạo báo cáo tùy chỉnh theo nhu cầu</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-muted-foreground">
            Dynamic Report Builder — sẽ cập nhật sau
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
