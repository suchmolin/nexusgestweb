'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const MODULES: { key: string; label: string; href: string; desc: string; superAdminOnly?: boolean }[] = [
  { key: 'GESTION_USUARIOS', label: 'Gestión de usuarios', href: '/dashboard/usuarios', desc: 'Administrar usuarios admin y módulos por empresa', superAdminOnly: true },
  { key: 'CONFIGURACION', label: 'Configuración', href: '/dashboard/configuracion', desc: 'Datos de empresa, tasas, colores, formatos' },
  { key: 'CLIENTES', label: 'Clientes', href: '/dashboard/clientes', desc: 'Registro y búsqueda de clientes' },
  { key: 'PRESUPUESTOS', label: 'Presupuestos', href: '/dashboard/presupuestos', desc: 'Crear y consultar presupuestos' },
  { key: 'FACTURACION', label: 'Facturación', href: '/dashboard/facturacion', desc: 'Facturas desde presupuesto o nueva' },
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visible.map((m) => (
          <Link
            key={m.key}
            href={m.href}
            className="block p-5 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] hover:shadow-lg transition-all"
          >
            <h2 className="font-semibold text-[var(--foreground)] mb-1">{m.label}</h2>
            <p className="text-sm text-[var(--muted)]">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
