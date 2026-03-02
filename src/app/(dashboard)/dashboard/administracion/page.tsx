'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi, companiesApi } from '@/lib/api';

function getCompanyId(user: { role: string; companyId: string | null }, selected: string | null): string | null {
  return user.role === 'SUPER_ADMIN' ? selected : user.companyId;
}

export default function AdministracionPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;
  const [stats, setStats] = useState<{ ingresosCount: number; ingresosTotalCost: number; facturacionCount: number; facturacionTotal: number; balance: number } | null>(null);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') companiesApi.list().then(setCompanies).catch(() => {});
  }, [user?.role]);
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' && companies.length > 0 && !selectedCompanyId) setSelectedCompanyId(companies[0].id);
    if (user?.role !== 'SUPER_ADMIN' && user?.companyId) setSelectedCompanyId(user.companyId);
  }, [user, companies, selectedCompanyId]);

  useEffect(() => {
    if (!companyId) return;
    adminApi.stats(companyId).then(setStats).catch(() => setStats(null));
  }, [companyId]);

  if (!user) return null;

  const maxVal = stats ? Math.max(stats.ingresosTotalCost, stats.facturacionTotal, Math.abs(stats.balance), 1) : 1;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Administración</h1>
      <p className="text-[var(--muted)] mt-1">Resumen de ingresos, facturación y balance.</p>

      {user.role === 'SUPER_ADMIN' && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Empresa</label>
          <select value={selectedCompanyId ?? ''} onChange={(e) => setSelectedCompanyId(e.target.value || null)} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2">
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {!companyId && <p className="mt-4 text-[var(--muted)]">Selecciona una empresa.</p>}

      {companyId && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
              <p className="text-sm text-[var(--muted)]">Ingresos (movimientos)</p>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-1">{stats?.ingresosCount ?? 0}</p>
            </div>
            <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
              <p className="text-sm text-[var(--muted)]">Costo total ingresos</p>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-1">{(stats?.ingresosTotalCost ?? 0).toFixed(2)}</p>
            </div>
            <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
              <p className="text-sm text-[var(--muted)]">Facturación (cant. facturas)</p>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-1">{stats?.facturacionCount ?? 0}</p>
            </div>
            <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
              <p className="text-sm text-[var(--muted)]">Total facturado</p>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-1">{(stats?.facturacionTotal ?? 0).toFixed(2)}</p>
            </div>
          </div>
          <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)]">Balance (facturado − costo ingresos)</p>
            <p className={`text-2xl font-bold mt-1 ${(stats?.balance ?? 0) >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'}`}>
              {(stats?.balance ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <p className="font-medium text-[var(--foreground)] mb-3">Gráfico comparativo</p>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-[var(--muted)]">Costo ingresos</p>
                <div className="h-6 bg-[var(--background)] rounded overflow-hidden mt-1">
                  <div className="h-full bg-[var(--primary)] rounded" style={{ width: `${(stats ? stats.ingresosTotalCost / maxVal : 0) * 100}%`, minWidth: stats?.ingresosTotalCost ? '4px' : 0 }} />
                </div>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Total facturado</p>
                <div className="h-6 bg-[var(--background)] rounded overflow-hidden mt-1">
                  <div className="h-full bg-[var(--success)] rounded" style={{ width: `${(stats ? stats.facturacionTotal / maxVal : 0) * 100}%`, minWidth: stats?.facturacionTotal ? '4px' : 0 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
