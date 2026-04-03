const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1310/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClient {
  private accessToken: string | null = null;
  private companyId: string | null = null;
  // Shared promise to deduplicate concurrent refresh calls
  private refreshPromise: Promise<string | null> | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  setCompanyId(id: string | null) {
    this.companyId = id;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    };
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    if (this.companyId) headers['x-company-id'] = this.companyId;
    return headers;
  }

  /**
   * Attempt a token refresh. Multiple concurrent callers share the same
   * in-flight promise so we only hit /auth/refresh once.
   */
  private tryRefresh(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const refreshToken =
          typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
        if (!refreshToken) return null;

        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) return null;

        const data: { accessToken: string; refreshToken: string } = await res.json();
        this.accessToken = data.accessToken;
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        return data.accessToken;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private forceLogout() {
    this.accessToken = null;
    this.companyId = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('companyId');
      localStorage.removeItem('companyName');
      window.location.href = '/login';
    }
  }

  async request<T>(endpoint: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: options.method || 'GET',
      headers: this.buildHeaders(options.headers),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    // On 401, try to refresh once then retry the original request
    if (response.status === 401 && !isRetry) {
      const newToken = await this.tryRefresh();
      if (newToken) {
        return this.request<T>(endpoint, options, true);
      }
      this.forceLogout();
      throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();

// ============================================================================
// Type Definitions for API Responses
// ============================================================================

export interface Account {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  accountType: string;
  normalBalance: string;
  isSpecialReciprocal?: boolean;
  parentId?: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  taxCode?: string;
  address?: string;
  outstandingBalance?: number;
}

export interface Vendor {
  id: string;
  code: string;
  name: string;
  taxCode?: string;
  address?: string;
  outstandingBalance?: number;
}

export interface TrialBalanceLine {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  level: number;
  parentId?: string;
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
  children?: TrialBalanceLine[];
}

export interface TrialBalanceReport {
  reportType: string;
  reportName: string;
  startDate: string;
  endDate: string;
  lines: TrialBalanceLine[];
  tree?: TrialBalanceLine[];
  totals: {
    openingDebit: string;
    openingCredit: string;
    periodDebit: string;
    periodCredit: string;
    closingDebit: string;
    closingCredit: string;
  };
  validation: {
    isFullyBalanced: boolean;
  };
}

// ============================================================================
// API Helper Functions
// ============================================================================

/**
 * Suggest accounts with prefix/fuzzy search
 * Should be called with debounce (300ms recommended)
 */
export async function suggestAccounts(query: string, limit = 20): Promise<Account[]> {
  if (!query || query.length < 1) return [];
  return apiClient.get<Account[]>(`/chart-of-accounts/suggest?q=${encodeURIComponent(query)}&limit=${limit}`);
}

/**
 * Create a sub-account for a partner (customer/vendor)
 */
export async function createPartnerSubAccount(params: {
  parentAccountCode: string;
  partnerCode: string;
  partnerName: string;
  partnerType: 'customer' | 'vendor';
  partnerId: string;
}): Promise<Account> {
  return apiClient.post<Account>('/chart-of-accounts/partner-subaccount', params);
}

/**
 * Get Trial Balance report (S06-DN)
 */
export async function getTrialBalance(
  startDate: string,
  endDate: string,
  options?: { showTree?: boolean; accountLevel?: number; showZeroBalance?: boolean },
): Promise<TrialBalanceReport> {
  const params = new URLSearchParams({
    startDate,
    endDate,
    ...(options?.showTree !== undefined && { showTree: String(options.showTree) }),
    ...(options?.accountLevel && { accountLevel: String(options.accountLevel) }),
    ...(options?.showZeroBalance && { showZeroBalance: 'true' }),
  });
  return apiClient.get<TrialBalanceReport>(`/financial-reports/trial-balance?${params}`);
}

/**
 * Get partner ledger (detailed transaction history)
 */
export async function getPartnerLedger(
  partnerId: string,
  partnerType: 'customer' | 'vendor',
  startDate: string,
  endDate: string,
) {
  const params = new URLSearchParams({ type: partnerType, startDate, endDate });
  return apiClient.get(`/financial-reports/partner-ledger/${partnerId}?${params}`);
}

/**
 * Get bank account detail for Notes disclosure
 */
export async function getBankAccountDetail(asOfDate: string) {
  return apiClient.get(`/financial-reports/bank-detail?asOfDate=${asOfDate}`);
}

/**
 * Seed chart of accounts with TT99/TT200/TT133 standard
 */
export async function seedChartOfAccounts(standard: 'TT99' | 'TT200' | 'TT133') {
  return apiClient.post('/chart-of-accounts/seed', { standard });
}
