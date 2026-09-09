'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  accountsPayableApi,
  companiesApi,
  clientsApi,
  configApi,
} from '@/lib/api';
import { SUPERADMIN_COMPANY_STORAGE_KEY } from '@/lib/constants';
import { hasSectionAccess } from '@/lib/role-modules';
import {
  ClientPicker,
  currencyCodeFromConfig,
  currencySymbolLabel,
  type PickedClient,
} from '@/components/ClientPicker';
import { ClientDetailModal } from '@/components/ClientDetailModal';

type ApItem = {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  rateOfDay?: number | null;
  amountBs?: number | null;
  merchandiseReceivedAt: string;
  dueDate: string;
  paid: boolean;
  paidAt?: string | null;
  createdAt: string;
  status: 'pagada' | 'vencida' | 'pendiente';
  client?: { id: string; name: string; rifCedula: string; phone?: string | null; address?: string | null; email?: string | null };
};

function getCompanyId(user: { role: string; companyId: string | null }, selected: string | null): string | null {
  return user.role === 'SUPER_ADMIN' ? selected : user.companyId;
}

function formatDate(d: string) {
  if (!d) return '—';
  const s = d.slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

export default function CuentasPorPagarPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);
  const [tab, setTab] = useState<'new' | 'list'>('new');

  const [config, setConfig] = useState<{ currencySymbol?: string; usdRate?: number | null; eurRate?: number | null } | null>(null);
  const currency = currencyCodeFromConfig(config);
  const currencyLabel = currencySymbolLabel(currency);
  const canConvertBs = currency === 'USD' || currency === 'EUR';
  const defaultRate =
    currency === 'USD' && config?.usdRate != null ? Number(config.usdRate) :
    currency === 'EUR' && config?.eurRate != null ? Number(config.eurRate) :
    null;

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearchResult, setClientSearchResult] = useState<PickedClient | null | 'loading' | 'not-found'>(null);
  const [clientForm, setClientForm] = useState({ name: '', address: '', rifCedula: '', phone: '', email: '' });
  const [merchandiseReceivedAt, setMerchandiseReceivedAt] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [convertToBs, setConvertToBs] = useState(false);
  const [rateOfDay, setRateOfDay] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [listStatus, setListStatus] = useState<'todas' | 'pendientes' | 'vencidas' | 'pagadas'>('todas');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterName, setFilterName] = useState('');
  const [items, setItems] = useState<ApItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingList, setLoadingList] = useState(false);
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [clientDetail, setClientDetail] = useState<ApItem['client'] | null>(null);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') companiesApi.list().then(setCompanies).catch(() => {});
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' && companies.length > 0) {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(SUPERADMIN_COMPANY_STORAGE_KEY) : null;
      const id = stored && companies.some((c) => c.id === stored) ? stored : companies[0].id;
      setSelectedCompanyId(id);
    } else if (user?.role !== 'SUPER_ADMIN' && user?.companyId) {
      setSelectedCompanyId(user.companyId);
    }
  }, [user, companies]);

  useEffect(() => {
    if (!user?.companyId || user.role === 'SUPER_ADMIN') {
      setAllowedModules(null);
      return;
    }
    configApi.getRoleModules(user.companyId).then((res) => {
      const roleData =
        user.role === 'ADMIN' ? res.admin : user.role === 'VENDEDOR' ? res.vendedor : res.supervisor;
      setAllowedModules(roleData?.enabled ? (roleData.modules ?? []) : []);
    }).catch(() => setAllowedModules([]));
  }, [user]);

  useEffect(() => {
    if (!companyId) return;
    configApi.get(companyId).then((c) => {
      const cfg = c as { currencySymbol?: string; usdRate?: number | null; eurRate?: number | null };
      setConfig(cfg);
    }).catch(() => setConfig(null));
  }, [companyId]);

  useEffect(() => {
    if (!canConvertBs) {
      setConvertToBs(false);
      setRateOfDay('');
    }
  }, [canConvertBs]);

  const canNew = !allowedModules || hasSectionAccess('CUENTAS_POR_PAGAR', 'new', allowedModules);
  const canList = !allowedModules || hasSectionAccess('CUENTAS_POR_PAGAR', 'list', allowedModules);

  useEffect(() => {
    if (canNew && !canList) setTab('new');
    else if (!canNew && canList) setTab('list');
  }, [canNew, canList]);

  const loadList = () => {
    if (!companyId || tab !== 'list') return;
    setLoadingList(true);
    accountsPayableApi
      .list(companyId, {
        status: listStatus,
        page,
        limit: 25,
        ...(filterFrom && { from: filterFrom }),
        ...(filterTo && { to: filterTo }),
        ...(filterName.trim() && { name: filterName.trim() }),
      })
      .then((res) => {
        setItems((res.items as ApItem[]) || []);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoadingList(false));
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, tab, listStatus, page, filterFrom, filterTo, filterName]);

  const isNotFound = clientSearchResult === 'not-found';
  const canCreateClient = isNotFound && clientForm.name.trim() && clientForm.rifCedula.trim();
  const hasValidClient = !!selectedClientId || canCreateClient;

  const amountNum = Number(amount) || 0;
  const rateNum = Number(rateOfDay) || 0;
  const amountBsPreview = convertToBs && canConvertBs && rateNum > 0 ? amountNum * rateNum : null;

  const resetForm = () => {
    setSelectedClientId(null);
    setClientSearchResult(null);
    setClientForm({ name: '', address: '', rifCedula: '', phone: '', email: '' });
    setMerchandiseReceivedAt('');
    setInvoiceNumber('');
    setAmount('');
    setConvertToBs(false);
    setRateOfDay('');
    setDueDate('');
  };

  const handleCreate = async () => {
    if (!companyId) return;
    setError('');
    setSuccess('');
    if (!hasValidClient) {
      setError('Selecciona o crea la empresa (cliente).');
      return;
    }
    if (!merchandiseReceivedAt) {
      setError('Fecha de recepción de mercancía es obligatoria.');
      return;
    }
    if (!invoiceNumber.trim()) {
      setError('Número de factura es obligatorio.');
      return;
    }
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('Monto inválido.');
      return;
    }
    if (convertToBs && canConvertBs && (!rateOfDay.trim() || isNaN(rateNum) || rateNum <= 0)) {
      setError('Indica la tasa del día para convertir a bolívares.');
      return;
    }
    if (!dueDate) {
      setError('Fecha de vencimiento es obligatoria.');
      return;
    }

    setSaving(true);
    try {
      let clientId = selectedClientId;
      if (!clientId && canCreateClient) {
        const created = (await clientsApi.create(companyId, clientForm)) as PickedClient;
        clientId = created.id;
      }
      const useRate = convertToBs && canConvertBs;
      await accountsPayableApi.create(companyId, {
        clientId,
        merchandiseReceivedAt,
        invoiceNumber: invoiceNumber.trim(),
        amount: amountNum,
        currency,
        rateOfDay: useRate ? rateNum : null,
        amountBs: useRate ? amountNum * rateNum : null,
        dueDate,
      });
      resetForm();
      setSuccess('Cuenta por pagar registrada.');
      if (canList) {
        setTab('list');
        setListStatus('pendientes');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const confirmMarkPaid = async () => {
    if (!companyId || !markPaidId) return;
    try {
      await accountsPayableApi.markPaid(markPaidId, companyId);
      setMarkPaidId(null);
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al marcar como pagada');
      setMarkPaidId(null);
    }
  };

  if (!user) return null;

  const statusBadge = (status: ApItem['status']) => {
    const map = {
      pagada: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      vencida: 'bg-red-500/15 text-red-700 dark:text-red-300',
      pendiente: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
    };
    const labels = { pagada: 'Pagada', vencida: 'Vencida', pendiente: 'Pendiente' };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const grouped =
    listStatus === 'todas'
      ? {
          vencidas: items.filter((i) => i.status === 'vencida'),
          pendientes: items.filter((i) => i.status === 'pendiente'),
          pagadas: items.filter((i) => i.status === 'pagada'),
        }
      : null;

  const renderTable = (rows: ApItem[]) => (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--background)] text-[var(--muted)] text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Empresa</th>
            <th className="px-3 py-2 font-medium">Nº factura</th>
            <th className="px-3 py-2 font-medium">Recepción</th>
            <th className="px-3 py-2 font-medium">Monto</th>
            <th className="px-3 py-2 font-medium">Bs.</th>
            <th className="px-3 py-2 font-medium">Vence</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[var(--border)]">
              <td className="px-3 py-2">
                {row.client?.id ? (
                  <button
                    type="button"
                    onClick={() => setClientDetail(row.client!)}
                    className="text-left text-[var(--primary)] hover:underline font-medium"
                  >
                    {row.client.name}
                  </button>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2">{row.invoiceNumber}</td>
              <td className="px-3 py-2">{formatDate(String(row.merchandiseReceivedAt))}</td>
              <td className="px-3 py-2 font-medium">
                {currencySymbolLabel((row.currency as 'BS' | 'USD' | 'EUR') || currency)}{' '}
                {Number(row.amount).toFixed(2)}
              </td>
              <td className="px-3 py-2">
                {row.amountBs != null ? `Bs. ${Number(row.amountBs).toFixed(2)}` : '—'}
              </td>
              <td className="px-3 py-2">{formatDate(String(row.dueDate))}</td>
              <td className="px-3 py-2">{statusBadge(row.status)}</td>
              <td className="px-3 py-2">
                {!row.paid && (
                  <button
                    type="button"
                    onClick={() => setMarkPaidId(row.id)}
                    className="text-[var(--primary)] hover:underline text-xs"
                  >
                    Marcar pagada
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-[var(--muted)]">
                Sin registros
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Cuentas por pagar</h1>
      <p className="text-[var(--muted)] mt-1">Registra obligaciones con proveedores y da seguimiento a los pagos.</p>

      {user.role === 'SUPER_ADMIN' && (
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Empresa</label>
          <select
            value={selectedCompanyId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              setSelectedCompanyId(id);
              try {
                if (id) localStorage.setItem(SUPERADMIN_COMPANY_STORAGE_KEY, id);
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

      {!companyId && <p className="mt-4 text-[var(--muted)]">Selecciona una empresa.</p>}

      {companyId && (
        <>
          <div className="mt-6 flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
            {canNew && (
              <button
                type="button"
                onClick={() => setTab('new')}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'new' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--card)] border border-[var(--border)]'}`}
              >
                Registrar
              </button>
            )}
            {canList && (
              <button
                type="button"
                onClick={() => setTab('list')}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'list' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--card)] border border-[var(--border)]'}`}
              >
                Consultar
              </button>
            )}
          </div>

          {tab === 'new' && canNew && (
            <div className="mt-6 max-w-2xl space-y-4 p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Fecha de recepción de mercancía</label>
                <input
                  type="date"
                  value={merchandiseReceivedAt}
                  onChange={(e) => setMerchandiseReceivedAt(e.target.value)}
                  className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Nº de factura</label>
                <input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                />
              </div>
              <ClientPicker
                companyId={companyId}
                label="Nombre de la empresa"
                selectedClientId={selectedClientId}
                clientForm={clientForm}
                searchResult={clientSearchResult}
                onSearchResultChange={setClientSearchResult}
                onSelect={(c) => setSelectedClientId(c.id)}
                onClear={() => setSelectedClientId(null)}
                onFormChange={setClientForm}
              />
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Monto ({currencyLabel})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                />
              </div>
              {canConvertBs && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={convertToBs}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setConvertToBs(checked);
                        if (checked && defaultRate != null && !isNaN(defaultRate)) {
                          setRateOfDay(defaultRate.toFixed(2));
                        }
                        if (!checked) setRateOfDay('');
                      }}
                    />
                    Calcular equivalente en bolívares
                  </label>
                  {convertToBs && (
                    <div>
                      <label className="block text-sm text-[var(--muted)] mb-1">
                        Tasa del día {defaultRate != null ? '(prellenada desde configuración)' : ''}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rateOfDay}
                        onChange={(e) => setRateOfDay(e.target.value)}
                        className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                      />
                      {amountBsPreview != null && amountNum > 0 && (
                        <p className="text-sm text-[var(--muted)] mt-1">
                          Equivalente: <span className="font-medium text-[var(--foreground)]">Bs. {amountBsPreview.toFixed(2)}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Fecha de vencimiento</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                />
              </div>
              {error && <p className="text-[var(--destructive)] text-sm">{error}</p>}
              {success && <p className="text-[var(--success)] text-sm">{success}</p>}
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || !hasValidClient}
                className="rounded-lg bg-[var(--primary)] text-white px-5 py-2 font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Registrar cuenta por pagar'}
              </button>
            </div>
          )}

          {tab === 'list' && canList && (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {([
                  ['todas', 'Todas'],
                  ['vencidas', 'Vencidas'],
                  ['pendientes', 'Pendientes'],
                  ['pagadas', 'Pagadas'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setListStatus(id);
                      setPage(1);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm ${listStatus === id ? 'bg-[var(--primary)] text-white' : 'border border-[var(--border)] bg-[var(--card)]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                <input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }} className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                <input
                  value={filterName}
                  onChange={(e) => { setFilterName(e.target.value); setPage(1); }}
                  placeholder="Nombre o Nº factura"
                  className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 md:col-span-2"
                />
              </div>

              {loadingList ? (
                <p className="text-[var(--muted)]">Cargando...</p>
              ) : grouped ? (
                <div className="space-y-6">
                  <section>
                    <h2 className="font-semibold text-[var(--destructive)] mb-2">Vencidas ({grouped.vencidas.length})</h2>
                    {renderTable(grouped.vencidas)}
                  </section>
                  <section>
                    <h2 className="font-semibold text-amber-700 dark:text-amber-300 mb-2">Pendientes ({grouped.pendientes.length})</h2>
                    {renderTable(grouped.pendientes)}
                  </section>
                  <section>
                    <h2 className="font-semibold text-emerald-700 dark:text-emerald-300 mb-2">Pagadas ({grouped.pagadas.length})</h2>
                    {renderTable(grouped.pagadas)}
                  </section>
                </div>
              ) : (
                renderTable(items)
              )}

              <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40">Anterior</button>
                <span>Página {page} · {total} total</span>
                <button type="button" disabled={page * 25 >= total} onClick={() => setPage((p) => p + 1)} className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40">Siguiente</button>
              </div>
            </div>
          )}
        </>
      )}

      {markPaidId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-md w-full p-6">
            <h2 className="font-semibold text-[var(--foreground)] text-lg mb-2">Marcar como pagada</h2>
            <p className="text-sm text-[var(--muted)] mb-4">¿Confirmas que esta cuenta por pagar ya fue saldada?</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMarkPaidId(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">Cancelar</button>
              <button type="button" onClick={confirmMarkPaid} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium">Sí, marcar pagada</button>
            </div>
          </div>
        </div>
      )}

      <ClientDetailModal
        open={!!clientDetail}
        companyId={companyId}
        clientId={clientDetail?.id ?? null}
        fallback={clientDetail}
        onClose={() => setClientDetail(null)}
      />
    </div>
  );
}
