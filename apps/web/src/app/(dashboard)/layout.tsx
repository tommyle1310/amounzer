'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  BarChart3,
  List,
  Receipt,
  Handshake,
  Wallet,
  ShieldAlert,
  Lock,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
  Building2,
  User,
} from 'lucide-react';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
}

const navigation: NavItem[] = [
  { label: 'Tổng quan', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Chứng từ', href: '/vouchers', icon: <FileText className="h-4 w-4" /> },
  { label: 'Sổ sách', href: '/books', icon: <BookOpen className="h-4 w-4" /> },
  { label: 'Báo cáo', href: '/reports', icon: <BarChart3 className="h-4 w-4" /> },
  {
    label: 'Danh mục',
    icon: <List className="h-4 w-4" />,
    children: [
      { label: 'Hệ thống tài khoản', href: '/accounts' },
      { label: 'Khách hàng', href: '/customers' },
      { label: 'Nhà cung cấp', href: '/vendors' },
      { label: 'Hàng tồn kho', href: '/inventory' },
      { label: 'Tài sản cố định', href: '/fixed-assets' },
      { label: 'Nhân viên', href: '/employees' },
    ],
  },
  { label: 'Thuế', href: '/vat', icon: <Receipt className="h-4 w-4" /> },
  { label: 'Công nợ', href: '/ar-ap', icon: <Handshake className="h-4 w-4" /> },
  { label: 'Lương', href: '/payroll', icon: <Wallet className="h-4 w-4" /> },
  { label: 'Dự phòng nợ xấu', href: '/bad-debt', icon: <ShieldAlert className="h-4 w-4" /> },
  { label: 'Khóa sổ', href: '/year-end', icon: <Lock className="h-4 w-4" /> },
  { label: 'Cài đặt', href: '/settings', icon: <Settings className="h-4 w-4" /> },
  {
    label: 'Quản trị',
    icon: <Settings className="h-4 w-4" />,
    children: [
      { label: 'Người dùng', href: '/admin/users' },
      { label: 'Trường tùy chỉnh', href: '/admin/custom-fields' },
      { label: 'Nhật ký hoạt động', href: '/admin/audit' },
      { label: 'Nhập/Xuất dữ liệu', href: '/admin/import-export' },
    ],
  },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  if (item.children) {
    const isActive = item.children.some((child) => pathname === child.href);
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
            isActive && 'bg-accent text-accent-foreground',
          )}
        >
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {expanded && (
          <div className="ml-7 mt-1 space-y-1">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'block rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                  pathname === child.href && 'bg-accent text-accent-foreground font-medium',
                )}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
        pathname === item.href && 'bg-accent text-accent-foreground',
      )}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const router = useRouter();
  const { isLoading, isAuthenticated, company, companies, setCompany, logout } = useAuth();

  // Redirect to setup if no company selected
  useEffect(() => {
    if (!isLoading && isAuthenticated && !company) {
      router.push('/setup');
    }
  }, [isLoading, isAuthenticated, company, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    );
  }

  // Don't render dashboard content if no company yet
  if (!company) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Đang chuyển trang...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>Amounzer</span>
          </Link>
        </div>

        {/* Company switcher */}
        <div className="relative border-b px-3 py-2">
          <button 
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
          >
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate text-left text-sm font-medium">
              {company?.name || 'Chọn công ty'}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
          {companyDropdownOpen && companies.length > 1 && (
            <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-md border bg-background shadow-md">
              {companies.map((c) => (
                <button
                  key={c.id}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent',
                    c.id === company?.id && 'bg-accent'
                  )}
                  onClick={() => {
                    setCompany(c);
                    setCompanyDropdownOpen(false);
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navigation.map((item) => (
            <NavLink key={item.label} item={item} />
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Tài khoản</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
