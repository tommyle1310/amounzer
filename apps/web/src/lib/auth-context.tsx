'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient } from './api-client';

interface Company {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  company: Company | null;
  companies: Company[];
}

interface AuthContextValue extends AuthState {
  login: (accessToken: string, refreshToken?: string) => void;
  logout: () => void;
  setCompany: (company: Company) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    company: null,
    companies: [],
  });

  // Load auth state from localStorage on mount
  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    const companyId = localStorage.getItem('companyId');
    const companyName = localStorage.getItem('companyName');

    if (accessToken) {
      apiClient.setAccessToken(accessToken);
      
      if (companyId && companyName) {
        apiClient.setCompanyId(companyId);
        // Still fetch companies list but use stored company
        fetchCompaniesWithSelected(accessToken, { id: companyId, name: companyName });
      } else {
        // Fetch user's companies and auto-select
        fetchUserData(accessToken);
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  async function fetchCompaniesWithSelected(token: string, selectedCompany: Company) {
    try {
      const companiesRes = await apiClient.get<Company[]>('/companies');
      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
        company: selectedCompany,
        companies: companiesRes,
      }));
    } catch {
      // Fallback - just use stored company
      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
        company: selectedCompany,
        companies: [selectedCompany],
      }));
    }
  }

  // Redirect unauthenticated users away from protected routes
  useEffect(() => {
    if (!state.isLoading && !state.isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
      router.push('/login');
    }
  }, [state.isLoading, state.isAuthenticated, pathname, router]);

  async function fetchUserData(token: string) {
    try {
      // Fetch companies
      const companiesRes = await apiClient.get<Company[]>('/companies');
      
      if (companiesRes.length > 0) {
        // Auto-select first company if only one
        const selectedCompany = companiesRes[0]!;
        apiClient.setCompanyId(selectedCompany.id);
        localStorage.setItem('companyId', selectedCompany.id);
        localStorage.setItem('companyName', selectedCompany.name);

        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          isLoading: false,
          company: selectedCompany,
          companies: companiesRes,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          isLoading: false,
          companies: [],
        }));
      }
    } catch {
      // Token invalid, clear and redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('companyId');
      localStorage.removeItem('companyName');
      apiClient.setAccessToken(null);
      apiClient.setCompanyId(null);
      setState((prev) => ({ ...prev, isAuthenticated: false, isLoading: false }));
    }
  }

  const login = useCallback((accessToken: string, refreshToken?: string) => {
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    apiClient.setAccessToken(accessToken);
    fetchUserData(accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('companyId');
    localStorage.removeItem('companyName');
    apiClient.setAccessToken(null);
    apiClient.setCompanyId(null);
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      company: null,
      companies: [],
    });
    router.push('/login');
  }, [router]);

  const setCompany = useCallback((company: Company) => {
    localStorage.setItem('companyId', company.id);
    localStorage.setItem('companyName', company.name);
    apiClient.setCompanyId(company.id);
    setState((prev) => ({ ...prev, company }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setCompany }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
