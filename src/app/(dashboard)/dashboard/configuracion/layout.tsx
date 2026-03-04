'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { companiesApi } from '@/lib/api';

function getCompanyId(user: { role: string; companyId: string | null } | null, selected: string | null): string | null {
  return user?.role === 'SUPER_ADMIN' ? selected : user?.companyId ?? null;
}

type ConfigContextValue = {
  companyId: string | null;
  companies: { id: string; name: string }[];
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
};

const ConfigContext = createContext<ConfigContextValue>({
  companyId: null,
  companies: [],
  selectedCompanyId: null,
  setSelectedCompanyId: () => {},
});

export function useConfigContext() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfigContext must be used within Configuracion layout');
  return ctx;
}

const NAV = [
  { href: '/dashboard/configuracion/empresa', label: 'Empresa' },
  { href: '/dashboard/configuracion/presupuestos-facturas', label: 'Presupuestos y facturas' },
  { href: '/dashboard/configuracion/moneda-tasa', label: 'Moneda y tasa' },
];

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') companiesApi.list().then(setCompanies).catch(() => {});
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' && companies.length > 0 && !selectedCompanyId) setSelectedCompanyId(companies[0].id);
    if (user?.role !== 'SUPER_ADMIN' && user?.companyId) setSelectedCompanyId(user.companyId);
  }, [user, companies, selectedCompanyId]);

  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;

  if (!user) return null;

  return (
    <ConfigContext.Provider value={{ companyId, companies, selectedCompanyId, setSelectedCompanyId }}>
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Configuración</h1>
        <p className="text-[var(--muted)] mt-1">Datos de la empresa, documentos, moneda y tasas.</p>

        {user.role === 'SUPER_ADMIN' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Empresa</label>
            <select
              value={selectedCompanyId ?? ''}
              onChange={(e) => setSelectedCompanyId(e.target.value || null)}
              className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2 mt-6 border-b border-[var(--border)]">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 font-medium rounded-t-lg ${
                pathname === href
                  ? 'bg-[var(--card)] border border-[var(--border)] border-b-0 -mb-px text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {!companyId ? (
          <p className="mt-6 text-[var(--muted)]">Selecciona una empresa.</p>
        ) : (
          <div className="mt-6">{children}</div>
        )}
      </div>
    </ConfigContext.Provider>
  );
}
