'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cierreCajaApi, companiesApi } from '@/lib/api';

function getCompanyId(user: { role: string; companyId: string | null }, selected: string | null): string | null {
  return user?.role === 'SUPER_ADMIN' ? selected : user?.companyId ?? null;
}

type ReportData = Record<string, unknown> & {
  startDate?: string;
  endDate?: string;
  closedAt?: string;
  invoiced?: Record<string, number>;
  closings?: Array<Record<string, unknown> & { username?: string }>;
  closingsTotals?: Record<string, number>;
};

function formatReportAsText(data: ReportData): string {
  const inv = data.invoiced as Record<string, number> | undefined;
  const closings = (data.closings ?? []) as Array<Record<string, unknown> & { username?: string }>;
  const totals = data.closingsTotals as Record<string, number> | undefined;
  const lines: string[] = [
    'REPORTE DE CIERRE DE CAJA',
    `Período: ${data.startDate ?? ''} - ${data.endDate ?? ''}`,
    `Cerrado: ${data.closedAt ? new Date(data.closedAt).toLocaleString() : ''}`,
    '',
    '--- Total facturado (desglose) ---',
    `Efectivo Bs: ${(inv?.efectivoBs ?? 0).toFixed(2)}`,
    `Punto venta Bs: ${(inv?.puntoVentaBs ?? 0).toFixed(2)}`,
    `Transferencia/Pago móvil Bs: ${(inv?.transferenciaPagoMovilBs ?? 0).toFixed(2)}`,
    `Efectivo USD: ${(inv?.efectivoUsd ?? 0).toFixed(2)}`,
    `Zelle USD: ${(inv?.zelleUsd ?? 0).toFixed(2)}`,
    '',
    '--- Cierres por usuario ---',
  ];
  closings.forEach((c: any) => {
    lines.push(`${c.username ?? '-'} | Efectivo Bs: ${Number(c.efectivoBs ?? 0).toFixed(2)} | Punto venta: ${Number(c.puntoVentaBs ?? 0).toFixed(2)} | Transf: ${Number(c.transferenciaPagoMovilBs ?? 0).toFixed(2)} | Efectivo USD: ${Number(c.efectivoUsd ?? 0).toFixed(2)} | Zelle: ${Number(c.zelleUsd ?? 0).toFixed(2)} | ${c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}`);
  });
  lines.push('', '--- Totales registrados ---');
  lines.push(`Efectivo Bs: ${(totals?.efectivoBs ?? 0).toFixed(2)} | Punto venta: ${(totals?.puntoVentaBs ?? 0).toFixed(2)} | Transf: ${(totals?.transferenciaPagoMovilBs ?? 0).toFixed(2)} | Efectivo USD: ${(totals?.efectivoUsd ?? 0).toFixed(2)} | Zelle: ${(totals?.zelleUsd ?? 0).toFixed(2)}`);
  return lines.join('\n');
}

function downloadReport(data: ReportData) {
  const text = formatReportAsText(data);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cierre-caja-${data.startDate ?? ''}-${data.endDate ?? ''}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function printReport(data: ReportData) {
  const text = formatReportAsText(data);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html><html><head><title>Reporte cierre de caja</title>
    <style>body{font-family:sans-serif;padding:20px;white-space:pre-wrap;}</style></head>
    <body>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

export default function CierresCajaPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;

  const [form, setForm] = useState({
    efectivoBs: '',
    puntoVentaBs: '',
    transferenciaPagoMovilBs: '',
    efectivoUsd: '',
    zelleUsd: '',
  });
  const [currentPeriod, setCurrentPeriod] = useState<{ id: string; startDate: string; status: string } | null>(null);
  const [myClosings, setMyClosings] = useState<unknown[]>([]);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');

  const [adminSummary, setAdminSummary] = useState<{
    period: unknown;
    invoiced: Record<string, number>;
    closings: Array<Record<string, unknown> & { username?: string }>;
    closingsTotals: Record<string, number>;
  } | null>(null);
  const [closingPeriod, setClosingPeriod] = useState(false);
  const [closedList, setClosedList] = useState<{ items: unknown[]; total: number; page: number; limit: number }>({ items: [], total: 0, page: 1, limit: 25 });
  const [reportModal, setReportModal] = useState<ReportData | null>(null);
  const [tab, setTab] = useState<'registro' | 'resumen' | 'consultar'>('registro');

  const [registerConfirmModal, setRegisterConfirmModal] = useState<{
    efectivoBs: number;
    puntoVentaBs: number;
    transferenciaPagoMovilBs: number;
    efectivoUsd: number;
    zelleUsd: number;
  } | null>(null);
  const [closePeriodConfirmOpen, setClosePeriodConfirmOpen] = useState(false);
  const [closedPeriodSuccessModal, setClosedPeriodSuccessModal] = useState<ReportData | null>(null);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const hasClosings = (adminSummary?.closings?.length ?? 0) > 0;

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      companiesApi.list().then((list: unknown) => setCompanies((list as { id: string; name: string }[]) || [])).catch(() => setCompanies([]));
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' && companies.length > 0 && !selectedCompanyId) setSelectedCompanyId(companies[0].id);
    if (user?.role !== 'SUPER_ADMIN' && user?.companyId) setSelectedCompanyId(user.companyId);
  }, [user, companies, selectedCompanyId]);

  const loadCurrent = useCallback(() => {
    if (!companyId) return;
    cierreCajaApi.getCurrent(companyId).then((res: any) => {
      setCurrentPeriod(res.period ?? null);
      setMyClosings(res.myClosings ?? []);
    }).catch(() => { setCurrentPeriod(null); setMyClosings([]); });
  }, [companyId]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  const loadAdminSummary = useCallback(() => {
    if (!companyId || !isAdmin) return;
    cierreCajaApi.getCurrentSummary(companyId).then((res: any) => setAdminSummary(res)).catch(() => setAdminSummary(null));
  }, [companyId, isAdmin]);

  useEffect(() => {
    loadAdminSummary();
  }, [loadAdminSummary]);

  const loadClosedList = useCallback(() => {
    if (!companyId || !isAdmin) return;
    cierreCajaApi.listClosed(companyId, closedList.page, closedList.limit).then((res: any) =>
      setClosedList({ items: res.items ?? [], total: res.total ?? 0, page: res.page ?? 1, limit: res.limit ?? 25 })
    ).catch(() => setClosedList((p) => ({ ...p, items: [], total: 0 })));
  }, [companyId, isAdmin, closedList.page, closedList.limit]);

  useEffect(() => {
    loadClosedList();
  }, [loadClosedList]);

  const handleOpenRegisterConfirm = () => {
    const efectivoBs = parseFloat(form.efectivoBs) || 0;
    const puntoVentaBs = parseFloat(form.puntoVentaBs) || 0;
    const transferenciaPagoMovilBs = parseFloat(form.transferenciaPagoMovilBs) || 0;
    const efectivoUsd = parseFloat(form.efectivoUsd) || 0;
    const zelleUsd = parseFloat(form.zelleUsd) || 0;
    setRegisterConfirmModal({ efectivoBs, puntoVentaBs, transferenciaPagoMovilBs, efectivoUsd, zelleUsd });
  };

  const handleRegisterConfirm = async () => {
    if (!companyId || !registerConfirmModal) return;
    setRegistering(true);
    setRegisterError('');
    try {
      await cierreCajaApi.register(companyId, registerConfirmModal);
      setForm({ efectivoBs: '', puntoVentaBs: '', transferenciaPagoMovilBs: '', efectivoUsd: '', zelleUsd: '' });
      setRegisterConfirmModal(null);
      loadCurrent();
      if (isAdmin) loadAdminSummary();
    } catch (e) {
      setRegisterError(e instanceof Error ? e.message : 'Error al registrar');
    } finally {
      setRegistering(false);
    }
  };

  const handleClosePeriodConfirm = () => {
    setClosePeriodConfirmOpen(true);
  };

  const handleClosePeriodExecute = async () => {
    if (!companyId || !isAdmin) return;
    setClosingPeriod(true);
    try {
      const period = await cierreCajaApi.closePeriod(companyId) as { reportData?: ReportData };
      setClosePeriodConfirmOpen(false);
      loadCurrent();
      setAdminSummary(null);
      loadClosedList();
      if (period?.reportData) setClosedPeriodSuccessModal(period.reportData as ReportData);
    } finally {
      setClosingPeriod(false);
    }
  };

  const openReport = (periodId: string) => {
    if (!companyId) return;
    cierreCajaApi.getReport(companyId, periodId).then((period: any) => setReportModal((period?.reportData ?? null) as ReportData)).catch(() => setReportModal(null));
  };

  function ReportContent({ data }: { data: ReportData }) {
    const inv = data.invoiced as Record<string, number> | undefined;
    const closings = (data.closings ?? []) as Array<Record<string, unknown> & { username?: string }>;
    const totals = data.closingsTotals as Record<string, number> | undefined;
    return (
      <div className="space-y-4 text-sm">
        <div>
          <p className="text-[var(--muted)]">Período</p>
          <p className="font-medium">{data.startDate ?? ''} — {data.endDate ?? ''}</p>
          {data.closedAt && <p className="text-[var(--muted)] mt-1">Cerrado: {new Date(data.closedAt as string).toLocaleString()}</p>}
        </div>
        <div>
          <p className="text-[var(--muted)] mb-2">Total facturado (desglose)</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div>Efectivo Bs: <span className="font-medium tabular-nums">{(inv?.efectivoBs ?? 0).toFixed(2)}</span></div>
            <div>Punto venta Bs: <span className="font-medium tabular-nums">{(inv?.puntoVentaBs ?? 0).toFixed(2)}</span></div>
            <div>Transf. Bs: <span className="font-medium tabular-nums">{(inv?.transferenciaPagoMovilBs ?? 0).toFixed(2)}</span></div>
            <div>Efectivo USD: <span className="font-medium tabular-nums">{(inv?.efectivoUsd ?? 0).toFixed(2)}</span></div>
            <div>Zelle USD: <span className="font-medium tabular-nums">{(inv?.zelleUsd ?? 0).toFixed(2)}</span></div>
          </div>
        </div>
        <div>
          <p className="text-[var(--muted)] mb-2">Cierres por usuario</p>
          <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--background)] border-b border-[var(--border)]">
                  <th className="text-left py-2 px-2 text-[var(--muted)]">Usuario</th>
                  <th className="text-left py-2 px-2 text-[var(--muted)]">Efectivo Bs</th>
                  <th className="text-left py-2 px-2 text-[var(--muted)]">Punto venta</th>
                  <th className="text-left py-2 px-2 text-[var(--muted)]">Transf. Bs</th>
                  <th className="text-left py-2 px-2 text-[var(--muted)]">Efectivo USD</th>
                  <th className="text-left py-2 px-2 text-[var(--muted)]">Zelle USD</th>
                  <th className="text-left py-2 px-2 text-[var(--muted)]">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {(closings as any[]).map((c: any) => (
                  <tr key={c.userId ?? c.createdAt} className="border-b border-[var(--border)]">
                    <td className="py-2 px-2">{c.username ?? '-'}</td>
                    <td className="py-2 px-2 tabular-nums">{Number(c.efectivoBs ?? 0).toFixed(2)}</td>
                    <td className="py-2 px-2 tabular-nums">{Number(c.puntoVentaBs ?? 0).toFixed(2)}</td>
                    <td className="py-2 px-2 tabular-nums">{Number(c.transferenciaPagoMovilBs ?? 0).toFixed(2)}</td>
                    <td className="py-2 px-2 tabular-nums">{Number(c.efectivoUsd ?? 0).toFixed(2)}</td>
                    <td className="py-2 px-2 tabular-nums">{Number(c.zelleUsd ?? 0).toFixed(2)}</td>
                    <td className="py-2 px-2 text-[var(--muted)]">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <p className="text-[var(--muted)] mb-1">Totales registrados</p>
          <p className="font-medium">
            Efectivo Bs {(totals?.efectivoBs ?? 0).toFixed(2)} · Punto venta {(totals?.puntoVentaBs ?? 0).toFixed(2)} · Transf. {(totals?.transferenciaPagoMovilBs ?? 0).toFixed(2)} · Efectivo USD {(totals?.efectivoUsd ?? 0).toFixed(2)} · Zelle {(totals?.zelleUsd ?? 0).toFixed(2)}
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl space-y-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Cierres de caja</h1>

        {user.role === 'SUPER_ADMIN' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-[var(--muted)]">Empresa:</label>
            <select
              value={selectedCompanyId ?? ''}
              onChange={(e) => setSelectedCompanyId(e.target.value || null)}
              className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]"
            >
              <option value="">Seleccione</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {!companyId && (
          <p className="text-[var(--muted)]">Seleccione una empresa para continuar.</p>
        )}

        {companyId && (
          <>
            <div className="flex gap-2 border-b border-[var(--border)] flex-wrap">
            <button
              type="button"
              onClick={() => setTab('registro')}
              className={`px-4 py-2 font-medium rounded-t-lg ${tab === 'registro' ? 'bg-[var(--card)] border border-[var(--border)] border-b-0 -mb-px text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
            >
              Registro de cierre de caja
            </button>
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setTab('resumen')}
                  className={`px-4 py-2 font-medium rounded-t-lg ${tab === 'resumen' ? 'bg-[var(--card)] border border-[var(--border)] border-b-0 -mb-px text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                >
                  Resumen y cierre
                </button>
                <button
                  type="button"
                  onClick={() => setTab('consultar')}
                  className={`px-4 py-2 font-medium rounded-t-lg ${tab === 'consultar' ? 'bg-[var(--card)] border border-[var(--border)] border-b-0 -mb-px text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                >
                  Consultar cierres realizados
                </button>
              </>
            )}
          </div>

          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 mt-2">
            {tab === 'registro' && (
              <>
                {currentPeriod && (
                  <p className="text-sm text-[var(--muted)] mb-4">
                    Lapso actual: desde {currentPeriod.startDate} {currentPeriod.status === 'OPEN' ? '(abierto)' : ''}
                  </p>
                )}
                <div className="space-y-4 mb-4 max-w-md">
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Efectivo Bs</label>
                    <input type="number" min={0} step={0.01} value={form.efectivoBs} onChange={(e) => setForm((f) => ({ ...f, efectivoBs: e.target.value }))}
                      className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Punto de venta Bs</label>
                    <input type="number" min={0} step={0.01} value={form.puntoVentaBs} onChange={(e) => setForm((f) => ({ ...f, puntoVentaBs: e.target.value }))}
                      className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Transferencia / Pago móvil Bs</label>
                    <input type="number" min={0} step={0.01} value={form.transferenciaPagoMovilBs} onChange={(e) => setForm((f) => ({ ...f, transferenciaPagoMovilBs: e.target.value }))}
                      className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Efectivo USD</label>
                    <input type="number" min={0} step={0.01} value={form.efectivoUsd} onChange={(e) => setForm((f) => ({ ...f, efectivoUsd: e.target.value }))}
                      className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Zelle USD</label>
                    <input type="number" min={0} step={0.01} value={form.zelleUsd} onChange={(e) => setForm((f) => ({ ...f, zelleUsd: e.target.value }))}
                      className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" />
                  </div>
                </div>
                {registerError && <p className="text-[var(--destructive)] text-sm mb-2">{registerError}</p>}
                <button type="button" onClick={handleOpenRegisterConfirm} disabled={registering} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                  {registering ? 'Registrando...' : 'Registrar cierre'}
                </button>
                {myClosings.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">Mis cierres en este lapso</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            <th className="text-left py-2 text-[var(--muted)]">Efectivo Bs</th>
                            <th className="text-left py-2 text-[var(--muted)]">Punto venta Bs</th>
                            <th className="text-left py-2 text-[var(--muted)]">Transf. Bs</th>
                            <th className="text-left py-2 text-[var(--muted)]">Efectivo USD</th>
                            <th className="text-left py-2 text-[var(--muted)]">Zelle USD</th>
                            <th className="text-left py-2 text-[var(--muted)]">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(myClosings as any[]).map((c) => (
                            <tr key={c.id} className="border-b border-[var(--border)]">
                              <td className="py-2 tabular-nums">{Number(c.efectivoBs ?? 0).toFixed(2)}</td>
                              <td className="py-2 tabular-nums">{Number(c.puntoVentaBs ?? 0).toFixed(2)}</td>
                              <td className="py-2 tabular-nums">{Number(c.transferenciaPagoMovilBs ?? 0).toFixed(2)}</td>
                              <td className="py-2 tabular-nums">{Number(c.efectivoUsd ?? 0).toFixed(2)}</td>
                              <td className="py-2 tabular-nums">{Number(c.zelleUsd ?? 0).toFixed(2)}</td>
                              <td className="py-2 text-[var(--muted)]">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === 'resumen' && isAdmin && (
              <>
                {adminSummary ? (
                  <>
                    <div className="mb-6 p-4 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                      <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">Total facturado en el lapso (desglose esperado)</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                        <div><span className="text-[var(--muted)]">Efectivo Bs:</span> <span className="font-medium tabular-nums">{(adminSummary.invoiced?.efectivoBs ?? 0).toFixed(2)}</span></div>
                        <div><span className="text-[var(--muted)]">Punto venta Bs:</span> <span className="font-medium tabular-nums">{(adminSummary.invoiced?.puntoVentaBs ?? 0).toFixed(2)}</span></div>
                        <div><span className="text-[var(--muted)]">Transf. Bs:</span> <span className="font-medium tabular-nums">{(adminSummary.invoiced?.transferenciaPagoMovilBs ?? 0).toFixed(2)}</span></div>
                        <div><span className="text-[var(--muted)]">Efectivo USD:</span> <span className="font-medium tabular-nums">{(adminSummary.invoiced?.efectivoUsd ?? 0).toFixed(2)}</span></div>
                        <div><span className="text-[var(--muted)]">Zelle USD:</span> <span className="font-medium tabular-nums">{(adminSummary.invoiced?.zelleUsd ?? 0).toFixed(2)}</span></div>
                      </div>
                    </div>
                    <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">Cierres registrados por usuario</h3>
                    <div className="overflow-x-auto mb-6">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            <th className="text-left py-2 text-[var(--muted)]">Usuario</th>
                            <th className="text-left py-2 text-[var(--muted)]">Efectivo Bs</th>
                            <th className="text-left py-2 text-[var(--muted)]">Punto venta Bs</th>
                            <th className="text-left py-2 text-[var(--muted)]">Transf. Bs</th>
                            <th className="text-left py-2 text-[var(--muted)]">Efectivo USD</th>
                            <th className="text-left py-2 text-[var(--muted)]">Zelle USD</th>
                            <th className="text-left py-2 text-[var(--muted)]">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(adminSummary.closings ?? []).map((c: any) => (
                            <tr key={c.id} className="border-b border-[var(--border)]">
                              <td className="py-2">{c.username ?? '-'}</td>
                              <td className="py-2 tabular-nums">{Number(c.efectivoBs ?? 0).toFixed(2)}</td>
                              <td className="py-2 tabular-nums">{Number(c.puntoVentaBs ?? 0).toFixed(2)}</td>
                              <td className="py-2 tabular-nums">{Number(c.transferenciaPagoMovilBs ?? 0).toFixed(2)}</td>
                              <td className="py-2 tabular-nums">{Number(c.efectivoUsd ?? 0).toFixed(2)}</td>
                              <td className="py-2 tabular-nums">{Number(c.zelleUsd ?? 0).toFixed(2)}</td>
                              <td className="py-2 text-[var(--muted)]">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!hasClosings && <p className="text-sm text-[var(--muted)] mb-4">No hay cierres de caja registrados en este lapso. Debe existir al menos un registro para poder generar el reporte y cerrar el lapso.</p>}
                    <div className="flex flex-wrap gap-4 items-center">
                      <p className="text-sm text-[var(--muted)]">
                        Totales registrados: Efectivo Bs {(adminSummary.closingsTotals?.efectivoBs ?? 0).toFixed(2)} · Punto venta {(adminSummary.closingsTotals?.puntoVentaBs ?? 0).toFixed(2)} · Transf. {(adminSummary.closingsTotals?.transferenciaPagoMovilBs ?? 0).toFixed(2)} · Efectivo USD {(adminSummary.closingsTotals?.efectivoUsd ?? 0).toFixed(2)} · Zelle {(adminSummary.closingsTotals?.zelleUsd ?? 0).toFixed(2)}
                      </p>
                      <button type="button" onClick={handleClosePeriodConfirm} disabled={closingPeriod || !hasClosings} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50" title={!hasClosings ? 'Registre al menos un cierre de caja para poder cerrar el lapso' : ''}>
                        {closingPeriod ? 'Cerrando...' : 'Generar reporte y cerrar lapso'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[var(--muted)]">No hay período abierto o no se pudo cargar el resumen.</p>
                )}
              </>
            )}

            {tab === 'consultar' && isAdmin && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-2 text-[var(--muted)]">Inicio</th>
                        <th className="text-left py-2 text-[var(--muted)]">Cierre</th>
                        <th className="text-left py-2 text-[var(--muted)]">Cerrado por</th>
                        <th className="text-left py-2 text-[var(--muted)]">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(closedList.items as any[]).map((p: any) => (
                        <tr key={p.id} className="border-b border-[var(--border)]">
                          <td className="py-2">{p.startDate}</td>
                          <td className="py-2">{p.endDate ?? '-'}</td>
                          <td className="py-2">{p.closedBy?.username ?? '-'}</td>
                          <td className="py-2">
                            <button type="button" onClick={() => openReport(p.id)} className="text-[var(--primary)] hover:underline text-sm">Ver reporte</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {closedList.items.length === 0 && <p className="py-6 text-center text-[var(--muted)]">No hay cierres realizados.</p>}
                {closedList.total > closedList.limit && (
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => setClosedList((p) => ({ ...p, page: p.page - 1 }))} disabled={closedList.page <= 1} className="rounded px-2 py-1 bg-[var(--card-hover)] disabled:opacity-50 text-sm">Anterior</button>
                    <span className="text-sm text-[var(--muted)]">Pág. {closedList.page} de {Math.ceil(closedList.total / closedList.limit)}</span>
                    <button type="button" onClick={() => setClosedList((p) => ({ ...p, page: p.page + 1 }))} disabled={closedList.page * closedList.limit >= closedList.total} className="rounded px-2 py-1 bg-[var(--card-hover)] disabled:opacity-50 text-sm">Siguiente</button>
                  </div>
                )}
              </>
            )}
            </div>
          </>
        )}
      </div>

      {registerConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Confirmar registro de cierre de caja</h2>
            <p className="text-sm text-[var(--muted)] mb-4">Revise los datos antes de registrar:</p>
            <div className="space-y-2 text-sm mb-6">
              <p><span className="text-[var(--muted)]">Efectivo Bs:</span> <span className="font-medium tabular-nums">{registerConfirmModal.efectivoBs.toFixed(2)}</span></p>
              <p><span className="text-[var(--muted)]">Punto de venta Bs:</span> <span className="font-medium tabular-nums">{registerConfirmModal.puntoVentaBs.toFixed(2)}</span></p>
              <p><span className="text-[var(--muted)]">Transferencia / Pago móvil Bs:</span> <span className="font-medium tabular-nums">{registerConfirmModal.transferenciaPagoMovilBs.toFixed(2)}</span></p>
              <p><span className="text-[var(--muted)]">Efectivo USD:</span> <span className="font-medium tabular-nums">{registerConfirmModal.efectivoUsd.toFixed(2)}</span></p>
              <p><span className="text-[var(--muted)]">Zelle USD:</span> <span className="font-medium tabular-nums">{registerConfirmModal.zelleUsd.toFixed(2)}</span></p>
            </div>
            {registerError && <p className="text-[var(--destructive)] text-sm mb-2">{registerError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setRegisterConfirmModal(null); setRegisterError(''); }} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium">Cancelar</button>
              <button type="button" onClick={handleRegisterConfirm} disabled={registering} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50">{registering ? 'Registrando...' : 'Confirmar registro'}</button>
            </div>
          </div>
        </div>
      )}

      {closePeriodConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Cerrar lapso</h2>
            <p className="text-sm text-[var(--foreground)] mb-6">¿Generar reporte y cerrar el lapso? Los próximos cierres de caja serán para un lapso nuevo.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setClosePeriodConfirmOpen(false)} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium">Cancelar</button>
              <button type="button" onClick={handleClosePeriodExecute} disabled={closingPeriod} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50">{closingPeriod ? 'Cerrando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {closedPeriodSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Lapso cerrado</h2>
            <ReportContent data={closedPeriodSuccessModal} />
            <div className="mt-6 flex flex-wrap gap-2 justify-end">
              <button type="button" onClick={() => downloadReport(closedPeriodSuccessModal)} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium">Descargar</button>
              <button type="button" onClick={() => printReport(closedPeriodSuccessModal)} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium">Imprimir</button>
              <button type="button" onClick={() => setClosedPeriodSuccessModal(null)} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Reporte de cierre de caja</h2>
            <ReportContent data={reportModal} />
            <div className="mt-6 flex flex-wrap gap-2 justify-end">
              <button type="button" onClick={() => downloadReport(reportModal)} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium">Descargar</button>
              <button type="button" onClick={() => printReport(reportModal)} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium">Imprimir</button>
              <button type="button" onClick={() => setReportModal(null)} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
