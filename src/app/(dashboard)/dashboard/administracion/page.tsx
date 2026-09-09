'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi, companiesApi, type AdminStats } from '@/lib/api';

function getCompanyId(user: { role: string; companyId: string | null }, selected: string | null): string | null {
  return user.role === 'SUPER_ADMIN' ? selected : user.companyId;
}

function money(n: number | undefined | null) {
  return (n ?? 0).toFixed(2);
}

function BalanceCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
      <p className="text-sm text-[var(--muted)]">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${value >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'}`}>
        {money(value)}
      </p>
      <p className="text-xs text-[var(--muted)] mt-2">{hint}</p>
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
      <p className="text-sm text-[var(--muted)]">{title}</p>
      <p className="text-xl font-bold text-[var(--foreground)] mt-1">{value}</p>
      {subtitle && <p className="text-xs text-[var(--muted)] mt-1">{subtitle}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const width = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="font-medium text-[var(--foreground)]">{money(value)}</span>
      </div>
      <div className="h-5 bg-[var(--background)] rounded overflow-hidden">
        <div className={`h-full rounded ${color}`} style={{ width: `${width}%`, minWidth: value ? '4px' : 0 }} />
      </div>
    </div>
  );
}

export default function AdministracionPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState<'general' | 'facturacion' | 'cuentas' | 'inventario'>('general');

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') companiesApi.list().then(setCompanies).catch(() => {});
  }, [user?.role]);
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' && companies.length > 0 && !selectedCompanyId) setSelectedCompanyId(companies[0].id);
    if (user?.role !== 'SUPER_ADMIN' && user?.companyId) setSelectedCompanyId(user.companyId);
  }, [user, companies, selectedCompanyId]);

  useEffect(() => {
    if (!companyId) return;
    adminApi
      .stats(companyId, {
        ...(from && { from }),
        ...(to && { to }),
      })
      .then(setStats)
      .catch(() => setStats(null));
  }, [companyId, from, to]);

  if (!user) return null;

  const inv = stats?.inventario;
  const fac = stats?.facturacion;
  const ar = stats?.cuentasPorCobrar;
  const ap = stats?.cuentasPorPagar;
  const bal = stats?.balances;

  const chartValues = [
    fac?.total ?? stats?.facturacionTotal ?? 0,
    inv?.ingresosTotalCost ?? stats?.ingresosTotalCost ?? 0,
    ar?.pagadasTotal ?? 0,
    ar?.abiertasTotal ?? 0,
    ap?.pagadasTotal ?? 0,
    ap?.abiertasTotal ?? 0,
  ];
  const maxVal = Math.max(...chartValues.map(Math.abs), 1);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Administración</h1>
      <p className="text-[var(--muted)] mt-1">
        Panorama de inventario, facturación, cuentas por cobrar/pagar y balances.
      </p>

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

      {companyId && (
        <div className="mt-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2" />
          </div>
          {(from || to) && (
            <button
              type="button"
              onClick={() => { setFrom(''); setTo(''); }}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]"
            >
              Limpiar fechas
            </button>
          )}
        </div>
      )}

      {!companyId && <p className="mt-4 text-[var(--muted)]">Selecciona una empresa.</p>}

      {companyId && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {([
              ['general', 'Balance general'],
              ['facturacion', 'Facturación e ingresos'],
              ['cuentas', 'Cuentas por cobrar / pagar'],
              ['inventario', 'Inventario'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === id ? 'bg-[var(--primary)] text-white' : 'bg-[var(--card)] border border-[var(--border)]'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {(view === 'general' || view === 'facturacion') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Facturas" value={String(fac?.count ?? stats?.facturacionCount ?? 0)} subtitle={`Subtotal ${money(fac?.subtotal)} · IVA ${money(fac?.iva)}`} />
              <StatCard title="Total facturado" value={money(fac?.total ?? stats?.facturacionTotal)} />
              <StatCard title="Ingresos mercancía" value={String(inv?.ingresosCount ?? stats?.ingresosCount ?? 0)} subtitle={`Costo ${money(inv?.ingresosTotalCost ?? stats?.ingresosTotalCost)}`} />
              <StatCard title="Egresos mercancía" value={String(inv?.egresosCount ?? 0)} subtitle={`Costo ref. ${money(inv?.egresosTotalCost)}`} />
            </div>
          )}

          {(view === 'general' || view === 'cuentas') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard
                title="CxC cobradas"
                value={money(ar?.pagadasTotal)}
                subtitle={`${ar?.pagadasCount ?? 0} registro(s)`}
              />
              <StatCard
                title="CxC abiertas"
                value={money(ar?.abiertasTotal)}
                subtitle={`Pendientes ${money(ar?.pendientesTotal)} · Vencidas ${money(ar?.vencidasTotal)}`}
              />
              <StatCard
                title="CxP pagadas"
                value={money(ap?.pagadasTotal)}
                subtitle={`${ap?.pagadasCount ?? 0} registro(s)`}
              />
              <StatCard
                title="CxP abiertas"
                value={money(ap?.abiertasTotal)}
                subtitle={`Pendientes ${money(ap?.pendientesTotal)} · Vencidas ${money(ap?.vencidasTotal)}`}
              />
            </div>
          )}

          {view === 'inventario' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard title="Movimientos ingreso" value={String(inv?.ingresosCount ?? 0)} subtitle={`Costo total ${money(inv?.ingresosTotalCost)}`} />
              <StatCard title="Movimientos egreso" value={String(inv?.egresosCount ?? 0)} subtitle={`Costo ref. ${money(inv?.egresosTotalCost)}`} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(view === 'general' || view === 'facturacion') && (
              <BalanceCard
                title="Balance facturación − ingresos"
                value={bal?.inventarioFacturacion ?? stats?.balance ?? 0}
                hint="Total facturado menos el costo de mercancía ingresada. Indica margen bruto aproximado sobre inventario."
              />
            )}
            {(view === 'general' || view === 'cuentas') && (
              <>
                <BalanceCard
                  title="Balance cuentas abiertas (CxC − CxP)"
                  value={bal?.cuentasAbiertas ?? 0}
                  hint="Lo que te deben menos lo que debes. Positivo = a tu favor."
                />
                <BalanceCard
                  title="Flujo de cuentas (cobrado − pagado)"
                  value={bal?.flujoCuentas ?? 0}
                  hint="Cuentas por cobrar ya cobradas menos cuentas por pagar ya pagadas."
                />
              </>
            )}
            {view === 'general' && (
              <BalanceCard
                title="Balance general"
                value={bal?.general ?? 0}
                hint="Facturación + CxC cobradas − costo de ingresos − CxP pagadas. Vista consolidada de actividad."
              />
            )}
          </div>

          <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-3">
            <p className="font-medium text-[var(--foreground)]">Comparativo</p>
            <BarRow label="Facturación" value={fac?.total ?? 0} max={maxVal} color="bg-[var(--success)]" />
            <BarRow label="Costo ingresos" value={inv?.ingresosTotalCost ?? 0} max={maxVal} color="bg-[var(--primary)]" />
            {(view === 'general' || view === 'cuentas') && (
              <>
                <BarRow label="CxC cobradas" value={ar?.pagadasTotal ?? 0} max={maxVal} color="bg-emerald-500" />
                <BarRow label="CxC abiertas" value={ar?.abiertasTotal ?? 0} max={maxVal} color="bg-amber-500" />
                <BarRow label="CxP pagadas" value={ap?.pagadasTotal ?? 0} max={maxVal} color="bg-rose-500" />
                <BarRow label="CxP abiertas" value={ap?.abiertasTotal ?? 0} max={maxVal} color="bg-orange-500" />
              </>
            )}
          </div>

          <p className="text-xs text-[var(--muted)]">
            Los montos están en la moneda de trabajo de cada registro. La facturación incluye IVA. Si una factura se creó también como cuenta por cobrar, el balance general suma facturación y cobros de CxC; úsalo como orientación y cruza con el detalle de cada módulo.
          </p>
        </div>
      )}
    </div>
  );
}
