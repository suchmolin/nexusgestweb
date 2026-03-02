'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { configApi } from '@/lib/api';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.companyId) return;
    const cid = user.companyId;
    configApi.get(cid).then((c: any) => {
      const root = document.documentElement;
      if (c?.primaryColor) { root.style.setProperty('--primary', c.primaryColor); root.style.setProperty('--primary-hover', c.primaryColor); }
      if (c?.secondaryColor) { root.style.setProperty('--secondary', c.secondaryColor); root.style.setProperty('--secondary-hover', c.secondaryColor); }
      if (c?.alternativeColor) { root.style.setProperty('--alternative', c.alternativeColor); root.style.setProperty('--alternative-hover', c.alternativeColor); }
    }).catch(() => {});
  }, [user?.companyId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-pulse text-[var(--muted)]">Cargando...</div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
