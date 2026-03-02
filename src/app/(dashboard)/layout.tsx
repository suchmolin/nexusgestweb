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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-pulse text-[var(--muted)]">Cargando...</div>
      </div>
    );
  }
  if (!user) return null;

  useEffect(() => {
    const cid = user.companyId ?? null;
    if (!cid) return;
    configApi.get(cid).then((c: any) => {
      const root = document.documentElement;
      if (c?.primaryColor) { root.style.setProperty('--primary', c.primaryColor); root.style.setProperty('--primary-hover', c.primaryColor); }
      if (c?.secondaryColor) { root.style.setProperty('--secondary', c.secondaryColor); root.style.setProperty('--secondary-hover', c.secondaryColor); }
      if (c?.alternativeColor) { root.style.setProperty('--alternative', c.alternativeColor); root.style.setProperty('--alternative-hover', c.alternativeColor); }
    }).catch(() => {});
  }, [user.companyId]);

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
