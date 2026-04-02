'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { loginSchema, twoFactorVerifySchema } from '@amounzer/shared';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type LoginValues = z.infer<typeof loginSchema>;
type TwoFactorValues = z.infer<typeof twoFactorVerifySchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const twoFactorForm = useForm<TwoFactorValues>({
    resolver: zodResolver(twoFactorVerifySchema),
    defaultValues: { code: '' },
  });

  async function onLogin(data: LoginValues) {
    try {
      setError('');
      const res = await apiClient.post<{
        accessToken?: string;
        refreshToken?: string;
        requires2FA?: boolean;
        tempToken?: string;
      }>('/auth/login', data);

      if (res.requires2FA && res.tempToken) {
        setTempToken(res.tempToken);
        setNeeds2FA(true);
      } else if (res.accessToken) {
        login(res.accessToken, res.refreshToken);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    }
  }

  async function onVerify2FA(data: TwoFactorValues) {
    try {
      setError('');
      const res = await apiClient.post<{ accessToken: string; refreshToken: string }>(
        '/auth/2fa/verify',
        { code: data.code, tempToken },
      );
      login(res.accessToken, res.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mã xác thực không đúng');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Đăng nhập</CardTitle>
          <CardDescription>Phần mềm Kế toán Amounzer</CardDescription>
        </CardHeader>

        {!needs2FA ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@congty.vn"
                  {...loginForm.register('email')}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...loginForm.register('password')}
                />
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                {loginForm.formState.isSubmitting ? 'Đang xử lý...' : 'Đăng nhập'}
              </Button>
              <p className="text-sm text-muted-foreground">
                Chưa có tài khoản?{' '}
                <Link href="/register" className="text-primary underline-offset-4 hover:underline">
                  Đăng ký
                </Link>
              </p>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={twoFactorForm.handleSubmit(onVerify2FA)}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              <p className="text-sm text-muted-foreground">
                Nhập mã xác thực 2 yếu tố từ ứng dụng authenticator của bạn.
              </p>
              <div className="space-y-2">
                <Label htmlFor="code">Mã xác thực</Label>
                <Input
                  id="code"
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-lg tracking-widest"
                  {...twoFactorForm.register('code')}
                />
                {twoFactorForm.formState.errors.code && (
                  <p className="text-sm text-destructive">{twoFactorForm.formState.errors.code.message}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={twoFactorForm.formState.isSubmitting}>
                {twoFactorForm.formState.isSubmitting ? 'Đang xác thực...' : 'Xác nhận'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setNeeds2FA(false);
                  setTempToken('');
                  setError('');
                }}
              >
                Quay lại
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
