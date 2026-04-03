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
  
  // Mode: 'partner' for customer/vendor linked, 'manual' for custom sub-accounts
  const [subAccountMode, setSubAccountMode] = useState<'partner' | 'manual'>('manual');
  
  // Partner mode fields
  const [partnerType, setPartnerType] = useState<'customer' | 'vendor'>('customer');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  
  // Manual mode fields
  const [manualCodeSuffix, setManualCodeSuffix] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualNameEn, setManualNameEn] = useState('');
  const [manualDescription, setManualDescription] = useState('');

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ['chart-of-accounts'],
    queryFn: () => apiClient.get('/chart-of-accounts/tree'),
  });

  // Search partners based on parent account type
  const { data: customersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['customers-search', partnerSearch],
    queryFn: () => apiClient.get(`/customers?search=${encodeURIComponent(partnerSearch)}`),
    enabled: showAddSubAccount && subAccountMode === 'partner' && partnerType === 'customer' && partnerSearch.length >= 1,
  });

  const { data: vendorsData } = useQuery<{ data: Partner[] }>({
    queryKey: ['vendors-search', partnerSearch],
    queryFn: () => apiClient.get(`/vendors?search=${encodeURIComponent(partnerSearch)}`),
    enabled: showAddSubAccount && subAccountMode === 'partner' && partnerType === 'vendor' && partnerSearch.length >= 1,
  });

  const partners = partnerType === 'customer' ? (customersData?.data ?? []) : (vendorsData?.data ?? []);

  const seedMutation = useMutation({
    mutationFn: (standard: 'TT200' | 'TT133') =>
      apiClient.post('/chart-of-accounts/seed', { standard }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-search'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/chart-of-accounts/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-search'] });
    },
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
      queryClient.invalidateQueries({ queryKey: ['accounts-search'] });
      resetDialog();
    },
  });

  const createManualSubAccountMutation = useMutation({
    mutationFn: (payload: {
      parentAccountCode: string;
      codeSuffix: string;
      name: string;
      nameEn?: string;
      description?: string;
    }) => apiClient.post('/chart-of-accounts/manual-subaccount', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-search'] });
      resetDialog();
    },
  });

  function resetDialog() {
    setShowAddSubAccount(false);
    setSelectedParentAccount(null);
    setSelectedPartner(null);
    setPartnerSearch('');
    setManualCodeSuffix('');
    setManualName('');
    setManualNameEn('');
    setManualDescription('');
    setSubAccountMode('manual');
  }

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
      // Auto-detect mode based on account code
      // Partner mode for receivables/payables accounts (131, 138, 331, 141)
      if (account.code.startsWith('131') || account.code.startsWith('138')) {
        setSubAccountMode('partner');
        setPartnerType('customer');
      } else if (account.code.startsWith('331') || account.code.startsWith('141')) {
        setSubAccountMode('partner');
        setPartnerType('vendor');
      } else {
        // Manual mode for other accounts (e.g., 333, 156, etc.)
        setSubAccountMode('manual');
      }
      setShowAddSubAccount(true);
    }
  }

  function handleCreateSubAccount() {
    if (!selectedParentAccount) return;
    
    if (subAccountMode === 'partner') {
      if (!selectedPartner) return;
      createSubAccountMutation.mutate({
        parentAccountCode: selectedParentAccount.code,
        partnerCode: selectedPartner.code,
        partnerName: selectedPartner.name,
        partnerType,
        partnerId: selectedPartner.id,
      });
    } else {
      if (!manualCodeSuffix || !manualName) return;
      createManualSubAccountMutation.mutate({
        parentAccountCode: selectedParentAccount.code,
        codeSuffix: manualCodeSuffix,
        name: manualName,
        nameEn: manualNameEn || undefined,
        description: manualDescription || undefined,
      });
    }
  }

  const isCreating = createSubAccountMutation.isPending || createManualSubAccountMutation.isPending;
  const canCreate = subAccountMode === 'partner' 
    ? !!selectedPartner 
    : (!!manualCodeSuffix && !!manualName);

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
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Thêm tiểu khoản</CardTitle>
              <Button variant="ghost" size="icon" onClick={resetDialog}>
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

              {/* Mode selector */}
              <div className="space-y-2">
                <Label>Loại tiểu khoản</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={subAccountMode === 'manual' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setSubAccountMode('manual')}
                  >
                    Nhập thủ công
                  </Button>
                  <Button
                    type="button"
                    variant={subAccountMode === 'partner' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setSubAccountMode('partner')}
                  >
                    Theo đối tượng
                  </Button>
                </div>
              </div>

              {subAccountMode === 'manual' ? (
                /* Manual mode */
                <>
                  <div className="space-y-2">
                    <Label>Mã tiểu khoản (phần thêm) *</Label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">{selectedParentAccount.code}</span>
                      <Input
                        placeholder="8, 81, 82..."
                        value={manualCodeSuffix}
                        onChange={(e) => setManualCodeSuffix(e.target.value.replace(/[^0-9]/g, ''))}
                        className="font-mono"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Mã đầy đủ: <span className="font-mono font-medium">{selectedParentAccount.code}{manualCodeSuffix}</span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Tên tiểu khoản *</Label>
                    <Input
                      placeholder="VD: Thuế bảo vệ môi trường"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tên tiếng Anh</Label>
                    <Input
                      placeholder="VD: Environmental protection tax"
                      value={manualNameEn}
                      onChange={(e) => setManualNameEn(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Mô tả</Label>
                    <Input
                      placeholder="Mô tả thêm (tùy chọn)"
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                /* Partner mode */
                <>
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
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetDialog}>
                  Hủy
                </Button>
                <Button onClick={handleCreateSubAccount} disabled={!canCreate || isCreating}>
                  {isCreating ? 'Đang tạo...' : 'Tạo tiểu khoản'}
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
