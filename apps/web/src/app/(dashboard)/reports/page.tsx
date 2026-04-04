'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatVND, formatVNDOrDash } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Download, BarChart3, Calculator, X, Loader2, ChevronRight, ChevronDown } from 'lucide-react';

interface ReportItem {
  code?: string;
  label: string;
  description?: string;
  apiEndpoint: string;
  queryParams: (year: string) => Record<string, string>;
}

// Map reports to their API endpoints
const financialReports: ReportItem[] = [
  {
    code: '',
    label: 'Bảng cân đối số phát sinh',
    description: 'Số dư đầu kỳ, phát sinh, số dư cuối kỳ',
    apiEndpoint: 'trial-balance',
    queryParams: (year) => ({ startDate: `${year}-01-01`, endDate: `${year}-12-31` }),
  },
  {
    code: 'B01-DN',
    label: 'Bảng cân đối kế toán',
    description: 'Tình hình tài sản, nguồn vốn',
    apiEndpoint: 'balance-sheet',
    queryParams: (year) => ({ asOfDate: `${year}-12-31`, comparePriorPeriod: 'true' }),
  },
  {
    code: 'B02-DN',
    label: 'Báo cáo kết quả kinh doanh',
    description: 'Doanh thu, chi phí, lợi nhuận',
    apiEndpoint: 'income-statement',
    queryParams: (year) => ({ startDate: `${year}-01-01`, endDate: `${year}-12-31`, comparePriorPeriod: 'true' }),
  },
  {
    code: 'B03-DN',
    label: 'Báo cáo lưu chuyển tiền tệ',
    description: 'Dòng tiền kinh doanh, đầu tư, tài chính',
    apiEndpoint: 'cash-flow',
    queryParams: (year) => ({ startDate: `${year}-01-01`, endDate: `${year}-12-31`, method: 'direct' }),
  },
  {
    code: '',
    label: 'Thuyết minh BCTC',
    description: 'Thuyết minh báo cáo tài chính',
    apiEndpoint: 'notes',
    queryParams: () => ({}), // Requires fiscalYearId - handled separately
  },
  {
    code: '',
    label: 'Báo cáo khấu hao',
    description: 'Chi tiết khấu hao tài sản cố định',
    apiEndpoint: 'depreciation',
    queryParams: (year) => ({ startDate: `${year}-01-01`, endDate: `${year}-12-31` }),
  },
  {
    code: '',
    label: 'Bộ BCTC năm',
    description: 'Tổng hợp báo cáo tài chính năm',
    apiEndpoint: 'annual-package',
    queryParams: () => ({}), // Requires fiscalYearId - handled separately
  },
];

const managementReports: ReportItem[] = [
  {
    label: 'Phân tích tuổi nợ (Aging)',
    description: 'Phân tích tuổi nợ phải thu / phải trả',
    apiEndpoint: 'aging',
    queryParams: (year) => ({ asOfDate: `${year}-12-31` }),
  },
  {
    label: 'Báo cáo doanh thu',
    description: 'Doanh thu theo thời gian, khách hàng, sản phẩm',
    apiEndpoint: 'revenue',
    queryParams: (year) => ({ startDate: `${year}-01-01`, endDate: `${year}-12-31` }),
  },
  {
    label: 'Báo cáo chi phí',
    description: 'Chi phí theo khoản mục, phòng ban',
    apiEndpoint: 'expenses',
    queryParams: (year) => ({ startDate: `${year}-01-01`, endDate: `${year}-12-31` }),
  },
  {
    label: 'Xu hướng tài chính',
    description: 'Biểu đồ xu hướng qua các kỳ',
    apiEndpoint: 'trends',
    queryParams: (year) => ({ year }),
  },
  {
    label: 'Báo cáo dòng tiền',
    description: 'Phân tích dòng tiền chi tiết',
    apiEndpoint: 'cash-flow-analysis',
    queryParams: (year) => ({ startDate: `${year}-01-01`, endDate: `${year}-12-31` }),
  },
];

// Format decimal/number values from API
function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  if (val && typeof val === 'object' && 'toNumber' in val) {
    return (val as { toNumber: () => number }).toNumber();
  }
  return 0;
}

// Trial Balance Account interface
interface TrialBalanceAccount {
  code: string;
  name: string;
  level?: number;
  parentId?: string | null;
  openingDebit: unknown;
  openingCredit: unknown;
  periodDebit: unknown;
  periodCredit: unknown;
  closingDebit: unknown;
  closingCredit: unknown;
  children?: TrialBalanceAccount[];
}

// Trial Balance Account Row with expand/collapse
function TrialBalanceAccountRow({
  account,
  level,
}: {
  account: TrialBalanceAccount;
  level: number;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = account.children && account.children.length > 0;

  return (
    <>
      <TableRow className={level === 0 ? 'bg-muted/20 font-medium' : level === 1 ? 'bg-muted/10' : ''}>
        <TableCell className="font-mono text-xs text-center border-r">
          <div className="flex items-center justify-center gap-1" style={{ paddingLeft: `${level * 12}px` }}>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex h-4 w-4 shrink-0 items-center justify-center"
            >
              {hasChildren ? (
                expanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )
              ) : (
                <span className="h-3 w-3" />
              )}
            </button>
            <span>{account.code}</span>
          </div>
        </TableCell>
        <TableCell className="text-xs border-r" style={{ paddingLeft: `${level * 12 + 16}px` }}>
          {account.name}
        </TableCell>
        <TableCell className="text-right font-mono text-xs">
          {formatVNDOrDash(toNumber(account.openingDebit))}
        </TableCell>
        <TableCell className="text-right font-mono text-xs border-r">
          {formatVNDOrDash(toNumber(account.openingCredit))}
        </TableCell>
        <TableCell className="text-right font-mono text-xs">
          {formatVNDOrDash(toNumber(account.periodDebit))}
        </TableCell>
        <TableCell className="text-right font-mono text-xs border-r">
          {formatVNDOrDash(toNumber(account.periodCredit))}
        </TableCell>
        <TableCell className="text-right font-mono text-xs">
          {formatVNDOrDash(toNumber(account.closingDebit))}
        </TableCell>
        <TableCell className="text-right font-mono text-xs">
          {formatVNDOrDash(toNumber(account.closingCredit))}
        </TableCell>
      </TableRow>
      {expanded && hasChildren && account.children!.map((child) => (
        <TrialBalanceAccountRow key={child.code} account={child} level={level + 1} />
      ))}
    </>
  );
}

// Build tree structure from flat list
function buildTrialBalanceTree(accounts: TrialBalanceAccount[]): TrialBalanceAccount[] {
  if (accounts.length === 0) return [];

  // Create a map to track parent accounts and their aggregated values
  const parentMap = new Map<string, {
    code: string;
    name: string;
    openingDebit: number;
    openingCredit: number;
    periodDebit: number;
    periodCredit: number;
    closingDebit: number;
    closingCredit: number;
    children: TrialBalanceAccount[];
  }>();

  const accountMap = new Map<string, TrialBalanceAccount>();
  const tree: TrialBalanceAccount[] = [];

  // First pass: identify accounts that need parents and create parent stubs
  accounts.forEach(acc => {
    accountMap.set(acc.code, { ...acc, children: [] });

    // Check if this account needs a parent (has - in code like 131-0001)
    if (acc.code.includes('-')) {
      const parentCode = acc.code.split('-')[0]!;
      
      // Create parent if it doesn't exist
      if (!parentMap.has(parentCode)) {
        parentMap.set(parentCode, {
          code: parentCode,
          name: getParentAccountName(parentCode, acc.name),
          openingDebit: 0,
          openingCredit: 0,
          periodDebit: 0,
          periodCredit: 0,
          closingDebit: 0,
          closingCredit: 0,
          children: [],
        });
      }
      
      // Aggregate values to parent
      const parent = parentMap.get(parentCode)!;
      parent.openingDebit += toNumber(acc.openingDebit);
      parent.openingCredit += toNumber(acc.openingCredit);
      parent.periodDebit += toNumber(acc.periodDebit);
      parent.periodCredit += toNumber(acc.periodCredit);
      parent.closingDebit += toNumber(acc.closingDebit);
      parent.closingCredit += toNumber(acc.closingCredit);
    }
  });

  // Second pass: build tree structure
  accounts.forEach(acc => {
    const node = accountMap.get(acc.code);
    if (!node) return;

    if (acc.code.includes('-')) {
      const parentCode = acc.code.split('-')[0]!;
      const parent = parentMap.get(parentCode);
      
      if (parent) {
        parent.children.push(node);
      } else {
        tree.push(node);
      }
    } else {
      // Standalone account without sub-accounts
      tree.push(node);
    }
  });

  // Add parent accounts to tree
  parentMap.forEach(parent => {
    tree.push(parent as TrialBalanceAccount);
  });

  // Sort tree by account code
  tree.sort((a, b) => a.code.localeCompare(b.code));

  return tree;
}

// Helper function to extract parent account name
function getParentAccountName(parentCode: string, childName: string): string {
  // Extract base name from child (e.g., "Phải thu của khách hàng - Cty ABC" -> "Phải thu của khách hàng")
  const baseNames: Record<string, string> = {
    '131': 'Phải thu của khách hàng',
    '331': 'Phải trả người bán',
    '138': 'Phải thu khác',
    '141': 'Trả trước cho người bán',
    '112': 'Tiền gửi ngân hàng',
    '156': 'Hàng hóa',
    '333': 'Thuế và các khoản phải nộp Nhà Nước',
    '334': 'Phải trả cho người lao động',
    '338': 'Phải trả, phải nộp khác',
  };
  
  return baseNames[parentCode] || parentCode;
}

// Trial Balance Report View
function TrialBalanceView({ data }: { data: Record<string, unknown> }) {
  const accountsFlat = (data.lines || []) as TrialBalanceAccount[];
  // Always build tree from flat list to ensure proper parent-child relationships
  const accountsTree = buildTrialBalanceTree(accountsFlat);

  const totals = data.totals as {
    openingDebit: unknown;
    openingCredit: unknown;
    periodDebit: unknown;
    periodCredit: unknown;
    closingDebit: unknown;
    closingCredit: unknown;
  } | undefined;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-bold">BẢNG CÂN ĐỐI SỐ PHÁT SINH</h2>
        <p className="text-sm text-muted-foreground">
          Từ ngày {data.startDate as string} đến ngày {data.endDate as string}
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="text-center border-r">SHTK</TableHead>
              <TableHead rowSpan={2} className="border-r">TÊN TÀI KHOẢN</TableHead>
              <TableHead colSpan={2} className="text-center border-r">SỐ DƯ ĐẦU KỲ</TableHead>
              <TableHead colSpan={2} className="text-center border-r">PHÁT SINH TRONG KỲ</TableHead>
              <TableHead colSpan={2} className="text-center">SỐ DƯ CUỐI KỲ</TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="text-right text-xs">Nợ</TableHead>
              <TableHead className="text-right text-xs border-r">Có</TableHead>
              <TableHead className="text-right text-xs">Nợ</TableHead>
              <TableHead className="text-right text-xs border-r">Có</TableHead>
              <TableHead className="text-right text-xs">Nợ</TableHead>
              <TableHead className="text-right text-xs">Có</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accountsTree.map((acc) => (
              <TrialBalanceAccountRow key={acc.code} account={acc} level={0} />
            ))}
            {totals && (
              <TableRow className="font-semibold bg-muted/30">
                <TableCell colSpan={2} className="text-xs border-r">Tổng cộng</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatVNDOrDash(toNumber(totals.openingDebit))}
                </TableCell>
                <TableCell className="text-right font-mono text-xs border-r">
                  {formatVNDOrDash(toNumber(totals.openingCredit))}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatVNDOrDash(toNumber(totals.periodDebit))}
                </TableCell>
                <TableCell className="text-right font-mono text-xs border-r">
                  {formatVNDOrDash(toNumber(totals.periodCredit))}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatVNDOrDash(toNumber(totals.closingDebit))}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatVNDOrDash(toNumber(totals.closingCredit))}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {accountsTree.length === 0 && (
        <div className="text-center text-amber-600 text-sm mt-2">
          💡 Chưa có dữ liệu. Tạo chứng từ và ghi sổ để thấy báo cáo.
        </div>
      )}
    </div>
  );
}

// Balance Sheet Report View
function BalanceSheetView({ data }: { data: Record<string, unknown> }) {
  const currentAssets = data.currentAssets as { total: unknown; accounts?: Array<{ code: string; name: string; balance: unknown }> };
  const nonCurrentAssets = data.nonCurrentAssets as { total: unknown; accounts?: Array<{ code: string; name: string; balance: unknown }> };
  const liabilities = data.liabilities as { total: unknown; accounts?: Array<{ code: string; name: string; balance: unknown }> };
  const equity = data.equity as { total: unknown; accounts?: Array<{ code: string; name: string; balance: unknown }> };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-bold">BẢNG CÂN ĐỐI KẾ TOÁN</h2>
        <p className="text-sm text-muted-foreground">Tại ngày: {data.asOfDate as string}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Assets */}
        <div>
          <h3 className="mb-2 font-semibold border-b pb-1">TÀI SẢN</h3>
          <div className="space-y-2">
            <div className="font-medium">A. Tài sản ngắn hạn</div>
            {currentAssets?.accounts?.map((acc) => (
              <div key={acc.code} className="flex justify-between text-sm pl-4">
                <span>{acc.code} - {acc.name}</span>
                <span className="font-mono">{formatVND(toNumber(acc.balance))}</span>
              </div>
            ))}
            <div className="flex justify-between font-medium border-t pt-1">
              <span>Cộng tài sản ngắn hạn</span>
              <span className="font-mono">{formatVND(toNumber(currentAssets?.total))}</span>
            </div>

            <div className="font-medium mt-4">B. Tài sản dài hạn</div>
            {nonCurrentAssets?.accounts?.map((acc) => (
              <div key={acc.code} className="flex justify-between text-sm pl-4">
                <span>{acc.code} - {acc.name}</span>
                <span className="font-mono">{formatVND(toNumber(acc.balance))}</span>
              </div>
            ))}
            <div className="flex justify-between font-medium border-t pt-1">
              <span>Cộng tài sản dài hạn</span>
              <span className="font-mono">{formatVND(toNumber(nonCurrentAssets?.total))}</span>
            </div>

            <div className="flex justify-between font-bold border-t-2 pt-2 mt-4">
              <span>TỔNG CỘNG TÀI SẢN</span>
              <span className="font-mono">{formatVND(toNumber(data.totalAssets))}</span>
            </div>
          </div>
        </div>

        {/* Liabilities & Equity */}
        <div>
          <h3 className="mb-2 font-semibold border-b pb-1">NGUỒN VỐN</h3>
          <div className="space-y-2">
            <div className="font-medium">A. Nợ phải trả</div>
            {liabilities?.accounts?.map((acc) => (
              <div key={acc.code} className="flex justify-between text-sm pl-4">
                <span>{acc.code} - {acc.name}</span>
                <span className="font-mono">{formatVND(toNumber(acc.balance))}</span>
              </div>
            ))}
            <div className="flex justify-between font-medium border-t pt-1">
              <span>Cộng nợ phải trả</span>
              <span className="font-mono">{formatVND(toNumber(liabilities?.total))}</span>
            </div>

            <div className="font-medium mt-4">B. Vốn chủ sở hữu</div>
            {equity?.accounts?.map((acc) => (
              <div key={acc.code} className="flex justify-between text-sm pl-4">
                <span>{acc.code} - {acc.name}</span>
                <span className="font-mono">{formatVND(toNumber(acc.balance))}</span>
              </div>
            ))}
            <div className="flex justify-between font-medium border-t pt-1">
              <span>Cộng vốn chủ sở hữu</span>
              <span className="font-mono">{formatVND(toNumber(equity?.total))}</span>
            </div>

            <div className="flex justify-between font-bold border-t-2 pt-2 mt-4">
              <span>TỔNG CỘNG NGUỒN VỐN</span>
              <span className="font-mono">{formatVND(toNumber(data.totalLiabilitiesAndEquity))}</span>
            </div>
          </div>
        </div>
      </div>

      {data.isBalanced === false && (
        <div className="text-center text-red-500 font-medium">
          ⚠️ Bảng cân đối chưa cân: Tài sản ≠ Nguồn vốn
        </div>
      )}

      {toNumber(data.totalAssets) === 0 && (
        <div className="text-center text-amber-600 text-sm mt-2">
          💡 Chưa có dữ liệu. Tạo chứng từ và ghi sổ để thấy báo cáo.
        </div>
      )}
    </div>
  );
}

// Income Statement View
function IncomeStatementView({ data }: { data: Record<string, unknown> }) {
  const items = [
    { label: '1. Doanh thu bán hàng và cung cấp dịch vụ', value: (data.revenue as { total: unknown })?.total },
    { label: '2. Giá vốn hàng bán', value: (data.cogs as { total: unknown })?.total, negative: true },
    { label: '3. Lợi nhuận gộp (= 1 - 2)', value: data.grossProfit, bold: true },
    { label: '4. Doanh thu hoạt động tài chính', value: (data.financialIncome as { total: unknown })?.total },
    { label: '5. Chi phí tài chính', value: (data.financialExpense as { total: unknown })?.total, negative: true },
    { label: '6. Chi phí bán hàng', value: (data.sellingExpense as { total: unknown })?.total, negative: true },
    { label: '7. Chi phí quản lý doanh nghiệp', value: (data.adminExpense as { total: unknown })?.total, negative: true },
    { label: '8. Lợi nhuận thuần từ HĐKD (= 3+4-5-6-7)', value: data.operatingProfit, bold: true },
    { label: '9. Thu nhập khác', value: (data.otherIncome as { total: unknown })?.total },
    { label: '10. Chi phí khác', value: (data.otherExpense as { total: unknown })?.total, negative: true },
    { label: '11. Lợi nhuận khác (= 9 - 10)', value: data.otherProfit },
    { label: '12. Lợi nhuận trước thuế (= 8 + 11)', value: data.profitBeforeTax, bold: true },
    { label: '13. Chi phí thuế TNDN', value: (data.corporateIncomeTax as { total: unknown })?.total, negative: true },
    { label: '14. Lợi nhuận sau thuế (= 12 - 13)', value: data.netProfit, bold: true, highlight: true },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-bold">BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH</h2>
        <p className="text-sm text-muted-foreground">
          Từ ngày {data.startDate as string} đến ngày {data.endDate as string}
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Chỉ tiêu</TableHead>
            <TableHead className="text-right">Số tiền (₫)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.label} className={item.highlight ? 'bg-primary/5' : ''}>
              <TableCell className={item.bold ? 'font-semibold' : ''}>{item.label}</TableCell>
              <TableCell className={`text-right font-mono ${item.bold ? 'font-semibold' : ''}`}>
                {formatVND(toNumber(item.value))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {toNumber(data.netProfit) === 0 && toNumber((data.revenue as { total: unknown })?.total) === 0 && (
        <div className="text-center text-amber-600 text-sm mt-2">
          💡 Chưa có dữ liệu doanh thu/chi phí. Tạo chứng từ và ghi sổ để thấy báo cáo.
        </div>
      )}
    </div>
  );
}

// Cash Flow Statement View
function CashFlowView({ data }: { data: Record<string, unknown> }) {
  const operating = data.operating as { total: unknown };
  const investing = data.investing as { total: unknown };
  const financing = data.financing as { total: unknown };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-bold">BÁO CÁO LƯU CHUYỂN TIỀN TỆ</h2>
        <p className="text-sm text-muted-foreground">
          Từ ngày {data.startDate as string} đến ngày {data.endDate as string}
        </p>
      </div>

      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="font-semibold">Tiền đầu kỳ</TableCell>
            <TableCell className="text-right font-mono">{formatVND(toNumber(data.openingCash))}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">I. Lưu chuyển tiền từ HĐKD</TableCell>
            <TableCell className="text-right font-mono">{formatVND(toNumber(operating?.total))}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">II. Lưu chuyển tiền từ HĐĐT</TableCell>
            <TableCell className="text-right font-mono">{formatVND(toNumber(investing?.total))}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">III. Lưu chuyển tiền từ HĐTC</TableCell>
            <TableCell className="text-right font-mono">{formatVND(toNumber(financing?.total))}</TableCell>
          </TableRow>
          <TableRow className="border-t-2">
            <TableCell className="font-bold">Lưu chuyển tiền thuần trong kỳ</TableCell>
            <TableCell className="text-right font-mono font-bold">{formatVND(toNumber(data.netChange))}</TableCell>
          </TableRow>
          <TableRow className="bg-primary/5">
            <TableCell className="font-bold">Tiền cuối kỳ</TableCell>
            <TableCell className="text-right font-mono font-bold">{formatVND(toNumber(data.closingCash))}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

// Generic Report View for other report types
function GenericReportView({ data, reportName }: { data: Record<string, unknown>; reportName: string }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-bold">{reportName}</h2>
      </div>
      <pre className="text-sm bg-muted p-4 rounded-md overflow-auto max-h-96">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function ReportCard({
  report,
  period,
  onView,
  onExport,
}: {
  report: ReportItem;
  period: string;
  onView: () => void;
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
        <Button variant="ghost" size="sm" onClick={onView}>
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
  // Default to current year - user may have already entered data
  const [period, setPeriod] = useState(new Date().getFullYear().toString());
  const [viewingReport, setViewingReport] = useState<ReportItem | null>(null);

  // Fetch report data when viewing
  const queryParams = viewingReport?.queryParams(period) ?? {};
  const queryString = new URLSearchParams(queryParams).toString();
  
  const { data: reportData, isLoading: reportLoading, error: reportError } = useQuery({
    queryKey: ['report', viewingReport?.apiEndpoint, period],
    queryFn: () => apiClient.get(`/financial-reports/${viewingReport?.apiEndpoint}?${queryString}`),
    enabled: !!viewingReport,
  });

  function handleView(report: ReportItem) {
    setViewingReport(report);
  }

  function handleExport(report: ReportItem, format: 'pdf' | 'excel') {
    const params = new URLSearchParams({
      ...report.queryParams(period),
      format,
    });
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1310/api'}/financial-reports/${report.apiEndpoint}/export?${params.toString()}`,
      '_blank',
    );
  }

  function renderReportContent() {
    if (reportLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (reportError) {
      return (
        <div className="text-center py-12 space-y-2">
          <div className="text-red-500">Không thể tải báo cáo</div>
          <p className="text-sm text-muted-foreground">
            Kiểm tra: (1) Có chứng từ đã ghi sổ? (2) Kỳ báo cáo đúng chưa? (3) API endpoint tồn tại?
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {reportError instanceof Error ? reportError.message : 'Unknown error'}
          </p>
        </div>
      );
    }

    if (!reportData || !viewingReport) return null;

    const data = reportData as Record<string, unknown>;

    switch (viewingReport.apiEndpoint) {
      case 'trial-balance':
        return <TrialBalanceView data={data} />;
      case 'balance-sheet':
        return <BalanceSheetView data={data} />;
      case 'income-statement':
        return <IncomeStatementView data={data} />;
      case 'cash-flow':
        return <CashFlowView data={data} />;
      default:
        return <GenericReportView data={data} reportName={viewingReport.label} />;
    }
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
              onView={() => handleView(r)}
              onExport={(fmt) => handleExport(r, fmt)}
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
              onView={() => handleView(r)}
              onExport={(fmt) => handleExport(r, fmt)}
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

      {/* Report View Dialog */}
      <Dialog open={!!viewingReport} onOpenChange={(open: boolean) => !open && setViewingReport(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                {viewingReport?.code && (
                  <span className="mr-2 font-mono text-sm text-muted-foreground">{viewingReport.code}</span>
                )}
                {viewingReport?.label}
              </span>
            </DialogTitle>
          </DialogHeader>
          {renderReportContent()}
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => viewingReport && handleExport(viewingReport, 'pdf')}>
              <Download className="mr-2 h-4 w-4" />
              Xuất PDF
            </Button>
            <Button variant="outline" onClick={() => viewingReport && handleExport(viewingReport, 'excel')}>
              <Download className="mr-2 h-4 w-4" />
              Xuất Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
