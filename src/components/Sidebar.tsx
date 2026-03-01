'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const MODULES: { key: string; label: string; href: string; superAdminOnly?: boolean }[] = [
  { key: 'GESTION_USUARIOS', label: 'Gestión de usuarios', href: '/dashboard/usuarios', superAdminOnly: true },
  { key: 'CONFIGURACION', label: 'Configuración', href: '/dashboard/configuracion' },
  { key: 'CLIENTES', label: 'Clientes', href: '/dashboard/clientes' },
  { key: 'PRESUPUESTOS', label: 'Presupuestos', href: '/dashboard/presupuestos' },
  { key: 'FACTURACION', label: 'Facturación', href: '/dashboard/facturacion' },
  { key: 'INVENTARIO', label: 'Inventario', href: '/dashboard/inventario' },
  { key: 'ADMINISTRACION', label: 'Administración', href: '/dashboard/administracion' },
  { key: 'LOGS', label: 'Logs', href: '/dashboard/logs' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const visibleModules = MODULES.filter((m) => {
    if (m.superAdminOnly && !isSuperAdmin) return false;
    return true;
  });

  return (
    <aside className="w-64 min-h-screen bg-[var(--card)] border-r border-[var(--border)] flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-[var(--border)]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white font-bold text-lg">
            N
          </div>
          <span className="font-semibold text-lg">NexusGest</span>
        </Link>
        {user?.company?.name && (
          <p className="text-sm text-[var(--muted)] mt-2 truncate" title={user.company.name}>
            {user.company.name}
          </p>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {visibleModules.map((m) => {
          const active = pathname === m.href || pathname.startsWith(m.href + '/');
          return (
            <Link
              key={m.key}
              href={m.href}
              className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--foreground)] hover:bg-[var(--card-hover)]'
              }`}
            >
              {m.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t border-[var(--border)]">
        <p className="px-3 py-1 text-xs text-[var(--muted)]">{user?.username}</p>
        <button
          type="button"
          onClick={() => {
            logout();
            router.push('/login');
          }}
          className="w-full mt-1 px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--card-hover)] rounded-lg"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
