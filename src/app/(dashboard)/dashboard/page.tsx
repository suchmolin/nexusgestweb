'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ModuleIcon } from '@/components/Icons';

const MODULES: { key: string; label: string; href: string; desc: string; superAdminOnly?: boolean }[] = [
  { key: 'GESTION_USUARIOS', label: 'Gestión de usuarios', href: '/dashboard/usuarios', desc: 'Administrar usuarios admin y módulos por empresa', superAdminOnly: true },
  { key: 'CONFIGURACION', label: 'Configuración', href: '/dashboard/configuracion', desc: 'Datos de empresa, tasas, colores, formatos' },
  { key: 'CLIENTES', label: 'Clientes', href: '/dashboard/clientes', desc: 'Registro y búsqueda de clientes' },
  { key: 'PRESUPUESTOS', label: 'Presupuestos', href: '/dashboard/presupuestos', desc: 'Crear y consultar presupuestos' },
  { key: 'FACTURACION', label: 'Facturación', href: '/dashboard/facturacion', desc: 'Facturas desde presupuesto o nueva' },
  { key: 'CIERRE_CAJA', label: 'Cierres de caja', href: '/dashboard/cierres-caja', desc: 'Registrar y consultar cierres de caja' },
  { key: 'INVENTARIO', label: 'Inventario', href: '/dashboard/inventario', desc: 'Productos, ingresos y egresos' },
  { key: 'ADMINISTRACION', label: 'Administración', href: '/dashboard/administracion', desc: 'Resumen e indicadores' },
  { key: 'LOGS', label: 'Logs', href: '/dashboard/logs', desc: 'Registro de acciones del sistema' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const visible = MODULES.filter((m) => !m.superAdminOnly || isSuperAdmin);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold text-[var(--foreground)] mb-2">
        Dashboard
      </h1>
      <p className="text-[var(--muted)] mb-8">
        Selecciona un módulo para comenzar.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {visible.map((m) => (
          <Link
            key={m.key}
            href={m.href}
            className="group relative flex flex-col sm:flex-col items-center justify-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] hover:shadow-lg transition-all min-h-[72px] sm:min-h-[120px]"
          >
            <div className="text-[var(--primary)] group-hover:scale-110 transition-transform flex items-center justify-center">
              <ModuleIcon moduleKey={m.key} />
            </div>
            <span className="font-semibold text-[var(--foreground)] text-center text-sm">
              {m.label}
            </span>
            <div
              role="tooltip"
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] shadow-lg text-sm text-[var(--foreground)] whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10 pointer-events-none hidden sm:block"
            >
              {m.desc}
              <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-[var(--border)]" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
