'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { invoicesApi, budgetsApi, clientsApi, productsApi, companiesApi, configApi, inventoryApi } from '@/lib/api';
import { ActionModal, type ActionModalVariant } from '@/components/ActionModal';
import { IconSearch, IconX } from '@/components/Icons';
import { hasSectionAccess } from '@/lib/role-modules';

const PAYMENT_OPTIONS = ['EFECTIVO', 'PAGO_MOVIL', 'TRANSFERENCIA', 'BINANCE', 'ZELLE'];
const CURRENCY_OPTIONS = ['USD', 'EUR', 'BS'];
const PRODUCT_SEARCH_DEBOUNCE_MS = 280;
const CURRENCIES_STORAGE_KEY = 'nexusgest_facturacion_currencies';

function getInitialCurrenciesFromStorage(key: string): string[] {
  if (typeof window === 'undefined') return ['BS'];
  try {
    const s = localStorage.getItem(key);
    if (!s) return ['BS'];
    const p = JSON.parse(s) as unknown;
    if (!Array.isArray(p) || p.length < 1 || p.length > 2) return ['BS'];
    if (p.includes('USD') && p.includes('EUR')) return ['BS'];
    if (p.every((c) => ['BS', 'USD', 'EUR'].includes(String(c)))) return p;
  } catch {}
  return ['BS'];
}

function getDefaultCurrencyFromConfig(cfg: { currencySymbol?: string } | null): 'USD' | 'EUR' | 'BS' | null {
  const symbol = cfg?.currencySymbol;
  if (!symbol) return null;
  const raw = String(symbol).trim();
  const s = raw.toUpperCase();
  if (s === 'BS' || s === 'BOLIVAR' || s === 'BOLÍVAR' || raw === 'Bs.') return 'BS';
  if (s === 'USD' || raw === '$') return 'USD';
  if (s === 'EUR' || raw === '€') return 'EUR';
  return null;
}

type InvoiceItemRow = { productId: string; code: string; name: string; quantity: number; unitPrice: number; sortOrder: number; exentoIva: boolean };

function getCompanyId(user: { role: string; companyId: string | null }, selected: string | null): string | null {
  return user.role === 'SUPER_ADMIN' ? selected : user.companyId;
}

export default function FacturacionPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;

  const [tab, setTab] = useState<'from-budget' | 'new' | 'list'>('new');
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);

  useEffect(() => {
    if (!companyId || !user || user.role === 'SUPER_ADMIN') {
      setAllowedModules(null);
      return;
    }
    configApi.getRoleModules(companyId).then((res) => {
      const list =
        user.role === 'ADMIN' ? (res.admin?.modules ?? []) :
        user.role === 'VENDEDOR' ? (res.vendedor?.modules ?? []) :
        user.role === 'SUPERVISOR' ? (res.supervisor?.modules ?? []) : [];
      setAllowedModules(list);
    }).catch(() => setAllowedModules([]));
  }, [companyId, user?.role, user?.companyId]);

  const facturacionTabs = [
    { id: 'new' as const, label: 'Nueva factura' },
    { id: 'from-budget' as const, label: 'Desde presupuesto' },
    { id: 'list' as const, label: 'Consultar facturas' },
  ];
  const allowedTabs = allowedModules === null
    ? facturacionTabs
    : facturacionTabs.filter((t) => hasSectionAccess('FACTURACION', t.id, allowedModules));
  const canSeeTab = (sectionId: 'new' | 'from-budget' | 'list') =>
    allowedModules === null || hasSectionAccess('FACTURACION', sectionId, allowedModules);

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.some((t) => t.id === tab)) {
      setTab(allowedTabs[0].id);
    }
  }, [allowedTabs, tab]);

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
  const [invoiceFilterEstado, setInvoiceFilterEstado] = useState<'todas' | 'validas' | 'anuladas'>('validas');
  const [anularModal, setAnularModal] = useState<{ open: boolean; id: string; correlative: string } | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [savedInvoiceModal, setSavedInvoiceModal] = useState<{ invoiceId: string } | null>(null);
  const [invoicePreviewModal, setInvoicePreviewModal] = useState<{ id: string; url: string; blob: Blob; filename: string } | null>(null);
  const [invoicePreviewLoading, setInvoicePreviewLoading] = useState(false);
  const PAYMENT_KEYS = ['efectivoBs', 'tarjetaDebito', 'transferenciaPagoMovil', 'efectivoUsdEur', 'zelle'] as const;
  const [paymentBreakdownModal, setPaymentBreakdownModal] = useState<{
    totalInBs: number;
    totalInForeign: number;
    rate: number;
    foreignLabel: 'USD' | 'EUR';
    soloBolivares: boolean;
    efectivoBs: number;
    tarjetaDebito: number;
    transferenciaPagoMovil: number;
    efectivoUsdEur: number;
    zelle: number;
    transferenciaPagoMovilRef: string;
    vueltoUsdInput: string;
    vueltoBsInput: string;
  } | null>(null);

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
  const [productSearchModalOpen, setProductSearchModalOpen] = useState(false);
  const [productSearchModalQuery, setProductSearchModalQuery] = useState('');
  const [productSearchModalResults, setProductSearchModalResults] = useState<any[]>([]);
  const [productSearchModalHighlightedIndex, setProductSearchModalHighlightedIndex] = useState(0);
  const [productSearchModalLoading, setProductSearchModalLoading] = useState(false);
  const productSearchModalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productSearchModalInputRef = useRef<HTMLInputElement>(null);
  const [ivaPercent, setIvaPercent] = useState(12);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rateOfDay, setRateOfDay] = useState('');
  const [currencies, setCurrencies] = useState<string[]>(() => getInitialCurrenciesFromStorage(CURRENCIES_STORAGE_KEY));
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
  const [newProductExentoIva, setNewProductExentoIva] = useState(false);
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
    const params: Record<string, string> = { companyId, page: String(invoicePage), limit: String(invoiceLimit), estado: invoiceFilterEstado };
    if (invoiceFilterFrom) params.from = invoiceFilterFrom;
    if (invoiceFilterTo) params.to = invoiceFilterTo;
    if (invoiceFilterCode) params.code = invoiceFilterCode;
    if (invoiceFilterClient) params.client = invoiceFilterClient;
    invoicesApi.list(companyId, params).then(setInvoices).catch(() => {});
  }, [companyId, invoicePage, invoiceLimit, invoiceFilterEstado, invoiceFilterFrom, invoiceFilterTo, invoiceFilterCode, invoiceFilterClient]);

  useEffect(() => { if (tab === 'from-budget') loadBudgets(); }, [tab, loadBudgets]);
  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  useEffect(() => {
    if (!companyId || tab !== 'new') return;
    companiesApi.get(companyId).then((c: any) => setCompany(c)).catch(() => setCompany(null));
    configApi.get(companyId).then((c: any) => {
      setConfig(c);
      const defaultCurrency = getDefaultCurrencyFromConfig(c) ?? 'BS';
      const hasUsdRate = c?.usdRate != null;
      const hasEurRate = c?.eurRate != null;
      let foreign: 'USD' | 'EUR' | null = null;
      if (hasUsdRate && !hasEurRate) foreign = 'USD';
      else if (hasEurRate && !hasUsdRate) foreign = 'EUR';
      const nextCurrencies: string[] = [defaultCurrency];
      if (foreign && foreign !== defaultCurrency) nextCurrencies.push(foreign);
      if (!localStorage.getItem(CURRENCIES_STORAGE_KEY)) setCurrencies(nextCurrencies);
      if (foreign === 'USD' && c?.usdRate != null && !isNaN(Number(c.usdRate))) {
        setRateOfDay(Number(c.usdRate).toFixed(2));
      } else if (foreign === 'EUR' && c?.eurRate != null && !isNaN(Number(c.eurRate))) {
        setRateOfDay(Number(c.eurRate).toFixed(2));
      }
      setIvaPercent(c?.defaultIvaPercent != null ? Number(c.defaultIvaPercent) : 12);
    }).catch(() => setConfig(null));
  }, [companyId, tab]);

  useEffect(() => {
    try {
      localStorage.setItem(CURRENCIES_STORAGE_KEY, JSON.stringify(currencies));
    } catch {}
  }, [currencies]);

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
    setNewProductExentoIva(false);
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
        exentoIva: newProductExentoIva,
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
        { productId: created.id, code: created.code, name: created.name, quantity: 1, unitPrice, sortOrder: prev.length + 1, exentoIva: newProductExentoIva },
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

  const addProductToItems = useCallback((prod: any) => {
    const unitPrice = Number(prod.salePrice) || 0;
    const existing = items.find((i) => i.productId === prod.id);
    if (existing) {
      setItems((prev) => prev.map((i) => i.productId === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems((prev) => [...prev, { productId: prod.id, code: prod.code, name: prod.name, quantity: 1, unitPrice, sortOrder: prev.length + 1, exentoIva: prod.exentoIva ?? false }]);
    }
  }, [items]);

  const handleProductCodeKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !companyId || !productCodeInput.trim()) return;
    e.preventDefault();
    try {
      const list = await productsApi.search(companyId, productCodeInput.trim()) as any[];
      const prod = list.find((p: any) => String(p.code || '').trim() === productCodeInput.trim()) ?? null;
      if (!prod) {
        setProductNotFoundModal({ open: true, code: productCodeInput.trim() });
        return;
      }
      addProductToItems(prod);
      setProductCodeInput('');
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!productSearchModalOpen || !companyId) return;
    if (!productSearchModalQuery.trim()) {
      setProductSearchModalResults([]);
      return;
    }
    if (productSearchModalDebounceRef.current) clearTimeout(productSearchModalDebounceRef.current);
    productSearchModalDebounceRef.current = setTimeout(() => {
      setProductSearchModalLoading(true);
      productsApi.search(companyId, productSearchModalQuery.trim()).then((list) => {
        setProductSearchModalResults((list as any[]) || []);
        setProductSearchModalHighlightedIndex(0);
      }).catch(() => setProductSearchModalResults([])).finally(() => setProductSearchModalLoading(false));
    }, PRODUCT_SEARCH_DEBOUNCE_MS);
    return () => {
      if (productSearchModalDebounceRef.current) clearTimeout(productSearchModalDebounceRef.current);
    };
  }, [productSearchModalOpen, productSearchModalQuery, companyId]);

  const openProductSearchModal = () => {
    setProductSearchModalOpen(true);
    setProductSearchModalQuery('');
    setProductSearchModalResults([]);
    setProductSearchModalHighlightedIndex(0);
    setTimeout(() => productSearchModalInputRef.current?.focus(), 100);
  };

  const closeProductSearchModal = () => {
    setProductSearchModalOpen(false);
    setProductSearchModalQuery('');
    setProductSearchModalResults([]);
  };

  const selectProductFromSearch = (prod: any) => {
    addProductToItems(prod);
    closeProductSearchModal();
  };

  const handleProductSearchModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeProductSearchModal();
      return;
    }
    if (productSearchModalResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setProductSearchModalHighlightedIndex((i) => Math.min(i + 1, productSearchModalResults.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setProductSearchModalHighlightedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const prod = productSearchModalResults[productSearchModalHighlightedIndex];
        if (prod) selectProductFromSearch(prod);
        return;
      }
    }
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
      if (c === 'USD' && prev.includes('EUR')) return [...prev.filter((x) => x !== 'EUR'), c];
      if (c === 'EUR' && prev.includes('USD')) return [...prev.filter((x) => x !== 'USD'), c];
      return [...prev, c];
    });
  };
  const togglePayment = (p: string) => {
    setPaymentMethods((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const foreignCurrency = currencies.find((c) => c === 'USD' || c === 'EUR') ?? null;
  const rateLockedFromConfig =
    foreignCurrency === 'USD' ? config?.usdRate != null :
    foreignCurrency === 'EUR' ? config?.eurRate != null :
    false;

  const usdRateNum = rateOfDay && !isNaN(Number(rateOfDay)) ? Number(rateOfDay) : config?.usdRate;
  const eurRateNum = config?.eurRate;
  const onlyUsdSelected = currencies.length === 1 && currencies[0] === 'USD';
  const onlyEurSelected = currencies.length === 1 && currencies[0] === 'EUR';
  const displayCurrency: 'BS' | 'USD' | 'EUR' = onlyUsdSelected && usdRateNum ? 'USD' : onlyEurSelected && eurRateNum ? 'EUR' : (getDefaultCurrencyFromConfig(config) ?? 'USD');
  const displayRate = displayCurrency === 'USD' ? (usdRateNum || 1) : displayCurrency === 'EUR' ? (eurRateNum || 1) : 1;
  const displaySymbol = displayCurrency === 'BS' ? 'Bs.' : displayCurrency === 'USD' ? '$' : '€';

  // Moneda de la empresa; por defecto USD para que la tasa solo se use para mostrar Bs.
  const baseCurrencyFromConfig = getDefaultCurrencyFromConfig(config) ?? 'USD';

  // Cuando el usuario selecciona USD/EUR y existe tasa en Configuración,
  // sobrescribimos cualquier valor previo del campo con la tasa configurada.
  useEffect(() => {
    if (!config) return;
    if (!foreignCurrency) return;
    if (!rateLockedFromConfig) return;
    if (foreignCurrency === 'USD' && config.usdRate != null && !isNaN(Number(config.usdRate))) {
      setRateOfDay(Number(config.usdRate).toFixed(2));
    } else if (foreignCurrency === 'EUR' && config.eurRate != null && !isNaN(Number(config.eurRate))) {
      setRateOfDay(Number(config.eurRate).toFixed(2));
    }
  }, [foreignCurrency, rateLockedFromConfig, config]);

  const handleSubmitInvoice = async () => {
    if (!companyId) return;
    let clientId = selectedClientId;
    if (!clientId && canSubmitWithNewClient) {
      setErrorInvoice('');
      setSavingInvoice(true);
      try {
        const created = await clientsApi.create(companyId, clientForm) as any;
        clientId = created.id;
        setSelectedClientId(created.id);
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
      const companyBase = getDefaultCurrencyFromConfig(config) ?? 'USD';
      const invoiceHasOtherThanBase = currencies.some((c) => c !== companyBase);
      const hasRate = !!rateOfDay.trim() && !isNaN(Number(rateOfDay));
      const hasConfigRate = config?.usdRate != null || config?.eurRate != null;

      if (invoiceHasOtherThanBase && !hasRate && !hasConfigRate) {
        setErrorInvoice('Tasa del día es obligatoria cuando se selecciona una moneda distinta a la de la configuración de la empresa.');
        return;
      }
    }
    if (invVisible('paymentMethods') && invRequired('paymentMethods') && paymentMethods.length === 0) { setErrorInvoice('Forma de pago es obligatoria.'); return; }

    const invFieldConfigForBreakdown = config?.invoiceFieldsConfig ?? {};
    const invVisibleBreakdown = (key: string) => invFieldConfigForBreakdown[key]?.visible !== false;
    const foreignCur = currencies.find((c) => c === 'USD' || c === 'EUR') ?? null;
    let effRate = 1;
    if (invVisibleBreakdown('rateOfDay')) {
      if (rateOfDay.trim() && !isNaN(Number(rateOfDay))) effRate = Number(rateOfDay);
      else if (foreignCur === 'USD' && config?.usdRate != null) effRate = Number(config.usdRate);
      else if (foreignCur === 'EUR' && config?.eurRate != null) effRate = Number(config.eurRate);
    } else {
      if (config?.usdRate != null) effRate = Number(config.usdRate);
      else if (config?.eurRate != null) effRate = Number(config.eurRate);
    }
    const subSinIva = items.filter((i) => i.exentoIva).reduce((s, i) => s + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);
    const subConIva = items.filter((i) => !i.exentoIva).reduce((s, i) => s + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);
    const ivaBs = (subConIva * ivaPercent) / 100;
    const totalBs = subSinIva + subConIva + ivaBs;
    const totalForeign = effRate ? totalBs / effRate : 0;
    const foreignLbl: 'USD' | 'EUR' = foreignCur === 'EUR' ? 'EUR' : 'USD';

    if (config?.invoicePaymentBreakdown) {
      const soloBolivares = !foreignCur;
      setPaymentBreakdownModal({
        totalInBs: totalBs,
        totalInForeign: totalForeign,
        rate: effRate,
        foreignLabel: foreignLbl,
        soloBolivares,
        efectivoBs: 0,
        tarjetaDebito: 0,
        transferenciaPagoMovil: 0,
        efectivoUsdEur: 0,
        zelle: 0,
        transferenciaPagoMovilRef: '',
        vueltoUsdInput: '',
        vueltoBsInput: '',
      });
      return;
    }

    setSavingInvoice(true); setErrorInvoice('');
    try {
      const invFieldConfig = config?.invoiceFieldsConfig ?? {};
      const invVisible = (key: string) => invFieldConfig[key]?.visible !== false;

      const foreign = currencies.find((c) => c === 'USD' || c === 'EUR') ?? null;
      let effectiveRate: number | null = null;
      if (invVisible('rateOfDay')) {
        if (rateOfDay.trim() && !isNaN(Number(rateOfDay))) {
          effectiveRate = Number(rateOfDay);
        } else if (foreign === 'USD' && config?.usdRate != null) {
          effectiveRate = Number(config.usdRate);
        } else if (foreign === 'EUR' && config?.eurRate != null) {
          effectiveRate = Number(config.eurRate);
        }
      } else {
        if (config?.usdRate != null) effectiveRate = Number(config.usdRate);
        else if (config?.eurRate != null) effectiveRate = Number(config.eurRate);
        else effectiveRate = 1;
      }

      const created = await invoicesApi.create(companyId, {
        title: (invVisible('title') ? title.trim() : '') || 'Factura',
        clientId,
        date,
        ivaPercent,
        rateOfDay: effectiveRate ?? 1,
        currencies,
        observations: invVisible('observations') ? observations.trim() || undefined : undefined,
        priority: invVisible('priority') ? priority : 'NORMAL',
        paymentMethods: invVisible('paymentMethods') ? paymentMethods : [],
        deliveryTime: invVisible('deliveryTime') ? deliveryTime.trim() || undefined : undefined,
        validity: invVisible('validity') ? validity.trim() || undefined : undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, sortOrder: i.sortOrder, exentoIva: i.exentoIva })),
      }) as { id: string };
      setTitle(''); setClientRif(''); setClientSearchResult(null); setSelectedClientId(null);
      setItems([]); setRateOfDay(''); setObservations(''); setPaymentMethods([]); setDeliveryTime(''); setValidity('');
      setSavedInvoiceModal({ invoiceId: created.id });
    } catch (e) { setErrorInvoice(e instanceof Error ? e.message : 'Error'); } finally { setSavingInvoice(false); }
  };

  const performCreateInvoice = async () => {
    if (!companyId || !selectedClientId || !paymentBreakdownModal) return;
    const montoTransfPagoMovil = Number(paymentBreakdownModal.transferenciaPagoMovil) || 0;
    const refTransfPagoMovil = String(paymentBreakdownModal.transferenciaPagoMovilRef ?? '').trim();
    if (montoTransfPagoMovil > 0 && !refTransfPagoMovil) {
      setErrorInvoice('Si indica monto en Transferencia / Pago móvil, debe ingresar la referencia.');
      return;
    }
    const invFieldConfig = config?.invoiceFieldsConfig ?? {};
    const invVisible = (key: string) => invFieldConfig[key]?.visible !== false;
    const foreign = currencies.find((c) => c === 'USD' || c === 'EUR') ?? null;
    let effectiveRate = 1;
    if (invVisible('rateOfDay')) {
      if (rateOfDay.trim() && !isNaN(Number(rateOfDay))) effectiveRate = Number(rateOfDay);
      else if (foreign === 'USD' && config?.usdRate != null) effectiveRate = Number(config.usdRate);
      else if (foreign === 'EUR' && config?.eurRate != null) effectiveRate = Number(config.eurRate);
    } else {
      if (config?.usdRate != null) effectiveRate = Number(config.usdRate);
      else if (config?.eurRate != null) effectiveRate = Number(config.eurRate);
    }
    setSavingInvoice(true); setErrorInvoice('');
    try {
      const payload: Record<string, unknown> = {
        title: (invVisible('title') ? title.trim() : '') || 'Factura',
        clientId: selectedClientId,
        date,
        ivaPercent,
        rateOfDay: effectiveRate,
        currencies,
        observations: invVisible('observations') ? observations.trim() || undefined : undefined,
        priority: invVisible('priority') ? priority : 'NORMAL',
        paymentMethods: invVisible('paymentMethods') ? paymentMethods : [],
        deliveryTime: invVisible('deliveryTime') ? deliveryTime.trim() || undefined : undefined,
        validity: invVisible('validity') ? validity.trim() || undefined : undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, sortOrder: i.sortOrder, exentoIva: i.exentoIva })),
      };
      if (paymentBreakdownModal) {
        payload.paymentBreakdown = {
          efectivoBs: paymentBreakdownModal.efectivoBs || 0,
          tarjetaDebito: paymentBreakdownModal.tarjetaDebito || 0,
          transferenciaPagoMovil: paymentBreakdownModal.transferenciaPagoMovil || 0,
          transferenciaPagoMovilRef: paymentBreakdownModal.transferenciaPagoMovilRef?.trim() || null,
          efectivoUsdEur: paymentBreakdownModal.efectivoUsdEur || 0,
          zelle: paymentBreakdownModal.zelle || 0,
          vueltoUsd: parseFloat(paymentBreakdownModal.vueltoUsdInput ?? '') || 0,
          vueltoBs: parseFloat(paymentBreakdownModal.vueltoBsInput ?? '') || 0,
        };
      }
      const created = await invoicesApi.create(companyId, payload) as { id: string };
      setPaymentBreakdownModal(null);
      setTitle(''); setClientRif(''); setClientSearchResult(null); setSelectedClientId(null);
      setItems([]); setRateOfDay(''); setObservations(''); setPaymentMethods([]); setDeliveryTime(''); setValidity('');
      setSavedInvoiceModal({ invoiceId: created.id });
    } catch (e) { setErrorInvoice(e instanceof Error ? e.message : 'Error'); } finally { setSavingInvoice(false); }
  };

  const handleLoadBudgetIntoNewInvoice = async () => {
    if (!companyId || !selectedBudget?.id) return;
    setCreatingFromBudget(true);
    try {
      const fullBudget = await budgetsApi.get(selectedBudget.id, companyId) as any;
      const client = fullBudget.client;
      const budgetItems = fullBudget.items || [];
      setTitle(fullBudget.title ?? '');
      setSelectedClientId(fullBudget.clientId ?? null);
      setClientRif(client?.rifCedula ?? '');
      setClientSearchResult(client ?? null);
      setClientForm({
        name: client?.name ?? '',
        address: client?.address ?? '',
        rifCedula: client?.rifCedula ?? '',
        phone: client?.phone ?? '',
        email: client?.email ?? '',
      });
      setItems(
        budgetItems.map((it: any, idx: number) => ({
          productId: it.productId,
          code: it.product?.code ?? '',
          name: it.product?.name ?? '',
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) ?? 0,
          sortOrder: it.sortOrder ?? idx + 1,
          exentoIva: !!it.exentoIva,
        }))
      );
      setIvaPercent(Number(fullBudget.ivaPercent) ?? 12);
      setRateOfDay(String(fullBudget.rateOfDay ?? ''));
      setCurrencies(Array.isArray(fullBudget.currencies) && fullBudget.currencies.length > 0 ? fullBudget.currencies : ['BS']);
      setObservations(fullBudget.observations ?? '');
      setPriority(fullBudget.priority ?? 'NORMAL');
      setPaymentMethods(Array.isArray(fullBudget.paymentMethods) ? fullBudget.paymentMethods : []);
      setDeliveryTime(fullBudget.deliveryTime ?? '');
      setValidity(fullBudget.validity ?? '');
      setSelectedBudget(null);
      setTab('new');
    } catch (e) {
      showActionModal('Error al cargar presupuesto', e instanceof Error ? e.message : 'Error al cargar presupuesto', 'error');
    } finally {
      setCreatingFromBudget(false);
    }
  };

  const handleVisualizarInvoicePdf = async (id: string) => {
    if (!companyId) return;
    setInvoicePreviewLoading(true);
    try {
      const blob = await invoicesApi.getPdfBlob(id, companyId);
      const url = URL.createObjectURL(blob);
      setInvoicePreviewModal({ id, url, blob, filename: `factura-${id}.pdf` });
    } catch (e) {
      showActionModal('Error al cargar PDF', e instanceof Error ? e.message : 'Error al cargar PDF', 'error');
    } finally {
      setInvoicePreviewLoading(false);
    }
  };

  const closeInvoicePreviewModal = () => {
    if (invoicePreviewModal) {
      URL.revokeObjectURL(invoicePreviewModal.url);
      setInvoicePreviewModal(null);
    }
  };

  const handleInvoicePreviewDownload = () => {
    if (!invoicePreviewModal) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(invoicePreviewModal.blob);
    a.download = invoicePreviewModal.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleInvoicePreviewPrint = () => {
    if (!invoicePreviewModal) return;
    const w = window.open(invoicePreviewModal.url, '_blank', 'noopener,noreferrer');
    if (w) setTimeout(() => { w.print(); }, 500);
    else showActionModal('Impresión', 'Permite ventanas emergentes para imprimir.', 'info');
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

  const handlePrintSavedInvoice = async () => {
    if (!companyId || !savedInvoiceModal) return;
    try {
      const blob = await invoicesApi.getPdfBlob(savedInvoiceModal.invoiceId, companyId);
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (w) setTimeout(() => { w.print(); URL.revokeObjectURL(url); }, 800);
      else { URL.revokeObjectURL(url); showActionModal('Impresión', 'Permite ventanas emergentes para imprimir.', 'info'); }
    } catch (e) {
      showActionModal('Error al imprimir', e instanceof Error ? e.message : 'Error al generar PDF', 'error');
    }
  };

  const handleConfirmAnular = async () => {
    if (!companyId || !anularModal) return;
    setAnulando(true);
    try {
      await invoicesApi.anular(anularModal.id, companyId);
      setAnularModal(null);
      loadInvoices();
      showActionModal('Factura anulada', `La factura ${anularModal.correlative} ha sido anulada correctamente.`, 'success');
    } catch (e) {
      showActionModal('Error al anular', e instanceof Error ? e.message : 'No se pudo anular la factura', 'error');
    } finally {
      setAnulando(false);
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
            {allowedTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); if (t.id === 'from-budget') setSelectedBudget(null); }}
                className={`px-4 py-2 font-medium rounded-t-lg ${tab === t.id ? 'bg-[var(--card)] border border-[var(--border)] border-b-0 -mb-px text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
              >
                {t.label}
              </button>
            ))}
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
                  <p className="font-medium mb-2">Presupuesto {selectedBudget.correlative} seleccionado</p>
                  <p className="text-sm text-[var(--muted)] mb-3">Título: {selectedBudget.title} — Cliente: {selectedBudget.client?.name}. Los datos se cargarán en la factura nueva para que puedas modificarlos antes de guardar.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleLoadBudgetIntoNewInvoice} disabled={creatingFromBudget} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 disabled:opacity-50">
                      {creatingFromBudget ? 'Cargando...' : 'Pasar a factura nueva'}
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
                <div className="mt-2 text-xs text-[var(--muted)] flex flex-wrap gap-2 items-center">
                  <span>Fecha de la factura:</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-2 py-1 text-xs"
                  />
                  <span className="whitespace-nowrap">— Correlativo de factura (generado automáticamente)</span>
                </div>
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
                      <input value={clientForm.rifCedula} readOnly placeholder="RIF/Cédula *" className="rounded-lg bg-[var(--border)]/30 border border-[var(--border)] px-3 py-2 cursor-not-allowed text-[var(--muted)]" title="RIF/Cédula fijado por la búsqueda" />
                      <input value={clientForm.address} onChange={(e) => setClientForm((f) => ({ ...f, address: e.target.value }))} placeholder="Dirección" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 md:col-span-2" />
                      <input value={clientForm.phone} onChange={(e) => setClientForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Teléfono" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                      <input value={clientForm.email} onChange={(e) => setClientForm((f) => ({ ...f, email: e.target.value }))} placeholder="Correo" className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    </div>
                  </>
                )}
              </section>
              <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)] mb-3">Productos</h2>
                <div className="flex gap-2 mb-3">
                  <input
                    ref={productCodeInputRef}
                    value={productCodeInput}
                    onChange={(e) => setProductCodeInput(e.target.value)}
                    onKeyDown={handleProductCodeKeyDown}
                    placeholder="Código del producto (Enter para buscar y agregar)"
                    className="flex-1 rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={openProductSearchModal}
                    title="Buscar producto por código o nombre"
                    className="rounded-lg bg-[var(--background)] border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]"
                  >
                    <IconSearch className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-[var(--muted)]"><th className="p-2">COD</th><th className="p-2">Nombre</th><th className="p-2">Cant.</th><th className="p-2">P. unit. ({displaySymbol})</th>{currencies.includes('USD') && usdRateNum != null && <th className="p-2">P. unit. ({baseCurrencyFromConfig === 'USD' ? 'Bs.' : 'USD'})</th>}{currencies.includes('EUR') && eurRateNum != null && <th className="p-2">P. unit. ({baseCurrencyFromConfig === 'EUR' ? 'Bs.' : 'EUR'})</th>}<th className="p-2">Total ({displaySymbol})</th><th className="p-2">IVA ({displaySymbol})</th><th className="p-2"></th></tr></thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const lineTotalBase = (it.quantity ?? 0) * (it.unitPrice ?? 0);
                        const lineIvaBase = it.exentoIva ? 0 : (lineTotalBase * ivaPercent) / 100;
                        const unitDisplay = baseCurrencyFromConfig === displayCurrency ? (it.unitPrice ?? 0) : displayCurrency === 'BS' ? (it.unitPrice ?? 0) * displayRate : (it.unitPrice ?? 0) / displayRate;
                        const lineTotalDisplay = baseCurrencyFromConfig === displayCurrency ? lineTotalBase : displayCurrency === 'BS' ? lineTotalBase * displayRate : lineTotalBase / displayRate;
                        const lineIvaDisplay = baseCurrencyFromConfig === displayCurrency ? lineIvaBase : displayCurrency === 'BS' ? lineIvaBase * displayRate : lineIvaBase / displayRate;
                        const unitUsd = baseCurrencyFromConfig === 'USD' ? (it.unitPrice ?? 0) : usdRateNum ? (it.unitPrice ?? 0) / usdRateNum : 0;
                        const unitEur = baseCurrencyFromConfig === 'EUR' ? (it.unitPrice ?? 0) : eurRateNum ? (it.unitPrice ?? 0) / eurRateNum : 0;
                        const unitBsFromUsd = usdRateNum ? (it.unitPrice ?? 0) * usdRateNum : 0;
                        const unitBsFromEur = eurRateNum ? (it.unitPrice ?? 0) * eurRateNum : 0;
                        return (
                        <tr key={it.productId} className="border-t border-[var(--border)]">
                          <td className="p-2">{it.code}</td><td className="p-2">{it.name}</td>
                          <td className="p-2"><input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(it.productId, { quantity: Number(e.target.value) || 1 })} className="w-16 rounded bg-[var(--background)] border border-[var(--border)] px-2 py-1" /></td>
                          <td className="p-2 text-right tabular-nums">{unitDisplay.toFixed(2)}</td>
                          {currencies.includes('USD') && usdRateNum != null && <td className="p-2 text-right tabular-nums text-[var(--muted)]">{(baseCurrencyFromConfig === 'USD' ? unitBsFromUsd : unitUsd).toFixed(2)}</td>}
                          {currencies.includes('EUR') && eurRateNum != null && <td className="p-2 text-right tabular-nums text-[var(--muted)]">{(baseCurrencyFromConfig === 'EUR' ? unitBsFromEur : unitEur).toFixed(2)}</td>}
                          <td className="p-2 text-right tabular-nums">{lineTotalDisplay.toFixed(2)}</td>
                          <td className="p-2 text-right tabular-nums text-[var(--muted)]">{it.exentoIva ? '—' : lineIvaDisplay.toFixed(2)}</td>
                          <td className="p-2">
                            <button type="button" onClick={() => moveItem(it.productId, 'up')} disabled={idx === 0} className="mr-1 text-[var(--muted)] disabled:opacity-50">↑</button>
                            <button type="button" onClick={() => moveItem(it.productId, 'down')} disabled={idx === items.length - 1} className="mr-1 text-[var(--muted)] disabled:opacity-50">↓</button>
                            <button type="button" onClick={() => removeItem(it.productId)} className="text-[var(--destructive)]">Quitar</button>
                          </td>
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                </div>
                {items.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm space-y-1">
                    {(() => {
                      const baseCurrency = displayCurrency;
                      const baseLabel = displaySymbol;
                      const cantidadProductos = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
                      const subtotalSinIvaBase = items.filter((i) => i.exentoIva).reduce((s, i) => s + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);
                      const subtotalConIvaBase = items.filter((i) => !i.exentoIva).reduce((s, i) => s + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);
                      const ivaMontoBase = (subtotalConIvaBase * ivaPercent) / 100;
                      const totalBase = subtotalSinIvaBase + subtotalConIvaBase + ivaMontoBase;
                      const toDisplay = (x: number) =>
                        baseCurrency === baseCurrencyFromConfig ? x : baseCurrency === 'BS' ? x * displayRate : x / displayRate;
                      const subtotalSinIva = toDisplay(subtotalSinIvaBase);
                      const subtotalConIva = toDisplay(subtotalConIvaBase);
                      const ivaMonto = toDisplay(ivaMontoBase);
                      const total = toDisplay(totalBase);
                      const usdRate = usdRateNum;
                      const eurRate = eurRateNum;
                      return (
                        <>
                          <p className="text-[var(--muted)]">Cantidad de productos: <strong className="text-[var(--foreground)]">{cantidadProductos}</strong></p>
                          <p className="text-[var(--foreground)]">Subtotal (sin IVA): <strong>{subtotalSinIva.toFixed(2)}</strong> {baseLabel}</p>
                          <p className="text-[var(--foreground)]">Subtotal (con IVA): <strong>{subtotalConIva.toFixed(2)}</strong> {baseLabel}</p>
                          <p className="text-[var(--foreground)]">IVA ({ivaPercent}%): <strong>{ivaMonto.toFixed(2)}</strong> {baseLabel}</p>
                          <p className="text-[var(--foreground)] font-medium">Total: <strong>{total.toFixed(2)}</strong> {baseLabel}</p>
                          <p className="text-[var(--muted)] mt-2 font-medium">Total por moneda:</p>
                          {currencies.includes('BS') && (
                            <p className="text-[var(--foreground)]">Total en Bs.: <strong>{(baseCurrencyFromConfig === 'USD' ? totalBase * (usdRate || 1) : baseCurrencyFromConfig === 'EUR' ? totalBase * (eurRate || 1) : totalBase).toFixed(2)}</strong></p>
                          )}
                          {currencies.includes('USD') && usdRate != null && (
                            <p className="text-[var(--foreground)]">Total en USD: <strong>{(baseCurrencyFromConfig === 'USD' ? totalBase : totalBase / (usdRate || 1)).toFixed(2)}</strong> (tasa {usdRate})</p>
                          )}
                          {currencies.includes('EUR') && eurRate != null && (
                            <p className="text-[var(--foreground)]">Total en EUR: <strong>{(baseCurrencyFromConfig === 'EUR' ? totalBase : totalBase / (eurRate || 1)).toFixed(2)}</strong> (tasa {eurRate})</p>
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
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Tasa del día</label>
                    <input
                      value={rateOfDay}
                      onChange={(e) => setRateOfDay(e.target.value)}
                      placeholder="Ej: 36.5"
                      className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                      readOnly={rateLockedFromConfig}
                      disabled={rateLockedFromConfig}
                    />
                    {rateLockedFromConfig && (
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Tasa tomada de Configuración (solo lectura).
                      </p>
                    )}
                  </div>
                  )}
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">Moneda(s)</label>
                    <div className="flex gap-2 flex-wrap">
                      {CURRENCY_OPTIONS.map((c) => (
                        <label key={c} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={currencies.includes(c)}
                            onChange={() => toggleCurrency(c)}
                          />
                          <span>{c}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--muted)]">Máx. 2; no USD y EUR a la vez.</p>
                  </div>
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
              <div className="flex flex-wrap gap-4 items-center mb-3">
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-[var(--muted)]">Estado</span>
                  <select value={invoiceFilterEstado} onChange={(e) => { setInvoiceFilterEstado(e.target.value as 'todas' | 'validas' | 'anuladas'); setInvoicePage(1); }} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 text-sm">
                    <option value="validas">Válidas</option>
                    <option value="anuladas">Anuladas</option>
                    <option value="todas">Todas</option>
                  </select>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-[var(--muted)]">Mostrar</span>
                  <select value={invoiceLimit} onChange={(e) => { setInvoiceLimit(Number(e.target.value)); setInvoicePage(1); }} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-2 py-1">
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
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
                      <tr key={inv.id} className={`border-t border-[var(--border)] ${inv.anulada ? 'opacity-75' : ''}`}>
                        <td className="p-3">
                          <span>{inv.correlative}</span>
                          {inv.anulada && <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded bg-[var(--muted)] text-[var(--background)]">Anulada</span>}
                        </td>
                        <td className="p-3">{inv.title}</td>
                        <td className="p-3">{inv.client?.name ?? '—'}</td>
                        <td className="p-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => handleVisualizarInvoicePdf(inv.id)} disabled={invoicePreviewLoading} className="rounded px-2 py-1 text-sm bg-[var(--primary)] text-white disabled:opacity-50">Visualizar</button>
                          {!inv.anulada && (
                            <button type="button" onClick={() => setAnularModal({ open: true, id: inv.id, correlative: inv.correlative })} className="rounded px-2 py-1 text-sm bg-[var(--destructive)] text-white">Anular</button>
                          )}
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

      {/* Modal: vista previa PDF factura (consultar facturas) */}
      {invoicePreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[var(--foreground)] p-4 border-b border-[var(--border)]">Vista previa de la factura</h2>
            <div className="flex-1 min-h-0 p-4">
              <iframe src={invoicePreviewModal.url} title="Vista previa PDF" className="w-full h-[70vh] rounded-lg border border-[var(--border)] bg-white" />
            </div>
            <div className="p-4 border-t border-[var(--border)] flex flex-wrap gap-2 justify-end">
              <button type="button" onClick={handleInvoicePreviewPrint} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium">Imprimir</button>
              <button type="button" onClick={handleInvoicePreviewDownload} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium">Descargar</button>
              <button type="button" onClick={closeInvoicePreviewModal} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium">Cerrar</button>
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newProductExentoIva} onChange={(e) => setNewProductExentoIva(e.target.checked)} className="rounded border-[var(--border)]" />
                  <span className="text-sm text-[var(--foreground)]">Exento de IVA</span>
                </label>
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

      {productSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="product-search-modal-title">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-2">
              <h2 id="product-search-modal-title" className="font-semibold text-[var(--foreground)]">Buscar producto</h2>
              <button type="button" onClick={closeProductSearchModal} className="p-1 rounded text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]" aria-label="Cerrar">
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <input
                ref={productSearchModalInputRef}
                value={productSearchModalQuery}
                onChange={(e) => setProductSearchModalQuery(e.target.value)}
                onKeyDown={handleProductSearchModalKeyDown}
                placeholder="Código o nombre del producto"
                className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 mb-3"
              />
              {productSearchModalLoading && <p className="text-sm text-[var(--muted)] mb-2">Buscando...</p>}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4">
              {!productSearchModalQuery.trim() && (
                <p className="text-sm text-[var(--muted)]">Escribe código o nombre para buscar.</p>
              )}
              {productSearchModalQuery.trim() && productSearchModalResults.length === 0 && !productSearchModalLoading && (
                <p className="text-sm text-[var(--muted)]">Sin coincidencias.</p>
              )}
              {productSearchModalResults.length > 0 && (
                <ul className="border border-[var(--border)] rounded-lg overflow-hidden">
                  {productSearchModalResults.map((prod: any, idx: number) => (
                    <li key={prod.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); selectProductFromSearch(prod); }}
                        className={`w-full text-left px-3 py-2.5 text-sm border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--card-hover)] flex flex-wrap items-baseline gap-x-2 ${idx === productSearchModalHighlightedIndex ? 'bg-[var(--card-hover)]' : ''}`}
                      >
                        <span className="font-medium">{prod.code}</span>
                        <span className="text-[var(--muted)]">{prod.name}</span>
                        {prod.salePrice != null && <span className="text-[var(--muted)] tabular-nums">{(Number(prod.salePrice)).toFixed(2)} Bs.</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal desglose del pago */}
      {paymentBreakdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="desglose-modal-title">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-md w-full my-8 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="desglose-modal-title" className="font-semibold text-[var(--foreground)] text-lg mb-4">Desglose del pago</h2>
            <p className="text-sm text-[var(--muted)] mb-4">Total de la factura. Indique los montos por método de pago para ver el restante.</p>
            <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
              <span className="text-[var(--muted)]">Total en Bs:</span>
              <span className="font-medium text-right tabular-nums">{paymentBreakdownModal.totalInBs.toFixed(2)}</span>
              {!paymentBreakdownModal.soloBolivares && (
                <>
                  <span className="text-[var(--muted)]">Total en {paymentBreakdownModal.foreignLabel}:</span>
                  <span className="font-medium text-right tabular-nums">{paymentBreakdownModal.totalInForeign.toFixed(2)}</span>
                </>
              )}
            </div>
            <div className="space-y-3 mb-4">
              {[
                { key: 'efectivoBs' as const, label: 'Efectivo en bolívares (Bs)' },
                { key: 'tarjetaDebito' as const, label: 'Tarjeta de débito (Bs)' },
                { key: 'transferenciaPagoMovil' as const, label: 'Transferencia / Pago móvil (Bs)', withRef: true },
                ...(!paymentBreakdownModal.soloBolivares
                  ? [
                      { key: 'efectivoUsdEur' as const, label: `Efectivo en ${paymentBreakdownModal.foreignLabel}` },
                      { key: 'zelle' as const, label: 'Zelle' },
                    ]
                  : []),
              ].map(({ key, label, withRef }: { key: keyof typeof paymentBreakdownModal; label: string; withRef?: boolean }) => (
                <div key={key}>
                  <label className="block text-sm text-[var(--muted)] mb-1">{label}</label>
                  <div className="flex gap-2 flex-wrap items-center">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Monto"
                      value={typeof paymentBreakdownModal[key] === 'number' ? paymentBreakdownModal[key] : ''}
                      onChange={(e) => setPaymentBreakdownModal((p) => p ? { ...p, [key]: parseFloat(e.target.value) || 0 } : null)}
                      className="flex-1 min-w-[100px] rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
                    />
                    {withRef && (
                      <input
                        type="text"
                        placeholder="Referencia (obligatoria si hay monto)"
                        value={paymentBreakdownModal.transferenciaPagoMovilRef ?? ''}
                        onChange={(e) => setPaymentBreakdownModal((p) => p ? { ...p, transferenciaPagoMovilRef: e.target.value } : null)}
                        className="flex-1 min-w-[100px] rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {(() => {
              const sumBs = (paymentBreakdownModal.efectivoBs || 0) + (paymentBreakdownModal.tarjetaDebito || 0) + (paymentBreakdownModal.transferenciaPagoMovil || 0);
              const sumForeign = (paymentBreakdownModal.efectivoUsdEur || 0) + (paymentBreakdownModal.zelle || 0);
              const rate = paymentBreakdownModal.rate || 1;
              const vueltoDadoBs = (parseFloat(paymentBreakdownModal.vueltoUsdInput ?? '') || 0) * rate + (parseFloat(paymentBreakdownModal.vueltoBsInput ?? '') || 0);
              const vueltoDadoUsd = (parseFloat(paymentBreakdownModal.vueltoUsdInput ?? '') || 0) + (rate ? (parseFloat(paymentBreakdownModal.vueltoBsInput ?? '') || 0) / rate : 0);
              const remainingBs = paymentBreakdownModal.totalInBs - sumBs - sumForeign * rate + vueltoDadoBs;
              const remainingForeign = paymentBreakdownModal.totalInForeign - sumForeign - sumBs / rate + vueltoDadoUsd;
              return (
                <div className="p-3 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm mb-4">
                  <p className="font-medium text-[var(--foreground)]">Restante por pagar</p>
                  <p className="text-[var(--muted)] mt-1">En Bs: <span className="font-medium text-[var(--foreground)] tabular-nums">{remainingBs.toFixed(2)}</span></p>
                  {!paymentBreakdownModal.soloBolivares && (
                    <p className="text-[var(--muted)]">En {paymentBreakdownModal.foreignLabel}: <span className="font-medium text-[var(--foreground)] tabular-nums">{remainingForeign.toFixed(2)}</span></p>
                  )}
                </div>
              );
            })()}
            {(() => {
              const sumBs = (paymentBreakdownModal.efectivoBs || 0) + (paymentBreakdownModal.tarjetaDebito || 0) + (paymentBreakdownModal.transferenciaPagoMovil || 0);
              const sumForeign = (paymentBreakdownModal.efectivoUsdEur || 0) + (paymentBreakdownModal.zelle || 0);
              const rate = paymentBreakdownModal.rate || 1;
              const totalCoveredBs = sumBs + sumForeign * rate;
              const vueltoBs = totalCoveredBs - paymentBreakdownModal.totalInBs;
              const hasExceso = vueltoBs > 0.01;
              if (!hasExceso) return null;
              const vueltoUsd = rate ? vueltoBs / rate : 0;
              const inputUsd = parseFloat(paymentBreakdownModal.vueltoUsdInput ?? '') || 0;
              const inputBs = parseFloat(paymentBreakdownModal.vueltoBsInput ?? '') || 0;
              const vueltoDadoBs = inputUsd * rate + inputBs;
              const vueltoDadoUsd = inputUsd + (rate ? inputBs / rate : 0);
              const faltaPorDarBs = Math.max(0, vueltoBs - vueltoDadoBs);
              const faltaPorDarUsd = Math.max(0, vueltoUsd - vueltoDadoUsd);
              return (
                <div className="p-3 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm mb-6">
                  <p className="font-medium text-[var(--foreground)]">Vuelto a devolver</p>
                  <p className="text-[var(--muted)] mt-1">Total: <span className="font-medium text-[var(--foreground)] tabular-nums">{vueltoBs.toFixed(2)}</span> Bs{!paymentBreakdownModal.soloBolivares && <> (<span className="tabular-nums">{vueltoUsd.toFixed(2)}</span> {paymentBreakdownModal.foreignLabel})</>}</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[var(--muted)] shrink-0">{paymentBreakdownModal.foreignLabel} a dar de vuelto:</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={paymentBreakdownModal.vueltoUsdInput ?? ''}
                        onChange={(e) => setPaymentBreakdownModal((p) => p ? { ...p, vueltoUsdInput: e.target.value } : null)}
                        className="w-24 rounded-lg bg-[var(--background)] border border-[var(--border)] px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[var(--muted)] shrink-0">Bolívares a dar de vuelto:</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={paymentBreakdownModal.vueltoBsInput ?? ''}
                        onChange={(e) => setPaymentBreakdownModal((p) => p ? { ...p, vueltoBsInput: e.target.value } : null)}
                        className="w-24 rounded-lg bg-[var(--background)] border border-[var(--border)] px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-[var(--muted)] mt-2 pt-2 border-t border-[var(--border)]">Falta por dar en Bs: <span className="font-medium text-[var(--foreground)] tabular-nums">{faltaPorDarBs.toFixed(2)}</span></p>
                  {!paymentBreakdownModal.soloBolivares && (
                    <p className="text-[var(--muted)] mt-0.5">Falta por dar en {paymentBreakdownModal.foreignLabel}: <span className="font-medium text-[var(--foreground)] tabular-nums">{faltaPorDarUsd.toFixed(2)}</span></p>
                  )}
                </div>
              );
            })()}
            {errorInvoice && <p className="text-[var(--destructive)] text-sm mb-2">{errorInvoice}</p>}
            {(() => {
              const sumBs = (paymentBreakdownModal.efectivoBs || 0) + (paymentBreakdownModal.tarjetaDebito || 0) + (paymentBreakdownModal.transferenciaPagoMovil || 0);
              const sumForeign = (paymentBreakdownModal.efectivoUsdEur || 0) + (paymentBreakdownModal.zelle || 0);
              const rate = paymentBreakdownModal.rate || 1;
              const totalCoveredBs = sumBs + sumForeign * rate;
              const vueltoBs = totalCoveredBs - paymentBreakdownModal.totalInBs;
              const inputUsd = parseFloat(paymentBreakdownModal.vueltoUsdInput ?? '') || 0;
              const inputBs = parseFloat(paymentBreakdownModal.vueltoBsInput ?? '') || 0;
              const vueltoDadoBs = inputUsd * rate + inputBs;
              const exactMatch = Math.abs(totalCoveredBs - paymentBreakdownModal.totalInBs) < 0.01;
              const excessCoveredByVuelto = vueltoBs > 0.01 && vueltoDadoBs >= vueltoBs - 0.01;
              const breakdownMatchesTotal = exactMatch || excessCoveredByVuelto;
              return (
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setPaymentBreakdownModal(null); setErrorInvoice(''); }} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium">Cancelar</button>
                  <button type="button" onClick={performCreateInvoice} disabled={savingInvoice || !breakdownMatchesTotal} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50">{savingInvoice ? 'Guardando...' : 'Guardar factura'}</button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {/* Modal factura guardada */}
      {savedInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="saved-invoice-modal-title">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="saved-invoice-modal-title" className="font-semibold text-[var(--foreground)] text-lg mb-2">Factura guardada</h2>
            <p className="text-sm text-[var(--muted)] mb-6">Su factura ha sido guardada correctamente.</p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button type="button" onClick={() => { handleDownloadInvoicePdf(savedInvoiceModal.invoiceId); setSavedInvoiceModal(null); }} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium">Descargar</button>
              <button type="button" onClick={() => { handlePrintSavedInvoice(); setSavedInvoiceModal(null); }} className="rounded-lg bg-[var(--secondary)] text-white px-4 py-2 text-sm font-medium">Imprimir</button>
              <button type="button" onClick={() => setSavedInvoiceModal(null)} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium">Cerrar</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal confirmar anular factura */}
      {anularModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="anular-modal-title">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="anular-modal-title" className="font-semibold text-[var(--foreground)] text-lg mb-2">Anular factura</h2>
            <p className="text-sm text-[var(--muted)] mb-4">¿Anular la factura <strong>{anularModal.correlative}</strong>? Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAnularModal(null)} disabled={anulando} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={handleConfirmAnular} disabled={anulando} className="rounded-lg bg-[var(--destructive)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50">{anulando ? 'Anulando...' : 'Anular'}</button>
            </div>
          </div>
        </div>
      )}
      <ActionModal open={actionModal.open} onClose={closeActionModal} title={actionModal.title} message={actionModal.message} variant={actionModal.variant} />
    </div>
  );
}
