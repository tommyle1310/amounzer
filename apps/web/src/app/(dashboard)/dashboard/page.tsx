'use client';

import { useQuery } from '@tanstack/react-query';
import { formatVND } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

interface DashboardKPI {
  revenueMTD: number;
  revenueYTD: number;
  profitMTD: number;
  profitYTD: number;
  arTotal: number;
  apTotal: number;
  cashBalance: number;
  bankBalance: number;
}

const fallbackKPI: DashboardKPI = {
  revenueMTD: 0,
  revenueYTD: 0,
  profitMTD: 0,
  profitYTD: 0,
  arTotal: 0,
  apTotal: 0,
  cashBalance: 0,
  bankBalance: 0,
};

export default function DashboardPage() {
  const { data: kpi = fallbackKPI, isLoading } = useQuery<DashboardKPI>({
    queryKey: ['dashboard-kpi'],
    queryFn: () => apiClient.get('/dashboard/kpi'),
  });

  const cards = [
    {
      title: 'Doanh thu tháng',
      value: kpi.revenueMTD,
      sub: `Năm: ${formatVND(kpi.revenueYTD)} ₫`,
      icon: <TrendingUp className="h-5 w-5 text-green-600" />,
    },
    {
      title: 'Lợi nhuận tháng',
      value: kpi.profitMTD,
      sub: `Năm: ${formatVND(kpi.profitYTD)} ₫`,
      icon: <TrendingDown className="h-5 w-5 text-blue-600" />,
    },
    {
      title: 'Phải thu (AR)',
      value: kpi.arTotal,
      sub: 'Tổng công nợ phải thu',
      icon: <ArrowDownLeft className="h-5 w-5 text-orange-500" />,
    },
    {
      title: 'Phải trả (AP)',
      value: kpi.apTotal,
      sub: 'Tổng công nợ phải trả',
      icon: <ArrowUpRight className="h-5 w-5 text-red-500" />,
    },
    {
      title: 'Tiền mặt',
      value: kpi.cashBalance,
      sub: 'Số dư quỹ tiền mặt',
      icon: <Wallet className="h-5 w-5 text-emerald-600" />,
    },
    {
      title: 'Tiền gửi NH',
      value: kpi.bankBalance,
      sub: 'Số dư tiền gửi ngân hàng',
      icon: <Landmark className="h-5 w-5 text-indigo-600" />,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tổng quan</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-32 animate-pulse rounded bg-muted" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatVND(card.value)} ₫</div>
                  <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Xu hướng doanh thu & chi phí</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-muted-foreground">
            Biểu đồ xu hướng (Recharts) — sẽ cập nhật sau
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
