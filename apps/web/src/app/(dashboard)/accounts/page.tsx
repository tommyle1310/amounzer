'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, ChevronDown, Plus, Pencil, Ban, Search, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
  isActive: boolean;
  children?: Account[];
}

const accountTypeLabels: Record<string, string> = {
  ASSET: 'Tài sản',
  LIABILITY: 'Nợ phải trả',
  EQUITY: 'Vốn chủ sở hữu',
  REVENUE: 'Doanh thu',
  EXPENSE: 'Chi phí',
  OFF_BALANCE_SHEET: 'Ngoại bảng',
};

function AccountRow({
  account,
  level,
  onAddChild,
  onEdit,
  onToggleActive,
}: {
  account: Account;
  level: number;
  onAddChild: (parentId: string) => void;
  onEdit: (account: Account) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(level < 1);
  const hasChildren = account.children && account.children.length > 0;

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 border-b px-4 py-2 hover:bg-accent/50',
          !account.isActive && 'opacity-50',
        )}
        style={{ paddingLeft: `${level * 24 + 16}px` }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex h-5 w-5 shrink-0 items-center justify-center"
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="h-4 w-4" />
          )}
        </button>
        <span className="w-24 shrink-0 font-mono text-sm font-medium">{account.code}</span>
        <span className="flex-1 text-sm">{account.name}</span>
        <span className="w-32 shrink-0 text-xs text-muted-foreground">
          {accountTypeLabels[account.accountType] ?? account.accountType}
        </span>
        <span
          className={cn(
            'w-20 shrink-0 text-center text-xs',
            account.isActive ? 'text-green-600' : 'text-red-500',
          )}
        >
          {account.isActive ? 'Hoạt động' : 'Vô hiệu'}
        </span>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddChild(account.id)}>
            <Plus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(account)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onToggleActive(account.id, !account.isActive)}
          >
            <Ban className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {expanded &&
        hasChildren &&
        account.children!.map((child) => (
          <AccountRow
            key={child.id}
            account={child}
            level={level + 1}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
          />
        ))}
    </>
  );
}

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ['chart-of-accounts'],
    queryFn: () => apiClient.get('/accounts/tree'),
  });

  const seedMutation = useMutation({
    mutationFn: (standard: 'TT200' | 'TT133') =>
      apiClient.post('/accounts/seed', { standard }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/accounts/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }),
  });

  function filterAccounts(list: Account[], query: string): Account[] {
    if (!query) return list;
    const q = query.toLowerCase();
    return list.reduce<Account[]>((acc, item) => {
      const matches = item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
      const filteredChildren = item.children ? filterAccounts(item.children, query) : [];
      if (matches || filteredChildren.length > 0) {
        acc.push({ ...item, children: matches ? item.children : filteredChildren });
      }
      return acc;
    }, []);
  }

  const filtered = filterAccounts(accounts, searchQuery);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hệ thống tài khoản</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate('TT200')}
            disabled={seedMutation.isPending}
          >
            <Database className="mr-1 h-4 w-4" />
            Tạo theo TT200
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate('TT133')}
            disabled={seedMutation.isPending}
          >
            <Database className="mr-1 h-4 w-4" />
            Tạo theo TT133
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Tìm theo mã hoặc tên tài khoản..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Column headers */}
          <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span className="w-5 shrink-0" />
            <span className="w-24 shrink-0">Mã TK</span>
            <span className="flex-1">Tên tài khoản</span>
            <span className="w-32 shrink-0">Loại</span>
            <span className="w-20 shrink-0 text-center">Trạng thái</span>
            <span className="w-[88px] shrink-0 text-center">Thao tác</span>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {searchQuery ? 'Không tìm thấy tài khoản' : 'Chưa có hệ thống tài khoản. Hãy tạo theo TT200 hoặc TT133.'}
            </div>
          ) : (
            filtered.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                level={0}
                onAddChild={(parentId) => {
                  // TODO: open add child dialog
                  console.log('Add child to', parentId);
                }}
                onEdit={(acc) => {
                  // TODO: open edit dialog
                  console.log('Edit', acc.id);
                }}
                onToggleActive={(id, isActive) => toggleActiveMutation.mutate({ id, isActive })}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
