'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { budgetsApi, clientsApi, productsApi, companiesApi, configApi } from '@/lib/api';

const PAYMENT_OPTIONS = ['EFECTIVO', 'PAGO_MOVIL', 'TRANSFERENCIA', 'BINANCE', 'ZELLE'];
const CURRENCY_OPTIONS = ['USD', 'EUR', 'BS'];

function getCompanyId(user: { role: string; companyId: string | null }, selected: string | null): string | null {
  return user.role === 'SUPER_ADMIN' ? selected : user.companyId;
}

type BudgetItemRow = { productId: string; code: string; name: string; description?: string; stock?: number; quantity: number; unitPrice: number; sortOrder: number };

export default function PresupuestosPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;

  const [tab, setTab] = useState<'new' | 'list'>('new');
  const [company, setCompany] = useState<{ name: string; address?: string; rif?: string; phone?: string; email?: string } | null>(null);
  const [config, setConfig] = useState<{ usdRate?: number; eurRate?: number; budgetFieldsConfig?: Record<string, { visible: boolean; required: boolean }> } | null>(null);

  const [title, setTitle] = useState('');
  const [clientRif, setClientRif] = useState('');
  const [clientSearchResult, setClientSearchResult] = useState<{ id: string; name: string; address?: string; rifCedula: string; phone?: string; email?: string } | null | 'loading'>(null);
  const [clientForm, setClientForm] = useState<{ name: string; address: string; rifCedula: string; phone: string; email: string }>({ name: '', address: '', rifCedula: '', phone: '', email: '' });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [productCodeInput, setProductCodeInput] = useState('');
  const [items, setItems] = useState<BudgetItemRow[]>([]);
  const [ivaPercent, setIvaPercent] = useState(12);
  const [rateOfDay, setRateOfDay] = useState('');
  const [currencies, setCurrencies] = useState<string[]>(['USD']);
  const [observations, setObservations] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [deliveryTime, setDeliveryTime] = useState('');
  const [validity, setValidity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [list, setList] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterCode, setFilterCode] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [editModal, setEditModal] = useState<{ id: string; budget: any } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; correlative: string } | null>(null);
  const [duplicateModal, setDuplicateModal] = useState<{ id: string; budget: any } | null>(null);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') companiesApi.list().then(setCompanies).catch(() => {});
  }, [user?.role]);
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' && companies.length > 0 && !selectedCompanyId) setSelectedCompanyId(companies[0].id);
    if (user?.role !== 'SUPER_ADMIN' && user?.companyId) setSelectedCompanyId(user.companyId);
  }, [user, companies, selectedCompanyId]);

  useEffect(() => {
    if (!companyId) return;
    companiesApi.get(companyId).then((c: any) => setCompany(c)).catch(() => setCompany(null));
    configApi.get(companyId).then((c: any) => setConfig(c)).catch(() => setConfig(null));
  }, [companyId]);

  const loadList = useCallback(() => {
    if (!companyId) return;
    const params: Record<string, string> = { companyId };
    if (page) params.page = String(page);
    if (limit) params.limit = String(limit);
    if (filterFrom) params.from = filterFrom;
    if (filterTo) params.to = filterTo;
    if (filterCode) params.code = filterCode;
    if (filterClient) params.client = filterClient;
    if (filterProduct) params.product = filterProduct;
    budgetsApi.list(companyId, params).then(setList).catch(() => {});
  }, [companyId, page, limit, filterFrom, filterTo, filterCode, filterClient, filterProduct]);

  useEffect(() => { loadList(); }, [loadList]);

  const handleSearchClient = async () => {
    if (!companyId || !clientRif.trim()) return;
    setClientSearchResult('loading');
    try {
      const found = await clientsApi.search(companyId, clientRif.trim());
      setClientSearchResult(found as any);
      if (found) {
        const c = found as any;
        setSelectedClientId(c.id);
        setClientForm({ name: c.name, address: c.address ?? '', rifCedula: c.rifCedula, phone: c.phone ?? '', email: c.email ?? '' });
      } else {
        setSelectedClientId(null);
        setClientForm({ name: '', address: '', rifCedula: clientRif.trim(), phone: '', email: '' });
      }
    } catch {
      setClientSearchResult(null);
    }
  };

  const handleAddClientAndContinue = async () => {
    if (!companyId || !clientForm.name.trim() || !clientForm.rifCedula.trim()) {
      setError('Nombre y RIF/Cédula son obligatorios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await clientsApi.create(companyId, clientForm) as any;
      setSelectedClientId(created.id);
      setClientSearchResult(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleProductCodeKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !companyId || !productCodeInput.trim()) return;
    e.preventDefault();
    try {
      const list = await productsApi.search(companyId, productCodeInput.trim());
      const prod = (list as any[])[0];
      if (!prod) return;
      const existing = items.find((i) => i.productId === prod.id);
      if (existing) {
        setItems((prev) => prev.map((i) => i.productId === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
      } else {
        setItems((prev) => [
          ...prev,
          {
            productId: prod.id,
            code: prod.code,
            name: prod.name,
            description: prod.description,
            stock: prod.stock,
            quantity: 1,
            unitPrice: Number(prod.stock) ? 0 : 0,
            sortOrder: prev.length + 1,
          },
        ]);
      }
      setProductCodeInput('');
    } catch {
      // ignore
    }
  };

  const updateItem = (productId: string, upd: Partial<BudgetItemRow>) => {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, ...upd } : i)));
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId).map((i, idx) => ({ ...i, sortOrder: idx + 1 })));
  };

  const moveItem = (productId: string, dir: 'up' | 'down') => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === productId);
      if (idx < 0) return prev;
      const newOrder = [...prev];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= newOrder.length) return prev;
      [newOrder[idx], newOrder[swap]] = [newOrder[swap], newOrder[idx]];
      return newOrder.map((i, iidx) => ({ ...i, sortOrder: iidx + 1 }));
    });
  };

  const toggleCurrency = (c: string) => {
    setCurrencies((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      if (prev.length >= 2) return prev;
      if (c === 'USD' && prev.includes('EUR')) return [c];
      if (c === 'EUR' && prev.includes('USD')) return [c];
      return [...prev, c];
    });
  };

  const togglePayment = (p: string) => {
    setPaymentMethods((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const fieldConfig = config?.budgetFieldsConfig ?? {};
  const isFieldVisible = (key: string) => fieldConfig[key]?.visible !== false;
  const isFieldRequired = (key: string) => fieldConfig[key]?.required === true;

  const handleSubmitBudget = async () => {
    if (!companyId || !selectedClientId) {
      setError('Cliente es obligatorio.');
      return;
    }
    if (items.length === 0) {
      setError('Agrega al menos un producto.');
      return;
    }
    if (isFieldVisible('title') && !title.trim()) {
      setError('Título es obligatorio.');
      return;
    }
    if (isFieldVisible('rateOfDay') && (!rateOfDay.trim() || isNaN(Number(rateOfDay)))) {
      setError('Tasa del día es obligatoria.');
      return;
    }
    if (isFieldVisible('priority') && isFieldRequired('priority') && !priority) {
      setError('Prioridad es obligatoria.');
      return;
    }
    if (isFieldVisible('paymentMethods') && isFieldRequired('paymentMethods') && paymentMethods.length === 0) {
      setError('Forma de pago es obligatoria.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await budgetsApi.create(companyId, {
        title: (isFieldVisible('title') ? title.trim() : '') || 'Presupuesto',
        clientId: selectedClientId,
        date: new Date().toISOString().slice(0, 10),
        ivaPercent,
        rateOfDay: isFieldVisible('rateOfDay') ? Number(rateOfDay) : (Number(rateOfDay) || config?.usdRate || 1),
        currencies,
        observations: isFieldVisible('observations') ? observations.trim() || undefined : undefined,
        priority: isFieldVisible('priority') ? priority : 'NORMAL',
        paymentMethods: isFieldVisible('paymentMethods') ? paymentMethods : [],
        deliveryTime: isFieldVisible('deliveryTime') ? deliveryTime.trim() || undefined : undefined,
        validity: isFieldVisible('validity') ? validity.trim() || undefined : undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, sortOrder: i.sortOrder })),
      });
      setTab('list');
      loadList();
      setTitle('');
      setClientRif('');
      setClientSearchResult(null);
      setSelectedClientId(null);
      setItems([]);
      setRateOfDay('');
      setObservations('');
      setPaymentMethods([]);
      setDeliveryTime('');
      setValidity('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async (id: string) => {
    if (!companyId) return;
    try {
      const blob = await budgetsApi.getPdfBlob(id, companyId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `presupuesto-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al descargar PDF');
    }
  };

  const handleDelete = async (id: string) => {
    if (!companyId) return;
    try {
      await budgetsApi.delete(id, companyId);
      setDeleteModal(null);
      loadList();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  if (!user) return null;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Presupuestos</h1>
      <p className="text-[var(--muted)] mt-1">Crear y consultar presupuestos.</p>

      {user.role === 'SUPER_ADMIN' && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Empresa</label>
          <select
            value={selectedCompanyId ?? ''}
            onChange={(e) => setSelectedCompanyId(e.target.value || null)}
            className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 text-[var(--foreground)]"
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
          <div className="flex gap-2 mt-6 border-b border-[var(--border)]">
            <button
              type="button"
              onClick={() => setTab('new')}
              className={`px-4 py-2 font-medium ${tab === 'new' ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' : 'text-[var(--muted)]'}`}
            >
              Nuevo presupuesto
            </button>
            <button
              type="button"
              onClick={() => setTab('list')}
              className={`px-4 py-2 font-medium ${tab === 'list' ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' : 'text-[var(--muted)]'}`}
            >
              Consultar presupuestos
            </button>
          </div>

          {tab === 'new' && (
            <div className="mt-6 space-y-6 max-w-4xl">
              <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)] mb-3">Datos de la empresa</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <p><span className="text-[var(--muted)]">Nombre:</span> {company?.name ?? '—'}</p>
                  <p><span className="text-[var(--muted)]">RIF:</span> {company?.rif ?? '—'}</p>
                  <p className="md:col-span-2"><span className="text-[var(--muted)]">Dirección:</span> {company?.address ?? '—'}</p>
                </div>
                <p className="text-[var(--muted)] mt-2 text-xs">Fecha del día: {today}</p>
              </section>

              {isFieldVisible('title') && (
              <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)] mb-3">Título del presupuesto</h2>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título"
                  className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                />
              </section>
              )}

              <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)] mb-3">Cliente</h2>
                <div className="flex gap-2 flex-wrap">
                  <input
                    value={clientRif}
                    onChange={(e) => setClientRif(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchClient()}
                    placeholder="RIF o Cédula"
                    className="flex-1 min-w-[200px] rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                  />
                  <button type="button" onClick={handleSearchClient} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2">Buscar</button>
                </div>
                {clientSearchResult === 'loading' && <p className="mt-2 text-sm text-[var(--muted)]">Buscando...</p>}
                {clientSearchResult && clientSearchResult !== 'loading' && (
                  <div className="mt-3 p-3 rounded-lg bg-[var(--background)]">
                    <p className="font-medium">{clientSearchResult.name}</p>
                    <p className="text-sm text-[var(--muted)]">RIF/Cédula: {clientSearchResult.rifCedula}</p>
                    {!selectedClientId && (
                      <p className="text-sm mt-2">Completa los datos y guarda el cliente para continuar.</p>
                    )}
                  </div>
                )}
                {clientSearchResult && clientSearchResult !== 'loading' && !selectedClientId && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input value={clientForm.name} onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre *" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    <input value={clientForm.rifCedula} onChange={(e) => setClientForm((f) => ({ ...f, rifCedula: e.target.value }))} placeholder="RIF/Cédula *" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    <input value={clientForm.address} onChange={(e) => setClientForm((f) => ({ ...f, address: e.target.value }))} placeholder="Dirección" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 md:col-span-2" />
                    <input value={clientForm.phone} onChange={(e) => setClientForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Teléfono" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    <input value={clientForm.email} onChange={(e) => setClientForm((f) => ({ ...f, email: e.target.value }))} placeholder="Correo" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    <button type="button" onClick={handleAddClientAndContinue} disabled={saving} className="rounded-lg bg-[var(--alternative)] text-white px-4 py-2 disabled:opacity-50">Guardar cliente y continuar</button>
                  </div>
                )}
              </section>

              <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)] mb-3">Productos</h2>
                <input
                  value={productCodeInput}
                  onChange={(e) => setProductCodeInput(e.target.value)}
                  onKeyDown={handleProductCodeKeyDown}
                  placeholder="Código del producto (Enter para buscar y agregar)"
                  className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 mb-3"
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--muted)]">
                        <th className="p-2">COD</th>
                        <th className="p-2">Nombre</th>
                        <th className="p-2">Cant.</th>
                        <th className="p-2">P. unit.</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={it.productId} className="border-t border-[var(--border)]">
                          <td className="p-2">{it.code}</td>
                          <td className="p-2">{it.name}</td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              value={it.quantity}
                              onChange={(e) => updateItem(it.productId, { quantity: Number(e.target.value) || 1 })}
                              className="w-16 rounded bg-[var(--background)] border border-[var(--border)] px-2 py-1"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={it.unitPrice}
                              onChange={(e) => updateItem(it.productId, { unitPrice: Number(e.target.value) || 0 })}
                              className="w-24 rounded bg-[var(--background)] border border-[var(--border)] px-2 py-1"
                            />
                          </td>
                          <td className="p-2">
                            <button type="button" onClick={() => moveItem(it.productId, 'up')} disabled={idx === 0} className="mr-1 text-[var(--muted)] disabled:opacity-50">↑</button>
                            <button type="button" onClick={() => moveItem(it.productId, 'down')} disabled={idx === items.length - 1} className="mr-1 text-[var(--muted)] disabled:opacity-50">↓</button>
                            <button type="button" onClick={() => removeItem(it.productId)} className="text-[var(--destructive)]">Quitar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)] mb-3">Información general</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">IVA (%)</label>
                    <input type="number" min={0} step={0.01} value={ivaPercent} onChange={(e) => setIvaPercent(Number(e.target.value))} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  </div>
                  {isFieldVisible('rateOfDay') && (
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Tasa del día</label>
                    <input value={rateOfDay} onChange={(e) => setRateOfDay(e.target.value)} placeholder="Ej: 36.5" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  </div>
                  )}
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Moneda(s)</label>
                    <div className="flex gap-2 flex-wrap">
                      {CURRENCY_OPTIONS.map((c) => (
                        <label key={c} className="flex items-center gap-1">
                          <input type="checkbox" checked={currencies.includes(c)} onChange={() => toggleCurrency(c)} />
                          <span>{c}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--muted)]">Máx. 2 opciones; no USD y EUR a la vez.</p>
                  </div>
                  {isFieldVisible('priority') && (
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Prioridad</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value as 'NORMAL' | 'URGENT')} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2">
                      <option value="NORMAL">Normal</option>
                      <option value="URGENT">Urgente</option>
                    </select>
                  </div>
                  )}
                  {isFieldVisible('paymentMethods') && (
                  <div className="md:col-span-2">
                    <label className="block text-sm text-[var(--muted)] mb-1">Forma de pago</label>
                    <div className="flex flex-wrap gap-2">
                      {PAYMENT_OPTIONS.map((p) => (
                        <label key={p} className="flex items-center gap-1">
                          <input type="checkbox" checked={paymentMethods.includes(p)} onChange={() => togglePayment(p)} />
                          <span>{p.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  )}
                  {isFieldVisible('deliveryTime') && (
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Tiempo de entrega</label>
                    <input value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  </div>
                  )}
                  {isFieldVisible('validity') && (
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Validez del presupuesto</label>
                    <input value={validity} onChange={(e) => setValidity(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  </div>
                  )}
                  {isFieldVisible('observations') && (
                  <div className="md:col-span-2">
                    <label className="block text-sm text-[var(--muted)] mb-1">Observaciones</label>
                    <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  </div>
                  )}
                </div>
              </section>

              {error && <p className="text-[var(--destructive)]">{error}</p>}
              <button type="button" onClick={handleSubmitBudget} disabled={saving || !selectedClientId || items.length === 0} className="rounded-lg bg-[var(--primary)] text-white px-6 py-2 font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar presupuesto'}
              </button>
            </div>
          )}

          {tab === 'list' && (
            <div className="mt-6">
              <button type="button" onClick={() => setFiltersOpen((o) => !o)} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-4 py-2 text-sm">
                {filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
              </button>
              {filtersOpen && (
                <div className="mt-3 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} placeholder="Desde" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} placeholder="Hasta" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  <input value={filterCode} onChange={(e) => setFilterCode(e.target.value)} placeholder="Código presupuesto" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  <input value={filterClient} onChange={(e) => setFilterClient(e.target.value)} placeholder="Cliente" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  <input value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} placeholder="Producto" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 md:col-span-2" />
                </div>
              )}
              <div className="flex gap-2 mt-4 items-center">
                <span className="text-sm text-[var(--muted)]">Mostrar</span>
                <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-2 py-1">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="overflow-x-auto mt-3 rounded-xl border border-[var(--border)]">
                <table className="w-full text-left">
                  <thead className="bg-[var(--card)]">
                    <tr>
                      <th className="p-3 font-medium">Correlativo</th>
                      <th className="p-3 font-medium">Título</th>
                      <th className="p-3 font-medium">Cliente</th>
                      <th className="p-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.items.map((b: any) => (
                      <tr key={b.id} className="border-t border-[var(--border)]">
                        <td className="p-3">{b.correlative}</td>
                        <td className="p-3">{b.title}</td>
                        <td className="p-3">{b.client?.name ?? '—'}</td>
                        <td className="p-3 flex flex-wrap gap-1">
                          <button type="button" onClick={() => handleDownloadPdf(b.id)} className="text-sm rounded px-2 py-1 bg-[var(--primary)] text-white">Descargar</button>
                          <button type="button" onClick={() => setEditModal({ id: b.id, budget: b })} className="text-sm rounded px-2 py-1 bg-[var(--card-hover)]">Editar</button>
                          <button type="button" onClick={() => setDuplicateModal({ id: b.id, budget: b })} className="text-sm rounded px-2 py-1 bg-[var(--alternative)] text-white">Duplicar</button>
                          <button type="button" onClick={() => setDeleteModal({ id: b.id, correlative: b.correlative })} className="text-sm rounded px-2 py-1 bg-[var(--destructive)] text-white">Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {list.items.length === 0 && <p className="py-6 text-center text-[var(--muted)]">No hay presupuestos.</p>}
              <div className="mt-3 flex justify-between text-sm text-[var(--muted)]">
                <span>Total: {list.total}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded px-2 py-1 bg-[var(--card)] disabled:opacity-50">Anterior</button>
                  <span>Pág. {page}</span>
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page * limit >= list.total} className="rounded px-2 py-1 bg-[var(--card)] disabled:opacity-50">Siguiente</button>
                </div>
              </div>
            </div>
          )}

          {deleteModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteModal(null)}>
              <div className="bg-[var(--card)] rounded-xl p-6 max-w-md w-full border border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
                <p className="font-medium">¿Eliminar presupuesto {deleteModal.correlative}?</p>
                <p className="text-sm text-[var(--muted)] mt-1">No se borrará de la base de datos; quedará desactivado.</p>
                <div className="flex gap-2 mt-4">
                  <button type="button" onClick={() => handleDelete(deleteModal.id)} className="rounded-lg bg-[var(--destructive)] text-white px-4 py-2">Sí, eliminar</button>
                  <button type="button" onClick={() => setDeleteModal(null)} className="rounded-lg bg-[var(--card-hover)] px-4 py-2">Cancelar</button>
                </div>
              </div>
            </div>
          )}
          {editModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditModal(null)}>
              <div className="bg-[var(--card)] rounded-xl p-6 max-w-lg w-full border border-[var(--border)] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                <p className="font-medium">Editar presupuesto {editModal.budget?.correlative}</p>
                <p className="text-sm text-[var(--muted)] mt-1">En esta versión solo puedes descargar el PDF. La edición completa se implementará próximamente.</p>
                <button type="button" onClick={() => setEditModal(null)} className="mt-4 rounded-lg bg-[var(--card-hover)] px-4 py-2">Cerrar</button>
              </div>
            </div>
          )}
          {duplicateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDuplicateModal(null)}>
              <div className="bg-[var(--card)] rounded-xl p-6 max-w-lg w-full border border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
                <p className="font-medium">Duplicar presupuesto</p>
                <p className="text-sm text-[var(--muted)] mt-1">Se creará una copia con nuevo correlativo. Deberás asignar cliente y datos generales. ¿Continuar?</p>
                <p className="text-sm text-[var(--muted)] mt-2">La duplicación completa se implementará próximamente.</p>
                <button type="button" onClick={() => setDuplicateModal(null)} className="mt-4 rounded-lg bg-[var(--card-hover)] px-4 py-2">Cerrar</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
