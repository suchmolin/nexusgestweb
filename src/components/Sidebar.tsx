'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { configApi } from '@/lib/api';
import {
  ModuleIcon,
  IconHome,
  IconSun,
  IconMoon,
  IconLogOut,
  IconPanelLeftClose,
  IconPanelLeftOpen,
  IconX,
} from '@/components/Icons';

const SIDEBAR_COLLAPSED_KEY = 'nexusgest-sidebar-collapsed';

const MODULES: { key: string; label: string; href: string; superAdminOnly?: boolean }[] = [
  { key: 'GESTION_USUARIOS', label: 'Gestión de usuarios', href: '/dashboard/usuarios' },
  { key: 'CONFIGURACION', label: 'Configuración', href: '/dashboard/configuracion' },
  { key: 'CLIENTES', label: 'Clientes', href: '/dashboard/clientes' },
  { key: 'PRESUPUESTOS', label: 'Presupuestos', href: '/dashboard/presupuestos' },
  { key: 'FACTURACION', label: 'Facturación', href: '/dashboard/facturacion' },
  { key: 'CIERRE_CAJA', label: 'Cierres de caja', href: '/dashboard/cierres-caja' },
  { key: 'INVENTARIO', label: 'Inventario', href: '/dashboard/inventario' },
  { key: 'ADMINISTRACION', label: 'Administración', href: '/dashboard/administracion' },
  { key: 'LOGS', label: 'Logs', href: '/dashboard/logs' },
];

function getStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function setStoredCollapsed(value: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? 'true' : 'false');
  } catch {}
}

export function Sidebar({
  mobileOpen = false,
  onClose,
  isMobile = false,
  logoUrl = null,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
  logoUrl?: string | null;
} = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [adminAllowedModules, setAdminAllowedModules] = useState<string[] | null>(null);

  useEffect(() => {
    setCollapsed(getStoredCollapsed());
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setStoredCollapsed(next);
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdminOrSuperAdmin = isSuperAdmin || user?.role === 'ADMIN';

  useEffect(() => {
    if (user?.role === 'ADMIN' && user?.companyId) {
      configApi.getRoleModules(user.companyId).then((res) => {
        if (res.admin?.enabled) {
          setAdminAllowedModules(res.admin.modules ?? []);
        } else {
          setAdminAllowedModules(null);
        }
      }).catch(() => setAdminAllowedModules(null));
    } else {
      setAdminAllowedModules(null);
    }
  }, [user?.role, user?.companyId]);

  const visibleModules = MODULES.filter((m) => {
    if (m.key === 'GESTION_USUARIOS' && !isAdminOrSuperAdmin) return false;
    if (m.superAdminOnly && !isSuperAdmin) return false;
    if (m.key === 'CIERRE_CAJA') return true;
    if (user?.role === 'ADMIN' && adminAllowedModules !== null && !adminAllowedModules.includes(m.key)) return false;
    return true;
  });

  const widthClass = collapsed ? 'w-[4.5rem]' : 'w-64';

  const headerContent = (
    <div className={`border-b border-[var(--border)] overflow-hidden flex-shrink-0 ${
      collapsed
        ? 'flex flex-col items-center gap-2 p-3'
        : 'flex items-center gap-2 p-4'
    }`}>
      <Link
        href="/dashboard"
        className={collapsed ? 'flex flex-col items-center gap-0' : 'flex items-center gap-2 min-w-0 flex-1'}
        onClick={() => onClose?.()}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-9 w-auto max-w-[120px] object-contain object-left flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            N
          </div>
        )}
        {!collapsed && !logoUrl && <span className="font-semibold text-lg truncate">NexusGest</span>}
      </Link>
      {!isMobile && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)] flex-shrink-0"
          title={collapsed ? 'Expandir barra' : 'Solo iconos'}
          aria-label={collapsed ? 'Expandir barra' : 'Solo iconos'}
        >
          {collapsed ? <IconPanelLeftOpen className="w-5 h-5" /> : <IconPanelLeftClose className="w-5 h-5" />}
        </button>
      )}
    </div>
  );

  const sidebarContent = (
    <>
      {headerContent}
      {user?.company?.name && !collapsed && (
        <p className="px-4 py-2 text-sm text-[var(--muted)] truncate border-b border-[var(--border)]" title={user.company.name}>
          {user.company.name}
        </p>
      )}
      <nav className="flex-1 overflow-y-auto p-2">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            pathname === '/dashboard'
              ? 'bg-[var(--primary)] text-white'
              : 'text-[var(--foreground)] hover:bg-[var(--card-hover)]'
          } ${collapsed ? 'justify-center' : ''}`}
          title="Dashboard"
          onClick={() => onClose?.()}
        >
          <IconHome className="w-6 h-6 flex-shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </Link>
        {visibleModules.map((m) => {
          const active = pathname === m.href || pathname.startsWith(m.href + '/');
          return (
            <Link
              key={m.key}
              href={m.href}
              title={m.label}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--foreground)] hover:bg-[var(--card-hover)]'
              } ${collapsed ? 'justify-center' : ''}`}
              onClick={() => onClose?.()}
            >
              <span className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                <ModuleIcon moduleKey={m.key} />
              </span>
              {!collapsed && <span>{m.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t border-[var(--border)]">
        <div className={`flex items-center gap-2 px-3 py-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && <span className="text-xs text-[var(--muted)]">Tema</span>}
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-lg bg-[var(--card-hover)] p-2 text-[var(--foreground)] hover:opacity-90"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <IconSun className="w-5 h-5" /> : <IconMoon className="w-5 h-5" />}
          </button>
        </div>
        {!collapsed && <p className="px-3 py-1 text-xs text-[var(--muted)] truncate">{user?.username}</p>}
        <button
          type="button"
          onClick={() => {
            logout();
            router.push('/login');
          }}
          title="Cerrar sesión"
          className={`w-full mt-1 flex items-center gap-3 px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--card-hover)] rounded-lg ${collapsed ? 'justify-center' : ''}`}
        >
          <IconLogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <div
          role="button"
          tabIndex={0}
          onClick={onClose}
          onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
          className={`fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!mobileOpen}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 max-w-[85vw] bg-[var(--card)] border-r border-[var(--border)] flex flex-col transition-transform duration-200 ease-out md:hidden ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <Link href="/dashboard" className="flex items-center gap-2 min-w-0" onClick={() => onClose?.()}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-9 w-auto max-w-[120px] object-contain" />
              ) : (
                <>
                  <div className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">N</div>
                  <span className="font-semibold text-lg">NexusGest</span>
                </>
              )}
            </Link>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--card-hover)]" aria-label="Cerrar menú">
              <IconX className="w-5 h-5" />
            </button>
          </div>
          {user?.company?.name && <p className="px-4 py-2 text-sm text-[var(--muted)] truncate border-b border-[var(--border)]">{user.company.name}</p>}
          <nav className="flex-1 overflow-y-auto p-2">
            <Link href="/dashboard" onClick={() => onClose?.()} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${pathname === '/dashboard' ? 'bg-[var(--primary)] text-white' : 'text-[var(--foreground)] hover:bg-[var(--card-hover)]'}`}>
              <IconHome className="w-6 h-6 flex-shrink-0" />
              <span>Dashboard</span>
            </Link>
            {visibleModules.map((m) => {
              const active = pathname === m.href || pathname.startsWith(m.href + '/');
              return (
                <Link key={m.key} href={m.href} onClick={() => onClose?.()} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${active ? 'bg-[var(--primary)] text-white' : 'text-[var(--foreground)] hover:bg-[var(--card-hover)]'}`}>
                  <span className="w-6 h-6 flex items-center justify-center flex-shrink-0"><ModuleIcon moduleKey={m.key} /></span>
                  <span>{m.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-[var(--muted)]">Tema</span>
              <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-lg bg-[var(--card-hover)] p-2 text-[var(--foreground)]">
                {theme === 'dark' ? <IconSun className="w-5 h-5" /> : <IconMoon className="w-5 h-5" />}
              </button>
            </div>
            <p className="px-3 py-1 text-xs text-[var(--muted)]">{user?.username}</p>
            <button type="button" onClick={() => { logout(); router.push('/login'); onClose?.(); }} className="w-full mt-1 flex items-center gap-3 px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--card-hover)] rounded-lg">
              <IconLogOut className="w-5 h-5 flex-shrink-0" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside className={`${widthClass} min-h-screen bg-[var(--card)] border-r border-[var(--border)] flex flex-col flex-shrink-0 transition-[width] duration-200 ease-in-out`}>
      {sidebarContent}
    </aside>
  );
}
