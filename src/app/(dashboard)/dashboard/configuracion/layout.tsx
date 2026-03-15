'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { companiesApi, configApi } from '@/lib/api';
import { hasSectionAccess } from '@/lib/role-modules';
import { SUPERADMIN_COMPANY_STORAGE_KEY } from '@/lib/constants';

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

const NAV: { href: string; label: string; sectionId: string }[] = [
  { href: '/dashboard/configuracion/empresa', label: 'Empresa', sectionId: 'empresa' },
  { href: '/dashboard/configuracion/presupuestos-facturas', label: 'Presupuestos y facturas', sectionId: 'presupuestos-facturas' },
  { href: '/dashboard/configuracion/moneda-tasa', label: 'Moneda y tasa', sectionId: 'moneda-tasa' },
];

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      companiesApi
        .list()
        .then((list) => {
          setCompanies(list);
          if (list.length > 0) {
            const stored = typeof window !== 'undefined' ? localStorage.getItem(SUPERADMIN_COMPANY_STORAGE_KEY) : null;
            const id = stored && list.some((c) => c.id === stored) ? stored : list[0].id;
            setSelectedCompanyId(id);
            try {
              if (typeof window !== 'undefined') localStorage.setItem(SUPERADMIN_COMPANY_STORAGE_KEY, id);
            } catch {}
          }
        })
        .catch(() => {});
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN' && user?.companyId) setSelectedCompanyId(user.companyId);
  }, [user?.role, user?.companyId]);

  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;

  useEffect(() => {
    if (!companyId || !user || user.role === 'SUPER_ADMIN') {
      setAllowedModules(null);
      return;
    }
    configApi.getRoleModules(companyId).then((res) => {
      const list =
        user.role === 'ADMIN' ? (res.admin?.modules ?? []) :
        user.role === 'VENDEDOR' ? (res.vendedor?.modules ?? []) :
        user.role === 'SUPERVISOR' ? (res.supervisor?.modules ?? []) : [];
      setAllowedModules(list);
    }).catch(() => setAllowedModules([]));
  }, [companyId, user?.role, user?.companyId]);

  const allowedNav = allowedModules === null ? NAV : NAV.filter((item) => hasSectionAccess('CONFIGURACION', item.sectionId, allowedModules));
  const currentSectionId = pathname?.split('/').pop() ?? '';
  const canAccessCurrent = allowedModules === null || hasSectionAccess('CONFIGURACION', currentSectionId, allowedModules);

  useEffect(() => {
    if (allowedModules === null || canAccessCurrent) return;
    if (allowedNav.length > 0) router.replace(allowedNav[0].href);
    else router.replace('/dashboard');
  }, [allowedModules, canAccessCurrent, allowedNav, router]);

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
              onChange={(e) => {
                const id = e.target.value || null;
                setSelectedCompanyId(id);
                try {
                  if (id && typeof window !== 'undefined') localStorage.setItem(SUPERADMIN_COMPANY_STORAGE_KEY, id);
                } catch {}
              }}
              className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2 mt-6 border-b border-[var(--border)]">
          {allowedNav.map(({ href, label }) => (
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
