'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { invoicesApi, budgetsApi, clientsApi, productsApi, companiesApi, configApi, inventoryApi } from '@/lib/api';
import { ActionModal, type ActionModalVariant } from '@/components/ActionModal';

const PAYMENT_OPTIONS = ['EFECTIVO', 'PAGO_MOVIL', 'TRANSFERENCIA', 'BINANCE', 'ZELLE'];
const CURRENCY_OPTIONS = ['USD', 'EUR', 'BS'];

type InvoiceItemRow = { productId: string; code: string; name: string; quantity: number; unitPrice: number; sortOrder: number };

function getCompanyId(user: { role: string; companyId: string | null }, selected: string | null): string | null {
  return user.role === 'SUPER_ADMIN' ? selected : user.companyId;
}

export default function FacturacionPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;

  const [tab, setTab] = useState<'from-budget' | 'new' | 'list'>('new');

  const [budgets, setBudgets] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [budgetPage, setBudgetPage] = useState(1);
  const [budgetLimit] = useState(25);
  const [budgetFilterFrom, setBudgetFilterFrom] = useState('');
  const [budgetFilterTo, setBudgetFilterTo] = useState('');
  const [budgetFilterCode, setBudgetFilterCode] = useState('');
  const [budgetFilterClient, setBudgetFilterClient] = useState('');
  const [selectedBudget, setSelectedBudget] = useState<any | null>(null);
  const [creatingFromBudget, setCreatingFromBudget] = useState(false);

  const [invoices, setInvoices] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceLimit, setInvoiceLimit] = useState(25);
  const [invoiceFiltersOpen, setInvoiceFiltersOpen] = useState(false);
  const [invoiceFilterFrom, setInvoiceFilterFrom] = useState('');
  const [invoiceFilterTo, setInvoiceFilterTo] = useState('');
  const [invoiceFilterCode, setInvoiceFilterCode] = useState('');
  const [invoiceFilterClient, setInvoiceFilterClient] = useState('');

  const [actionModal, setActionModal] = useState<{ open: boolean; title: string; message: string; variant: ActionModalVariant }>({ open: false, title: '', message: '', variant: 'info' });
  const showActionModal = (title: string, message: string, variant: ActionModalVariant = 'info') => setActionModal({ open: true, title, message, variant });
  const closeActionModal = () => setActionModal((p) => ({ ...p, open: false }));

  const [company, setCompany] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [clientRif, setClientRif] = useState('');
  const [clientSearchResult, setClientSearchResult] = useState<any | 'loading' | 'not-found'>(null);
  const [clientForm, setClientForm] = useState<{ name: string; address: string; rifCedula: string; phone: string; email: string }>({ name: '', address: '', rifCedula: '', phone: '', email: '' });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [productCodeInput, setProductCodeInput] = useState('');
  const [items, setItems] = useState<InvoiceItemRow[]>([]);
  const [ivaPercent, setIvaPercent] = useState(12);
  const [rateOfDay, setRateOfDay] = useState('');
  const [currencies, setCurrencies] = useState<string[]>(['BS']);
  const [observations, setObservations] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [deliveryTime, setDeliveryTime] = useState('');
  const [validity, setValidity] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [errorInvoice, setErrorInvoice] = useState('');

  const [productNotFoundModal, setProductNotFoundModal] = useState<{ open: boolean; code: string }>({ open: false, code: '' });
  const [registerProductModal, setRegisterProductModal] = useState(false);
  const cancelProductNotFoundRef = useRef<HTMLButtonElement>(null);
  const productCodeInputRef = useRef<HTMLInputElement>(null);
  const [newProductForm, setNewProductForm] = useState({ code: '', name: '', description: '' });
  const [newIngresoForm, setNewIngresoForm] = useState({ quantity: '', unitCost: '', salePrice: '', observation: '' });
  const [registerProductSaving, setRegisterProductSaving] = useState(false);
  const [registerProductError, setRegisterProductError] = useState('');

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') companiesApi.list().then(setCompanies).catch(() => {});
  }, [user?.role]);
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' && companies.length > 0 && !selectedCompanyId) setSelectedCompanyId(companies[0].id);
    if (user?.role !== 'SUPER_ADMIN' && user?.companyId) setSelectedCompanyId(user.companyId);
  }, [user, companies, selectedCompanyId]);

  const loadBudgets = useCallback(() => {
    if (!companyId) return;
    const params: Record<string, string> = { companyId, page: String(budgetPage), limit: String(budgetLimit) };
    if (budgetFilterFrom) params.from = budgetFilterFrom;
    if (budgetFilterTo) params.to = budgetFilterTo;
    if (budgetFilterCode) params.code = budgetFilterCode;
    if (budgetFilterClient) params.client = budgetFilterClient;
    budgetsApi.list(companyId, params).then(setBudgets).catch(() => {});
  }, [companyId, budgetPage, budgetLimit, budgetFilterFrom, budgetFilterTo, budgetFilterCode, budgetFilterClient]);

  const loadInvoices = useCallback(() => {
    if (!companyId) return;
    const params: Record<string, string> = { companyId, page: String(invoicePage), limit: String(invoiceLimit) };
    if (invoiceFilterFrom) params.from = invoiceFilterFrom;
    if (invoiceFilterTo) params.to = invoiceFilterTo;
    if (invoiceFilterCode) params.code = invoiceFilterCode;
    if (invoiceFilterClient) params.client = invoiceFilterClient;
    invoicesApi.list(companyId, params).then(setInvoices).catch(() => {});
  }, [companyId, invoicePage, invoiceLimit, invoiceFilterFrom, invoiceFilterTo, invoiceFilterCode, invoiceFilterClient]);

  useEffect(() => { if (tab === 'from-budget') loadBudgets(); }, [tab, loadBudgets]);
  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  useEffect(() => {
    if (!companyId || tab !== 'new') return;
    companiesApi.get(companyId).then((c: any) => setCompany(c)).catch(() => setCompany(null));
    configApi.get(companyId).then((c: any) => {
      setConfig(c);
      setCurrencies(prev => (prev.length === 1 && prev[0] === 'BS' ? [c?.currencySymbol || 'BS'] : prev));
    }).catch(() => setConfig(null));
  }, [companyId, tab]);

  useEffect(() => {
    if (productNotFoundModal.open && cancelProductNotFoundRef.current) {
      cancelProductNotFoundRef.current.focus();
    }
  }, [productNotFoundModal.open]);

  const closeProductNotFoundModal = () => {
    setProductNotFoundModal({ open: false, code: '' });
    setTimeout(() => {
      productCodeInputRef.current?.focus();
      productCodeInputRef.current?.select();
    }, 0);
  };

  const openRegisterProductModal = () => {
    setNewProductForm({ code: productNotFoundModal.code, name: '', description: '' });
    setNewIngresoForm({ quantity: '', unitCost: '', salePrice: '', observation: '' });
    setRegisterProductError('');
    setRegisterProductModal(true);
    setProductNotFoundModal({ open: false, code: '' });
  };

  const handleRegisterProductSubmit = async () => {
    if (!companyId || !newProductForm.code.trim() || !newProductForm.name.trim()) {
      setRegisterProductError('Código y nombre del producto son obligatorios.');
      return;
    }
    const qty = newIngresoForm.quantity.trim() ? Number(newIngresoForm.quantity) : 0;
    if (qty < 0) {
      setRegisterProductError('La cantidad del ingreso no puede ser negativa.');
      return;
    }
    setRegisterProductSaving(true);
    setRegisterProductError('');
    try {
      const created = await productsApi.create(companyId, {
        code: newProductForm.code.trim(),
        name: newProductForm.name.trim(),
        description: newProductForm.description.trim() || undefined,
      }) as any;
      let unitPrice = 0;
      if (qty > 0) {
        await inventoryApi.ingress(companyId, {
          productId: created.id,
          quantity: qty,
          unitCost: newIngresoForm.unitCost.trim() ? Number(newIngresoForm.unitCost) : undefined,
          salePrice: newIngresoForm.salePrice.trim() ? Number(newIngresoForm.salePrice) : undefined,
          observation: newIngresoForm.observation.trim() || undefined,
        });
        unitPrice = newIngresoForm.salePrice.trim() ? Number(newIngresoForm.salePrice) : 0;
      }
      setItems((prev) => [
        ...prev,
        { productId: created.id, code: created.code, name: created.name, quantity: 1, unitPrice, sortOrder: prev.length + 1 },
      ]);
      setProductCodeInput('');
      setRegisterProductModal(false);
    } catch (e) {
      setRegisterProductError(e instanceof Error ? e.message : 'Error al registrar producto');
    } finally {
      setRegisterProductSaving(false);
    }
  };

  const handleSearchClient = async () => {
    if (!companyId || !clientRif.trim()) return;
    setClientSearchResult('loading');
    try {
      const found = await clientsApi.search(companyId, clientRif.trim()) as any;
      setClientSearchResult(found ?? 'not-found');
      if (found) {
        setSelectedClientId(found.id);
        setClientForm({ name: found.name, address: found.address ?? '', rifCedula: found.rifCedula, phone: found.phone ?? '', email: found.email ?? '' });
      } else {
        setSelectedClientId(null);
        setClientForm({ name: '', address: '', rifCedula: clientRif.trim(), phone: '', email: '' });
      }
    } catch { setClientSearchResult(null); }
  };

  const isClientNotFound = clientSearchResult === 'not-found';
  const canSubmitWithNewClient = isClientNotFound && clientForm.name.trim() && clientForm.rifCedula.trim();
  const hasValidClient = !!selectedClientId || canSubmitWithNewClient;

  const handleProductCodeKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !companyId || !productCodeInput.trim()) return;
    e.preventDefault();
    try {
      const list = await productsApi.search(companyId, productCodeInput.trim()) as any[];
      const prod = list[0];
      if (!prod) {
        setProductNotFoundModal({ open: true, code: productCodeInput.trim() });
        return;
      }
      const existing = items.find((i) => i.productId === prod.id);
      const unitPrice = Number(prod.salePrice) || 0;
      if (existing) {
        setItems((prev) => prev.map((i) => i.productId === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
      } else {
        setItems((prev) => [...prev, { productId: prod.id, code: prod.code, name: prod.name, quantity: 1, unitPrice, sortOrder: prev.length + 1 }]);
      }
      setProductCodeInput('');
    } catch { /* ignore */ }
  };

  const updateItem = (productId: string, upd: Partial<InvoiceItemRow>) => {
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

  const handleSubmitInvoice = async () => {
    if (!companyId) return;
    let clientId = selectedClientId;
    if (!clientId && canSubmitWithNewClient) {
      setErrorInvoice('');
      setSavingInvoice(true);
      try {
        const created = await clientsApi.create(companyId, clientForm) as any;
        clientId = created.id;
      } catch (e) {
        setErrorInvoice(e instanceof Error ? e.message : 'Error al crear cliente');
        setSavingInvoice(false);
        return;
      }
    }
    if (!clientId) {
      setErrorInvoice('Cliente es obligatorio. Busca por RIF/Cédula o completa los datos si no está registrado.');
      return;
    }
    if (items.length === 0) { setErrorInvoice('Agrega al menos un producto.'); return; }
    const invFieldConfig = config?.invoiceFieldsConfig ?? {};
    const invVisible = (key: string) => invFieldConfig[key]?.visible !== false;
    const invRequired = (key: string) => invFieldConfig[key]?.required === true;
    if (invVisible('title') && !title.trim()) { setErrorInvoice('Título es obligatorio.'); return; }
    if (invVisible('rateOfDay')) {
      const needsRate = currencies.some((c) => c === 'USD' || c === 'EUR');
      if (needsRate && (!rateOfDay.trim() || isNaN(Number(rateOfDay)))) { setErrorInvoice('Tasa del día es obligatoria cuando se selecciona USD o EUR.'); return; }
    }
    if (invVisible('paymentMethods') && invRequired('paymentMethods') && paymentMethods.length === 0) { setErrorInvoice('Forma de pago es obligatoria.'); return; }
    setSavingInvoice(true); setErrorInvoice('');
    try {
      const invFieldConfig = config?.invoiceFieldsConfig ?? {};
      const invVisible = (key: string) => invFieldConfig[key]?.visible !== false;
      await invoicesApi.create(companyId, {
        title: (invVisible('title') ? title.trim() : '') || 'Factura',
        clientId,
        date: new Date().toISOString().slice(0, 10),
        ivaPercent,
        rateOfDay: invVisible('rateOfDay') ? Number(rateOfDay) : (Number(rateOfDay) || config?.usdRate || 1),
        currencies,
        observations: invVisible('observations') ? observations.trim() || undefined : undefined,
        priority: invVisible('priority') ? priority : 'NORMAL',
        paymentMethods: invVisible('paymentMethods') ? paymentMethods : [],
        deliveryTime: invVisible('deliveryTime') ? deliveryTime.trim() || undefined : undefined,
        validity: invVisible('validity') ? validity.trim() || undefined : undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, sortOrder: i.sortOrder })),
      });
      setTab('list'); loadInvoices();
      setTitle(''); setClientRif(''); setClientSearchResult(null); setSelectedClientId(null);
      setItems([]); setRateOfDay(''); setObservations(''); setPaymentMethods([]); setDeliveryTime(''); setValidity('');
    } catch (e) { setErrorInvoice(e instanceof Error ? e.message : 'Error'); } finally { setSavingInvoice(false); }
  };

  const handleCreateFromBudget = async () => {
    if (!companyId || !selectedBudget?.id) return;
    setCreatingFromBudget(true);
    try {
      await invoicesApi.createFromBudget(companyId, selectedBudget.id);
      setSelectedBudget(null);
      loadInvoices();
      setTab('list');
    } catch (e) {
      showActionModal('Error al generar factura', e instanceof Error ? e.message : 'Error al generar factura', 'error');
    } finally {
      setCreatingFromBudget(false);
    }
  };

  const handleDownloadInvoicePdf = async (id: string) => {
    if (!companyId) return;
    try {
      const blob = await invoicesApi.getPdfBlob(id, companyId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showActionModal('Error al descargar PDF', e instanceof Error ? e.message : 'Error al descargar PDF', 'error');
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Facturación</h1>
      <p className="text-[var(--muted)] mt-1">Generar factura desde presupuesto o crear factura nueva. Consultar y descargar.</p>

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
          <div className="flex gap-2 mt-6 border-b border-[var(--border)] flex-wrap">
            <button
              type="button"
              onClick={() => setTab('new')}
              className={`px-4 py-2 font-medium ${tab === 'new' ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' : 'text-[var(--muted)]'}`}
            >
              Nueva factura
            </button>
            <button
              type="button"
              onClick={() => { setTab('from-budget'); setSelectedBudget(null); }}
              className={`px-4 py-2 font-medium ${tab === 'from-budget' ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' : 'text-[var(--muted)]'}`}
            >
              Desde presupuesto
            </button>
            <button
              type="button"
              onClick={() => setTab('list')}
              className={`px-4 py-2 font-medium ${tab === 'list' ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' : 'text-[var(--muted)]'}`}
            >
              Consultar facturas
            </button>
          </div>

          {tab === 'from-budget' && (
            <div className="mt-6">
              <p className="text-[var(--muted)] mb-3">Filtros para listar presupuestos:</p>
              <div className="flex flex-wrap gap-3 mb-4">
                <input type="date" value={budgetFilterFrom} onChange={(e) => setBudgetFilterFrom(e.target.value)} placeholder="Desde" className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2" />
                <input type="date" value={budgetFilterTo} onChange={(e) => setBudgetFilterTo(e.target.value)} placeholder="Hasta" className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2" />
                <input value={budgetFilterCode} onChange={(e) => setBudgetFilterCode(e.target.value)} placeholder="Código presupuesto" className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 w-40" />
                <input value={budgetFilterClient} onChange={(e) => setBudgetFilterClient(e.target.value)} placeholder="Cliente" className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 w-40" />
                <button type="button" onClick={loadBudgets} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2">Buscar</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-left">
                  <thead className="bg-[var(--card)]">
                    <tr>
                      <th className="p-3 font-medium">Correlativo</th>
                      <th className="p-3 font-medium">Título</th>
                      <th className="p-3 font-medium">Cliente</th>
                      <th className="p-3 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgets.items.map((b: any) => (
                      <tr key={b.id} className="border-t border-[var(--border)]">
                        <td className="p-3">{b.correlative}</td>
                        <td className="p-3">{b.title}</td>
                        <td className="p-3">{b.client?.name ?? '—'}</td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => setSelectedBudget(selectedBudget?.id === b.id ? null : b)}
                            className={`rounded px-2 py-1 text-sm ${selectedBudget?.id === b.id ? 'bg-[var(--primary)] text-white' : 'bg-[var(--card-hover)]'}`}
                          >
                            {selectedBudget?.id === b.id ? 'Seleccionado' : 'Usar para factura'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {budgets.items.length === 0 && <p className="py-6 text-center text-[var(--muted)]">No hay presupuestos.</p>}
              <div className="mt-3 flex justify-between text-sm text-[var(--muted)]">
                <span>Total: {budgets.total}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setBudgetPage((p) => Math.max(1, p - 1))} disabled={budgetPage <= 1} className="rounded px-2 py-1 bg-[var(--card)] disabled:opacity-50">Anterior</button>
                  <span>Pág. {budgetPage}</span>
                  <button type="button" onClick={() => setBudgetPage((p) => p + 1)} disabled={budgetPage * budgetLimit >= budgets.total} className="rounded px-2 py-1 bg-[var(--card)] disabled:opacity-50">Siguiente</button>
                </div>
              </div>
              {selectedBudget && (
                <div className="mt-6 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                  <p className="font-medium mb-2">Generar factura a partir del presupuesto {selectedBudget.correlative}</p>
                  <p className="text-sm text-[var(--muted)] mb-3">Título: {selectedBudget.title} — Cliente: {selectedBudget.client?.name}. La factura tendrá un correlativo propio.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleCreateFromBudget} disabled={creatingFromBudget} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 disabled:opacity-50">
                      {creatingFromBudget ? 'Generando...' : 'Confirmar y generar factura'}
                    </button>
                    <button type="button" onClick={() => setSelectedBudget(null)} className="rounded-lg bg-[var(--card-hover)] px-4 py-2">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'new' && (
            <div className="mt-6 space-y-6 max-w-4xl">
              <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)] mb-3">Datos de la empresa</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <p><span className="text-[var(--muted)]">Nombre:</span> {company?.name ?? '—'}</p>
                  <p><span className="text-[var(--muted)]">RIF:</span> {company?.rif ?? '—'}</p>
                  <p className="md:col-span-2"><span className="text-[var(--muted)]">Dirección:</span> {company?.address ?? '—'}</p>
                </div>
                <p className="text-[var(--muted)] mt-2 text-xs">Fecha: {new Date().toISOString().slice(0, 10)} — Correlativo de factura (generado automáticamente)</p>
              </section>
              {(config?.invoiceFieldsConfig ?? {})['title']?.visible !== false && (
              <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)] mb-3">Título de la factura</h2>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </section>
              )}
              <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)] mb-3">Cliente</h2>
                <div className="flex gap-2 flex-wrap">
                  <input value={clientRif} onChange={(e) => setClientRif(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchClient()} placeholder="RIF o Cédula" className="flex-1 min-w-[200px] rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  <button type="button" onClick={handleSearchClient} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2">Buscar</button>
                </div>
                {clientSearchResult === 'loading' && <p className="mt-2 text-sm text-[var(--muted)]">Buscando...</p>}
                {clientSearchResult && clientSearchResult !== 'loading' && clientSearchResult !== 'not-found' && (
                  <div className="mt-3 p-3 rounded-lg bg-[var(--background)]">
                    <p className="font-medium">{clientSearchResult.name}</p>
                    <p className="text-sm text-[var(--muted)]">RIF/Cédula: {clientSearchResult.rifCedula}</p>
                  </div>
                )}
                {clientSearchResult === 'not-found' && (
                  <>
                    <p className="mt-2 text-sm text-[var(--muted)]">No existe un cliente con ese RIF/Cédula. Completa los datos; se guardará al guardar la factura.</p>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input value={clientForm.name} onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre *" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                      <input value={clientForm.rifCedula} onChange={(e) => setClientForm((f) => ({ ...f, rifCedula: e.target.value }))} placeholder="RIF/Cédula *" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                      <input value={clientForm.address} onChange={(e) => setClientForm((f) => ({ ...f, address: e.target.value }))} placeholder="Dirección" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 md:col-span-2" />
                      <input value={clientForm.phone} onChange={(e) => setClientForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Teléfono" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                      <input value={clientForm.email} onChange={(e) => setClientForm((f) => ({ ...f, email: e.target.value }))} placeholder="Correo" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    </div>
                  </>
                )}
              </section>
              <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)] mb-3">Productos</h2>
                <input ref={productCodeInputRef} value={productCodeInput} onChange={(e) => setProductCodeInput(e.target.value)} onKeyDown={handleProductCodeKeyDown} placeholder="Código del producto (Enter para buscar y agregar)" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 mb-3" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-[var(--muted)]"><th className="p-2">COD</th><th className="p-2">Nombre</th><th className="p-2">Cant.</th><th className="p-2">P. unit.</th><th className="p-2">Total</th><th className="p-2"></th></tr></thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={it.productId} className="border-t border-[var(--border)]">
                          <td className="p-2">{it.code}</td><td className="p-2">{it.name}</td>
                          <td className="p-2"><input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(it.productId, { quantity: Number(e.target.value) || 1 })} className="w-16 rounded bg-[var(--background)] border border-[var(--border)] px-2 py-1" /></td>
                          <td className="p-2 text-right tabular-nums">{(it.unitPrice ?? 0).toFixed(2)}</td>
                          <td className="p-2 text-right tabular-nums">{((it.quantity ?? 0) * (it.unitPrice ?? 0)).toFixed(2)}</td>
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
                {items.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm space-y-1">
                    {(() => {
                      const cantidadProductos = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
                      const subtotalBs = items.reduce((s, i) => s + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);
                      const ivaMonto = subtotalBs * (ivaPercent / 100);
                      const totalBs = subtotalBs + ivaMonto;
                      const rate = rateOfDay && !isNaN(Number(rateOfDay)) ? Number(rateOfDay) : config?.usdRate;
                      return (
                        <>
                          <p className="text-[var(--muted)]">Cantidad de productos: <strong className="text-[var(--foreground)]">{cantidadProductos}</strong></p>
                          <p className="text-[var(--foreground)]">Subtotal: <strong>{subtotalBs.toFixed(2)}</strong> Bs.</p>
                          <p className="text-[var(--foreground)]">IVA ({ivaPercent}%): <strong>{ivaMonto.toFixed(2)}</strong> Bs.</p>
                          <p className="text-[var(--foreground)] font-medium">Total Bs.: <strong>{totalBs.toFixed(2)}</strong> Bs.</p>
                          {currencies.includes('USD') && rate && rate > 0 && (
                            <p className="text-[var(--muted)]">Total USD (tasa {rate}): <strong>{(totalBs / rate).toFixed(2)}</strong> USD</p>
                          )}
                          {currencies.includes('EUR') && config?.eurRate && config.eurRate > 0 && (
                            <p className="text-[var(--muted)]">Total EUR (tasa {config.eurRate}): <strong>{(totalBs / config.eurRate).toFixed(2)}</strong> EUR</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </section>
              <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)] mb-3">Información general</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm text-[var(--muted)] mb-1">IVA (%)</label><input type="number" min={0} step={0.01} value={ivaPercent} onChange={(e) => setIvaPercent(Number(e.target.value))} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" /></div>
                  {(config?.invoiceFieldsConfig ?? {})['rateOfDay']?.visible !== false && (
                  <div><label className="block text-sm text-[var(--muted)] mb-1">Tasa del día</label><input value={rateOfDay} onChange={(e) => setRateOfDay(e.target.value)} placeholder="Ej: 36.5" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" /></div>
                  )}
                  <div><label className="block text-sm text-[var(--muted)] mb-1">Moneda(s)</label><div className="flex gap-2 flex-wrap">{CURRENCY_OPTIONS.map((c) => (<label key={c} className="flex items-center gap-1"><input type="checkbox" checked={currencies.includes(c)} onChange={() => toggleCurrency(c)} /><span>{c}</span></label>))}</div><p className="text-xs text-[var(--muted)]">Máx. 2; no USD y EUR a la vez.</p></div>
                  {(config?.invoiceFieldsConfig ?? {})['priority']?.visible !== false && (
                  <div><label className="block text-sm text-[var(--muted)] mb-1">Prioridad</label><select value={priority} onChange={(e) => setPriority(e.target.value as 'NORMAL' | 'URGENT')} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"><option value="NORMAL">Normal</option><option value="URGENT">Urgente</option></select></div>
                  )}
                  {(config?.invoiceFieldsConfig ?? {})['paymentMethods']?.visible !== false && (
                  <div className="md:col-span-2"><label className="block text-sm text-[var(--muted)] mb-1">Forma de pago</label><div className="flex flex-wrap gap-2">{PAYMENT_OPTIONS.map((p) => (<label key={p} className="flex items-center gap-1"><input type="checkbox" checked={paymentMethods.includes(p)} onChange={() => togglePayment(p)} /><span>{p.replace('_', ' ')}</span></label>))}</div></div>
                  )}
                  {(config?.invoiceFieldsConfig ?? {})['deliveryTime']?.visible !== false && (
                  <div><label className="block text-sm text-[var(--muted)] mb-1">Tiempo de entrega</label><input value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" /></div>
                  )}
                  {(config?.invoiceFieldsConfig ?? {})['validity']?.visible !== false && (
                  <div><label className="block text-sm text-[var(--muted)] mb-1">Validez</label><input value={validity} onChange={(e) => setValidity(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" /></div>
                  )}
                  {(config?.invoiceFieldsConfig ?? {})['observations']?.visible !== false && (
                  <div className="md:col-span-2"><label className="block text-sm text-[var(--muted)] mb-1">Observaciones</label><textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" /></div>
                  )}
                </div>
              </section>
              {errorInvoice && <p className="text-[var(--destructive)]">{errorInvoice}</p>}
              <button type="button" onClick={handleSubmitInvoice} disabled={savingInvoice || !hasValidClient || items.length === 0} className="rounded-lg bg-[var(--primary)] text-white px-6 py-2 font-medium disabled:opacity-50">{savingInvoice ? 'Guardando...' : 'Guardar factura'}</button>
            </div>
          )}

          {tab === 'list' && (
            <div className="mt-6">
              <button type="button" onClick={() => setInvoiceFiltersOpen((o) => !o)} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-4 py-2 text-sm mb-3">
                {invoiceFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
              </button>
              {invoiceFiltersOpen && (
                <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <input type="date" value={invoiceFilterFrom} onChange={(e) => setInvoiceFilterFrom(e.target.value)} className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  <input type="date" value={invoiceFilterTo} onChange={(e) => setInvoiceFilterTo(e.target.value)} className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  <input value={invoiceFilterCode} onChange={(e) => setInvoiceFilterCode(e.target.value)} placeholder="Código factura" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  <input value={invoiceFilterClient} onChange={(e) => setInvoiceFilterClient(e.target.value)} placeholder="Cliente" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                </div>
              )}
              <div className="flex gap-2 items-center mb-3">
                <span className="text-sm text-[var(--muted)]">Mostrar</span>
                <select value={invoiceLimit} onChange={(e) => { setInvoiceLimit(Number(e.target.value)); setInvoicePage(1); }} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-2 py-1">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-left">
                  <thead className="bg-[var(--card)]">
                    <tr>
                      <th className="p-3 font-medium">Correlativo</th>
                      <th className="p-3 font-medium">Título</th>
                      <th className="p-3 font-medium">Cliente</th>
                      <th className="p-3 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.items.map((inv: any) => (
                      <tr key={inv.id} className="border-t border-[var(--border)]">
                        <td className="p-3">{inv.correlative}</td>
                        <td className="p-3">{inv.title}</td>
                        <td className="p-3">{inv.client?.name ?? '—'}</td>
                        <td className="p-3">
                          <button type="button" onClick={() => handleDownloadInvoicePdf(inv.id)} className="rounded px-2 py-1 text-sm bg-[var(--primary)] text-white">Descargar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {invoices.items.length === 0 && <p className="py-6 text-center text-[var(--muted)]">No hay facturas.</p>}
              <div className="mt-3 flex justify-between text-sm text-[var(--muted)]">
                <span>Total: {invoices.total}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setInvoicePage((p) => Math.max(1, p - 1))} disabled={invoicePage <= 1} className="rounded px-2 py-1 bg-[var(--card)] disabled:opacity-50">Anterior</button>
                  <span>Pág. {invoicePage}</span>
                  <button type="button" onClick={() => setInvoicePage((p) => p + 1)} disabled={invoicePage * invoiceLimit >= invoices.total} className="rounded px-2 py-1 bg-[var(--card)] disabled:opacity-50">Siguiente</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: producto no encontrado */}
      {productNotFoundModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="product-not-found-title">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="product-not-found-title" className="font-semibold text-[var(--foreground)] text-lg mb-2">Artículo no encontrado</h2>
            <p className="text-sm text-[var(--muted)] mb-4">Ese artículo no se encuentra registrado.</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                ref={cancelProductNotFoundRef}
                onClick={closeProductNotFoundModal}
                onKeyDown={(e) => e.key === 'Enter' && closeProductNotFoundModal()}
                className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 font-medium"
              >
                Cancelar
              </button>
              <button type="button" onClick={openRegisterProductModal} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 font-medium">
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: registrar producto + ingreso */}
      {registerProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="register-product-title">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-lg w-full my-8 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="register-product-title" className="font-semibold text-[var(--foreground)] text-lg mb-4">Registrar producto</h2>

            <div className="space-y-3 mb-4">
              <p className="text-sm font-medium text-[var(--foreground)]">Datos del producto</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Código *</label>
                  <input value={newProductForm.code} onChange={(e) => setNewProductForm((f) => ({ ...f, code: e.target.value }))} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" placeholder="Código" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Nombre *</label>
                  <input value={newProductForm.name} onChange={(e) => setNewProductForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" placeholder="Nombre" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Descripción</label>
                  <textarea value={newProductForm.description} onChange={(e) => setNewProductForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" placeholder="Descripción" />
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--border)] my-4" aria-hidden />

            <div className="space-y-3 mb-4">
              <p className="text-sm font-medium text-[var(--foreground)]">Datos del ingreso (opcional)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Cantidad</label>
                  <input type="number" min={0} value={newIngresoForm.quantity} onChange={(e) => setNewIngresoForm((f) => ({ ...f, quantity: e.target.value }))} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Costo unitario</label>
                  <input type="number" min={0} step={0.01} value={newIngresoForm.unitCost} onChange={(e) => setNewIngresoForm((f) => ({ ...f, unitCost: e.target.value }))} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Precio de venta</label>
                  <input type="number" min={0} step={0.01} value={newIngresoForm.salePrice} onChange={(e) => setNewIngresoForm((f) => ({ ...f, salePrice: e.target.value }))} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" placeholder="0" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-[var(--muted)] mb-1">Observación</label>
                  <input value={newIngresoForm.observation} onChange={(e) => setNewIngresoForm((f) => ({ ...f, observation: e.target.value }))} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" placeholder="Observación del ingreso" />
                </div>
              </div>
            </div>

            {registerProductError && <p className="text-sm text-[var(--destructive)] mb-3">{registerProductError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setRegisterProductModal(false)} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 font-medium">Cancelar</button>
              <button type="button" onClick={handleRegisterProductSubmit} disabled={registerProductSaving} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 font-medium disabled:opacity-50">{registerProductSaving ? 'Guardando...' : 'Guardar y agregar a la factura'}</button>
            </div>
          </div>
        </div>
      )}

      <ActionModal open={actionModal.open} onClose={closeActionModal} title={actionModal.title} message={actionModal.message} variant={actionModal.variant} />
    </div>
  );
}
