'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, ChevronDown, Plus, Pencil, Ban, Search, Database, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
  isActive: boolean;
  children?: Account[];
}

interface Partner {
  id: string;
  code: string;
  name: string;
  taxCode?: string;
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
  const [showAddSubAccount, setShowAddSubAccount] = useState(false);
  const [selectedParentAccount, setSelectedParentAccount] = useState<Account | null>(null);
  const [partnerType, setPartnerType] = useState<'customer' | 'vendor'>('customer');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ['chart-of-accounts'],
    queryFn: () => apiClient.get('/chart-of-accounts/tree'),
  });

  // Search partners based on parent account type
  const { data: customersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['customers-search', partnerSearch],
    queryFn: () => apiClient.get(`/customers?search=${encodeURIComponent(partnerSearch)}`),
    enabled: showAddSubAccount && partnerType === 'customer' && partnerSearch.length >= 1,
  });

  const { data: vendorsData } = useQuery<{ data: Partner[] }>({
    queryKey: ['vendors-search', partnerSearch],
    queryFn: () => apiClient.get(`/vendors?search=${encodeURIComponent(partnerSearch)}`),
    enabled: showAddSubAccount && partnerType === 'vendor' && partnerSearch.length >= 1,
  });

  const partners = partnerType === 'customer' ? (customersData?.data ?? []) : (vendorsData?.data ?? []);

  const seedMutation = useMutation({
    mutationFn: (standard: 'TT200' | 'TT133') =>
      apiClient.post('/chart-of-accounts/seed', { standard }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/chart-of-accounts/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }),
  });

  const createSubAccountMutation = useMutation({
    mutationFn: (payload: {
      parentAccountCode: string;
      partnerCode: string;
      partnerName: string;
      partnerType: 'customer' | 'vendor';
      partnerId: string;
    }) => apiClient.post('/chart-of-accounts/partner-subaccount', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      setShowAddSubAccount(false);
      setSelectedParentAccount(null);
      setSelectedPartner(null);
      setPartnerSearch('');
    },
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

  // Find account by ID in tree
  function findAccountById(list: Account[], id: string): Account | null {
    for (const acc of list) {
      if (acc.id === id) return acc;
      if (acc.children) {
        const found = findAccountById(acc.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  function handleAddChild(accountId: string) {
    const account = findAccountById(accounts, accountId);
    if (account) {
      setSelectedParentAccount(account);
      // Auto-detect partner type based on account code
      if (account.code.startsWith('131') || account.code.startsWith('138')) {
        setPartnerType('customer');
      } else if (account.code.startsWith('331') || account.code.startsWith('141')) {
        setPartnerType('vendor');
      }
      setShowAddSubAccount(true);
    }
  }

  function handleCreateSubAccount() {
    if (!selectedParentAccount || !selectedPartner) return;
    createSubAccountMutation.mutate({
      parentAccountCode: selectedParentAccount.code,
      partnerCode: selectedPartner.code,
      partnerName: selectedPartner.name,
      partnerType,
      partnerId: selectedPartner.id,
    });
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

      {/* Add Sub-Account Dialog */}
      {showAddSubAccount && selectedParentAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Thêm tiểu khoản</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowAddSubAccount(false);
                  setSelectedParentAccount(null);
                  setSelectedPartner(null);
                  setPartnerSearch('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tài khoản cha</Label>
                <Input
                  value={`${selectedParentAccount.code} - ${selectedParentAccount.name}`}
                  readOnly
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label>Loại đối tượng</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={partnerType}
                  onChange={(e) => {
                    setPartnerType(e.target.value as 'customer' | 'vendor');
                    setSelectedPartner(null);
                    setPartnerSearch('');
                  }}
                >
                  <option value="customer">Khách hàng (131, 138)</option>
                  <option value="vendor">Nhà cung cấp (331, 141)</option>
                </select>
              </div>

              <div className="relative space-y-2">
                <Label>Chọn {partnerType === 'customer' ? 'khách hàng' : 'nhà cung cấp'}</Label>
                {selectedPartner ? (
                  <div className="flex items-center gap-2 rounded-md border p-2">
                    <span className="font-mono text-sm">{selectedPartner.code}</span>
                    <span className="flex-1 text-sm">{selectedPartner.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setSelectedPartner(null);
                        setPartnerSearch('');
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder={`Tìm ${partnerType === 'customer' ? 'khách hàng' : 'nhà cung cấp'}...`}
                      value={partnerSearch}
                      onChange={(e) => setPartnerSearch(e.target.value)}
                    />
                    {partners.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border bg-background shadow-md">
                        {partners.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="flex w-full gap-2 px-3 py-2 text-sm hover:bg-accent"
                            onClick={() => {
                              setSelectedPartner(p);
                              setPartnerSearch('');
                            }}
                          >
                            <span className="font-mono font-medium">{p.code}</span>
                            <span className="flex-1 text-left">{p.name}</span>
                            {p.taxCode && <span className="text-muted-foreground">{p.taxCode}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {selectedPartner && (
                <div className="space-y-2">
                  <Label>Mã tiểu khoản mới</Label>
                  <Input
                    value={`${selectedParentAccount.code}-${selectedPartner.code}`}
                    readOnly
                    className="bg-muted font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tên: {selectedParentAccount.name} - {selectedPartner.name}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddSubAccount(false);
                    setSelectedParentAccount(null);
                    setSelectedPartner(null);
                    setPartnerSearch('');
                  }}
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleCreateSubAccount}
                  disabled={!selectedPartner || createSubAccountMutation.isPending}
                >
                  {createSubAccountMutation.isPending ? 'Đang tạo...' : 'Tạo tiểu khoản'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
                onAddChild={handleAddChild}
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
