'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { configApi } from '@/lib/api';
import { useIsMobile } from '@/hooks/useIsMobile';
import { IconMenu } from '@/components/Icons';
import { hasModuleAccess } from '@/lib/role-modules';

/** Devuelve la clave del módulo asociada a la ruta, o null si es dashboard home o ruta sin módulo. */
function getModuleKeyFromPath(pathname: string): string | null {
  if (!pathname.startsWith('/dashboard')) return null;
  const rest = pathname.replace(/^\/dashboard\/?/, '') || '';
  if (!rest) return null; // /dashboard
  const segment = rest.split('/')[0];
  const routeToModule: Record<string, string> = {
    'usuarios': 'GESTION_USUARIOS',
    'configuracion': 'CONFIGURACION',
    'clientes': 'CLIENTES',
    'presupuestos': 'PRESUPUESTOS',
    'facturacion': 'FACTURACION',
    'cierres-caja': 'CIERRE_CAJA',
    'inventario': 'INVENTARIO',
    'administracion': 'ADMINISTRACION',
    'logs': 'LOGS',
  };
  return routeToModule[segment] ?? null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);
  const refreshConfigRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.companyId || user.role === 'SUPER_ADMIN') {
      setAllowedModules(null);
      return;
    }
    if (user.role === 'ADMIN') {
      configApi.getRoleModules(user.companyId).then((res) => {
        setAllowedModules(res.admin?.enabled ? (res.admin.modules ?? []) : []);
      }).catch(() => setAllowedModules([]));
      return;
    }
    if (user.role === 'VENDEDOR' || user.role === 'SUPERVISOR') {
      configApi.getRoleModules(user.companyId).then((res) => {
        const roleData = user.role === 'VENDEDOR' ? res.vendedor : res.supervisor;
        setAllowedModules(roleData?.enabled ? (roleData.modules ?? []) : []);
      }).catch(() => setAllowedModules([]));
      return;
    }
    setAllowedModules(null);
  }, [user?.role, user?.companyId]);

  useEffect(() => {
    if (loading || !user || !pathname) return;
    const moduleKey = getModuleKeyFromPath(pathname);
    if (moduleKey === null) return;
    if (moduleKey === 'GESTION_USUARIOS') {
      const isAdminOrSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
      if (!isAdminOrSuperAdmin) {
        router.replace('/dashboard');
        return;
      }
      return;
    }
    if (user.role === 'SUPER_ADMIN') return;
    if (allowedModules === null) return;
    if (!hasModuleAccess(moduleKey, allowedModules)) {
      router.replace('/dashboard');
    }
  }, [loading, user, pathname, allowedModules, router]);

  const refreshConfig = () => {
    if (!user?.companyId) return;
    const cid = user.companyId;
    configApi.get(cid).then((c: any) => {
      setLogoUrl(c?.logoUrl ?? null);
      const root = document.documentElement;
      if (c?.primaryColor) { root.style.setProperty('--primary', c.primaryColor); root.style.setProperty('--primary-hover', c.primaryColor); }
      if (c?.secondaryColor) { root.style.setProperty('--secondary', c.secondaryColor); root.style.setProperty('--secondary-hover', c.secondaryColor); }
      if (c?.alternativeColor) { root.style.setProperty('--alternative', c.alternativeColor); root.style.setProperty('--alternative-hover', c.alternativeColor); }
    }).catch(() => setLogoUrl(null));
  };

  refreshConfigRef.current = refreshConfig;
  useEffect(() => {
    if (!user?.companyId) return;
    refreshConfig();
  }, [user?.companyId]);

  useEffect(() => {
    const onConfigUpdated = () => refreshConfigRef.current();
    window.addEventListener('config-updated', onConfigUpdated);
    return () => window.removeEventListener('config-updated', onConfigUpdated);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-pulse text-[var(--muted)]">Cargando...</div>
      </div>
    );
  }
  if (!user) return null;

  const moduleKey = pathname ? getModuleKeyFromPath(pathname) : null;
  const isAdminOrSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const showChildren =
    moduleKey === null ||
    (moduleKey === 'GESTION_USUARIOS' ? isAdminOrSuperAdmin : true) &&
    (moduleKey !== 'GESTION_USUARIOS' && user.role !== 'SUPER_ADMIN'
      ? allowedModules !== null && hasModuleAccess(moduleKey, allowedModules)
      : true);

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar
        isMobile={isMobile}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        logoUrl={logoUrl}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-20 flex items-center gap-3 p-3 bg-[var(--card)] border-b border-[var(--border)]">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-[var(--foreground)] hover:bg-[var(--card-hover)]"
            aria-label="Abrir menú"
          >
            <IconMenu className="w-6 h-6" />
          </button>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 w-auto max-w-[140px] object-contain object-left" />
          ) : (
            <span className="font-semibold text-lg text-[var(--foreground)]">NexusGest</span>
          )}
        </header>
        <main className="flex-1 overflow-auto">
          {showChildren ? children : (
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="animate-pulse text-[var(--muted)]">
                {allowedModules === null && moduleKey !== null && moduleKey !== 'GESTION_USUARIOS' && user.role !== 'SUPER_ADMIN'
                  ? 'Verificando acceso...'
                  : 'Sin acceso. Redirigiendo...'}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
