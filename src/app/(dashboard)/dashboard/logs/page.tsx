'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { logsApi, companiesApi } from '@/lib/api';

function getCompanyId(user: { role: string; companyId: string | null }, selected: string | null): string | null {
  return user.role === 'SUPER_ADMIN' ? selected : user.companyId;
}

export default function LogsPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const companyId = user?.role === 'SUPER_ADMIN' ? selectedCompanyId : user?.companyId ?? null;

  const [list, setList] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') companiesApi.list().then(setCompanies).catch(() => {});
  }, [user?.role]);
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' && companies.length > 0 && !selectedCompanyId) setSelectedCompanyId(companies[0].id);
  }, [user, companies, selectedCompanyId]);

  const loadLogs = useCallback(() => {
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (user?.role === 'SUPER_ADMIN' && companyId) params.companyId = companyId;
    if (filterFrom) params.from = filterFrom;
    if (filterTo) params.to = filterTo;
    if (filterAction) params.action = filterAction;
    if (filterUser) params.userId = filterUser;
    logsApi.list(params).then(setList).catch(() => {});
  }, [user?.role, companyId, page, limit, filterFrom, filterTo, filterAction, filterUser]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  if (!user) return null;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Logs</h1>
      <p className="text-[var(--muted)] mt-1">Registro de acciones del sistema. Filtros por fecha, acción y usuario.</p>

      {user.role === 'SUPER_ADMIN' && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Empresa</label>
          <select value={selectedCompanyId ?? ''} onChange={(e) => setSelectedCompanyId(e.target.value || null)} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2">
            <option value="">Todas</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 mb-4">
        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2" />
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2" />
        <input value={filterAction} onChange={(e) => setFilterAction(e.target.value)} placeholder="Acción" className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 w-40" />
        <input value={filterUser} onChange={(e) => setFilterUser(e.target.value)} placeholder="Usuario (ID)" className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 w-40" />
        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-2 py-2">
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--card)]">
            <tr>
              <th className="p-3 font-medium">Fecha</th>
              <th className="p-3 font-medium">Acción</th>
              <th className="p-3 font-medium">Usuario</th>
              <th className="p-3 font-medium">Entidad</th>
              <th className="p-3 font-medium">Observación</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((log: any) => (
              <tr key={log.id} className="border-t border-[var(--border)]">
                <td className="p-3">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="p-3">{log.action}</td>
                <td className="p-3">{log.user?.username ?? log.userId ?? '—'}</td>
                <td className="p-3">{log.entityType ? `${log.entityType} ${log.entityId ?? ''}` : '—'}</td>
                <td className="p-3 max-w-xs truncate" title={log.observation ?? ''}>{log.observation ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.items.length === 0 && <p className="py-6 text-center text-[var(--muted)]">No hay registros.</p>}
      <div className="mt-3 flex justify-between text-sm text-[var(--muted)]">
        <span>Total: {list.total}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded px-2 py-1 bg-[var(--card)] disabled:opacity-50">Anterior</button>
          <span>Pág. {page}</span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page * limit >= list.total} className="rounded px-2 py-1 bg-[var(--card)] disabled:opacity-50">Siguiente</button>
        </div>
      </div>
    </div>
  );
}
