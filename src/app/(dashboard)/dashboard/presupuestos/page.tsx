'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { budgetsApi, clientsApi, productsApi, companiesApi, configApi, inventoryApi } from '@/lib/api';
import { ActionModal, type ActionModalVariant } from '@/components/ActionModal';
import { IconSearch, IconX, IconEye, IconPencil, IconCopy, IconTrash } from '@/components/Icons';
import { hasSectionAccess } from '@/lib/role-modules';

const PAYMENT_OPTIONS = ['EFECTIVO', 'PAGO_MOVIL', 'TRANSFERENCIA', 'BINANCE', 'ZELLE'];
const CURRENCY_OPTIONS = ['USD', 'EUR', 'BS'];
const PRODUCT_SEARCH_DEBOUNCE_MS = 280;
const CURRENCIES_STORAGE_KEY = 'nexusgest_presupuesto_currencies';

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

function getCompanyId(user: { role: string; companyId: string | null }, selected: string | null): string | null {
  return user.role === 'SUPER_ADMIN' ? selected : user.companyId;
}

type BudgetItemRow = { productId: string; code: string; name: string; description?: string; stock?: number; quantity: number; unitPrice: number; sortOrder: number; exentoIva: boolean };

export default function PresupuestosPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;

  const [tab, setTab] = useState<'new' | 'list'>('new');
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

  const presupuestosTabs = [
    { id: 'new' as const, label: 'Nuevo presupuesto' },
    { id: 'list' as const, label: 'Consultar presupuestos' },
  ];
  const allowedTabs = allowedModules === null
    ? presupuestosTabs
    : presupuestosTabs.filter((t) => hasSectionAccess('PRESUPUESTOS', t.id, allowedModules));

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.some((t) => t.id === tab)) {
      setTab(allowedTabs[0].id);
    }
  }, [allowedTabs, tab]);

  const [company, setCompany] = useState<{ name: string; address?: string; rif?: string; phone?: string; email?: string } | null>(null);
  const [config, setConfig] = useState<{ usdRate?: number; eurRate?: number; currencySymbol?: string; budgetFieldsConfig?: Record<string, { visible: boolean; required: boolean }> } | null>(null);

  const [title, setTitle] = useState('');
  const [clientRif, setClientRif] = useState('');
  const [clientSearchResult, setClientSearchResult] = useState<{ id: string; name: string; address?: string; rifCedula: string; phone?: string; email?: string } | null | 'loading' | 'not-found'>(null);
  const [clientForm, setClientForm] = useState<{ name: string; address: string; rifCedula: string; phone: string; email: string }>({ name: '', address: '', rifCedula: '', phone: '', email: '' });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [productCodeInput, setProductCodeInput] = useState('');
  const [items, setItems] = useState<BudgetItemRow[]>([]);
  const [productSearchModalOpen, setProductSearchModalOpen] = useState(false);
  const [productSearchModalQuery, setProductSearchModalQuery] = useState('');
  const [productSearchModalResults, setProductSearchModalResults] = useState<any[]>([]);
  const [productSearchModalHighlightedIndex, setProductSearchModalHighlightedIndex] = useState(0);
  const [productSearchModalLoading, setProductSearchModalLoading] = useState(false);
  const productSearchModalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productSearchModalInputRef = useRef<HTMLInputElement>(null);
  const [ivaPercent, setIvaPercent] = useState(12);
  const [rateOfDay, setRateOfDay] = useState('');
  const [currencies, setCurrencies] = useState<string[]>(() => getInitialCurrenciesFromStorage(CURRENCIES_STORAGE_KEY));
  const [observations, setObservations] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [deliveryTime, setDeliveryTime] = useState('');
  const [validity, setValidity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [productNotFoundModal, setProductNotFoundModal] = useState<{ open: boolean; code: string }>({ open: false, code: '' });
  const [registerProductModal, setRegisterProductModal] = useState(false);
  const cancelProductNotFoundRef = useRef<HTMLButtonElement>(null);
  const productCodeInputRef = useRef<HTMLInputElement>(null);
  const [newProductForm, setNewProductForm] = useState({ code: '', name: '', description: '' });
  const [newProductExentoIva, setNewProductExentoIva] = useState(false);
  const [newIngresoForm, setNewIngresoForm] = useState({ quantity: '', unitCost: '', salePrice: '', observation: '' });
  const [registerProductSaving, setRegisterProductSaving] = useState(false);
  const [registerProductError, setRegisterProductError] = useState('');

  const [list, setList] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterCode, setFilterCode] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [editModal, setEditModal] = useState<{ id: string; budget: any | null } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; correlative: string } | null>(null);
  const [duplicateModal, setDuplicateModal] = useState<{ id: string; correlative: string } | null>(null);
  const [previewModal, setPreviewModal] = useState<{ id: string; url: string; blob: Blob; filename: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [actionModal, setActionModal] = useState<{ open: boolean; title: string; message: string; variant: ActionModalVariant }>({ open: false, title: '', message: '', variant: 'info' });
  const showActionModal = (title: string, message: string, variant: ActionModalVariant = 'info') => setActionModal({ open: true, title, message, variant });
  const closeActionModal = () => setActionModal((p) => ({ ...p, open: false }));

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
  }, [companyId]);

  useEffect(() => {
    try {
      localStorage.setItem(CURRENCIES_STORAGE_KEY, JSON.stringify(currencies));
    } catch {}
  }, [currencies]);

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
        {
          productId: created.id,
          code: created.code,
          name: created.name,
          description: created.description,
          stock: qty,
          quantity: 1,
          unitPrice,
          sortOrder: prev.length + 1,
          exentoIva: newProductExentoIva,
        },
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
      const found = await clientsApi.search(companyId, clientRif.trim());
      setClientSearchResult(found ? (found as any) : 'not-found');
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

  const isClientNotFound = clientSearchResult === 'not-found';
  const canSubmitWithNewClient = isClientNotFound && clientForm.name.trim() && clientForm.rifCedula.trim();
  const hasValidClient = !!selectedClientId || canSubmitWithNewClient;

  const addProductToItems = useCallback((prod: any) => {
    const unitPrice = Number(prod.salePrice) || 0;
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
          unitPrice,
          sortOrder: prev.length + 1,
          exentoIva: prod.exentoIva ?? false,
        },
      ]);
    }
  }, [items]);

  const handleProductCodeKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !companyId || !productCodeInput.trim()) return;
    e.preventDefault();
    try {
      const list = await productsApi.search(companyId, productCodeInput.trim());
      const prod = (list as any[]).find((p: any) => String(p.code || '').trim() === productCodeInput.trim()) ?? null;
      if (!prod) {
        setProductNotFoundModal({ open: true, code: productCodeInput.trim() });
        return;
      }
      addProductToItems(prod);
      setProductCodeInput('');
    } catch {
      // ignore
    }
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
      // No permitir USD y EUR a la vez
      if (c === 'USD' && prev.includes('EUR')) return [...prev.filter((x) => x !== 'EUR'), c];
      if (c === 'EUR' && prev.includes('USD')) return [...prev.filter((x) => x !== 'USD'), c];
      return [...prev, c];
    });
  };

  const togglePayment = (p: string) => {
    setPaymentMethods((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const fieldConfig = config?.budgetFieldsConfig ?? {};
  const isFieldVisible = (key: string) => fieldConfig[key]?.visible !== false;
  const isFieldRequired = (key: string) => fieldConfig[key]?.required === true;

  const foreignCurrency = currencies.find((c) => c === 'USD' || c === 'EUR') ?? null;
  const rateLockedFromConfig =
    foreignCurrency === 'USD' ? config?.usdRate != null :
    foreignCurrency === 'EUR' ? config?.eurRate != null :
    false;

  const usdRateNum = rateOfDay && !isNaN(Number(rateOfDay)) ? Number(rateOfDay) : config?.usdRate;
  const eurRateNum = config?.eurRate;
  const onlyUsdSelected = currencies.length === 1 && currencies[0] === 'USD';
  const onlyEurSelected = currencies.length === 1 && currencies[0] === 'EUR';
  const displayCurrency: 'BS' | 'USD' | 'EUR' = onlyUsdSelected && usdRateNum ? 'USD' : onlyEurSelected && eurRateNum ? 'EUR' : (getDefaultCurrencyFromConfig(config) ?? 'BS');
  const displayRate = displayCurrency === 'USD' ? (usdRateNum || 1) : displayCurrency === 'EUR' ? (eurRateNum || 1) : 1;
  const displaySymbol = displayCurrency === 'BS' ? 'Bs.' : displayCurrency === 'USD' ? '$' : '€';

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

  const handleSubmitBudget = async () => {
    if (!companyId) return;
    let clientId = selectedClientId;
    if (!clientId && canSubmitWithNewClient) {
      setError('');
      setSaving(true);
      try {
        const created = await clientsApi.create(companyId, {
          name: clientForm.name.trim(),
          address: clientForm.address?.trim() || undefined,
          rifCedula: clientForm.rifCedula.trim(),
          phone: clientForm.phone?.trim() || undefined,
          email: clientForm.email?.trim() || undefined,
        }) as any;
        clientId = created.id;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al crear cliente');
        setSaving(false);
        return;
      }
    }
    if (!clientId) {
      setError('Cliente es obligatorio. Busca por RIF/Cédula o completa los datos si no está registrado.');
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
    if (isFieldVisible('rateOfDay')) {
      const foreign = currencies.find((c) => c === 'USD' || c === 'EUR') ?? null;
      const hasForeign = !!foreign;
      const hasRate = !!rateOfDay.trim() && !isNaN(Number(rateOfDay));
      const hasConfigRate =
        foreign === 'USD' ? config?.usdRate != null :
        foreign === 'EUR' ? config?.eurRate != null :
        false;

      if (hasRate && !hasForeign) {
        setError('Debes seleccionar USD o EUR cuando defines una tasa del día.');
        return;
      }
      if (hasForeign && !(hasRate || hasConfigRate)) {
        setError('Tasa del día es obligatoria cuando se selecciona USD o EUR.');
        return;
      }
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
      const foreign = currencies.find((c) => c === 'USD' || c === 'EUR') ?? null;
      let effectiveRate: number | null = null;
      if (isFieldVisible('rateOfDay')) {
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

      await budgetsApi.create(companyId, {
        title: (isFieldVisible('title') ? title.trim() : '') || 'Presupuesto',
        clientId,
        date: new Date().toISOString().slice(0, 10),
        ivaPercent,
        rateOfDay: effectiveRate ?? 1,
        currencies,
        observations: isFieldVisible('observations') ? observations.trim() || undefined : undefined,
        priority: isFieldVisible('priority') ? priority : 'NORMAL',
        paymentMethods: isFieldVisible('paymentMethods') ? paymentMethods : [],
        deliveryTime: isFieldVisible('deliveryTime') ? deliveryTime.trim() || undefined : undefined,
        validity: isFieldVisible('validity') ? validity.trim() || undefined : undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, sortOrder: i.sortOrder, exentoIva: i.exentoIva })),
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

  const handleVisualizarPdf = async (id: string) => {
    if (!companyId) return;
    setPreviewLoading(true);
    try {
      const blob = await budgetsApi.getPdfBlob(id, companyId);
      const url = URL.createObjectURL(blob);
      setPreviewModal({ id, url, blob, filename: `presupuesto-${id}.pdf` });
    } catch (e) {
      showActionModal('Error al cargar PDF', e instanceof Error ? e.message : 'Error al cargar PDF', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreviewModal = () => {
    if (previewModal) {
      URL.revokeObjectURL(previewModal.url);
      setPreviewModal(null);
    }
  };

  const handlePreviewDownload = () => {
    if (!previewModal) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(previewModal.blob);
    a.download = previewModal.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handlePreviewPrint = () => {
    if (!previewModal) return;
    const w = window.open(previewModal.url, '_blank', 'noopener,noreferrer');
    if (w) setTimeout(() => { w.print(); }, 500);
    else showActionModal('Impresión', 'Permite ventanas emergentes para imprimir.', 'info');
  };

  const handleDelete = async (id: string) => {
    if (!companyId) return;
    try {
      await budgetsApi.delete(id, companyId);
      setDeleteModal(null);
      loadList();
    } catch (e) {
      showActionModal('Error al eliminar', e instanceof Error ? e.message : 'Error al eliminar', 'error');
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  const handleDuplicate = async (id: string) => {
    if (!companyId) return;
    try {
      await budgetsApi.duplicate(id, companyId);
      setDuplicateModal(null);
      loadList();
    } catch (e) {
      setDuplicateModal(null);
      showActionModal('Error al duplicar', e instanceof Error ? e.message : 'Error al duplicar presupuesto', 'error');
    }
  };

  const handleOpenEdit = async (b: any) => {
    if (!companyId) return;
    setEditModal({ id: b.id, budget: null });
    setSaving(false);
    setError('');
    try {
      const fullBudget = await budgetsApi.get(b.id, companyId) as any;
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
        })),
      );
      setIvaPercent(Number(fullBudget.ivaPercent) ?? 12);
      setRateOfDay(
        fullBudget.rateOfDay != null && !Number.isNaN(Number(fullBudget.rateOfDay))
          ? Number(fullBudget.rateOfDay).toFixed(2)
          : '',
      );
      setCurrencies(Array.isArray(fullBudget.currencies) && fullBudget.currencies.length > 0 ? fullBudget.currencies : ['BS']);
      setObservations(fullBudget.observations ?? '');
      setPriority(fullBudget.priority ?? 'NORMAL');
      setPaymentMethods(Array.isArray(fullBudget.paymentMethods) ? fullBudget.paymentMethods : []);
      setDeliveryTime(fullBudget.deliveryTime ?? '');
      setValidity(fullBudget.validity ?? '');
      setEditModal({ id: b.id, budget: fullBudget });
    } catch (e) {
      setEditModal(null);
      showActionModal('Error al cargar presupuesto', e instanceof Error ? e.message : 'Error al cargar presupuesto', 'error');
    }
  };

  const handleUpdateBudget = async () => {
    if (!companyId || !editModal) return;
    let clientId = selectedClientId;
    if (!clientId && canSubmitWithNewClient) {
      setError('');
      setSaving(true);
      try {
        const created = await clientsApi.create(companyId, {
          name: clientForm.name.trim(),
          address: clientForm.address?.trim() || undefined,
          rifCedula: clientForm.rifCedula.trim(),
          phone: clientForm.phone?.trim() || undefined,
          email: clientForm.email?.trim() || undefined,
        }) as any;
        clientId = created.id;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al crear cliente');
        setSaving(false);
        return;
      }
    }
    if (!clientId) {
      setError('Cliente es obligatorio. Busca por RIF/Cédula o completa los datos si no está registrado.');
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
    if (isFieldVisible('rateOfDay')) {
      const foreign = currencies.find((c) => c === 'USD' || c === 'EUR') ?? null;
      const hasForeign = !!foreign;
      const hasRate = !!rateOfDay.trim() && !isNaN(Number(rateOfDay));
      const hasConfigRate =
        foreign === 'USD' ? config?.usdRate != null :
        foreign === 'EUR' ? config?.eurRate != null :
        false;

      if (hasRate && !hasForeign) {
        setError('Debes seleccionar USD o EUR cuando defines una tasa del día.');
        return;
      }
      if (hasForeign && !(hasRate || hasConfigRate)) {
        setError('Tasa del día es obligatoria cuando se selecciona USD o EUR.');
        return;
      }
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
      const foreign = currencies.find((c) => c === 'USD' || c === 'EUR') ?? null;
      let effectiveRate: number | null = null;
      if (isFieldVisible('rateOfDay')) {
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

      await budgetsApi.update(editModal.id, companyId, {
        title: (isFieldVisible('title') ? title.trim() : editModal.budget?.title) || 'Presupuesto',
        clientId,
        ivaPercent,
        rateOfDay: effectiveRate ?? editModal.budget?.rateOfDay ?? 1,
        currencies,
        observations: isFieldVisible('observations') ? observations.trim() || undefined : editModal.budget?.observations,
        priority: isFieldVisible('priority') ? priority : (editModal.budget?.priority ?? 'NORMAL'),
        paymentMethods: isFieldVisible('paymentMethods') ? paymentMethods : (editModal.budget?.paymentMethods ?? []),
        deliveryTime: isFieldVisible('deliveryTime') ? deliveryTime.trim() || undefined : editModal.budget?.deliveryTime,
        validity: isFieldVisible('validity') ? validity.trim() || undefined : editModal.budget?.validity,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          sortOrder: i.sortOrder,
          exentoIva: i.exentoIva,
        })),
      });
      setEditModal(null);
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

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
            {allowedTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 font-medium rounded-t-lg ${tab === t.id ? 'bg-[var(--card)] border border-[var(--border)] border-b-0 -mb-px text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
              >
                {t.label}
              </button>
            ))}
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
                {clientSearchResult && clientSearchResult !== 'loading' && clientSearchResult !== 'not-found' && (
                  <div className="mt-3 p-3 rounded-lg bg-[var(--background)]">
                    <p className="font-medium">{clientSearchResult.name}</p>
                    <p className="text-sm text-[var(--muted)]">RIF/Cédula: {clientSearchResult.rifCedula}</p>
                  </div>
                )}
                {clientSearchResult === 'not-found' && (
                  <>
                    <p className="mt-2 text-sm text-[var(--muted)]">No existe un cliente con ese RIF/Cédula. Completa los datos; se guardará al guardar el presupuesto.</p>
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
                    <thead>
                      <tr className="text-left text-[var(--muted)]">
                        <th className="p-2">COD</th>
                        <th className="p-2">Nombre</th>
                        <th className="p-2">Cant.</th>
                        <th className="p-2">P. unit. ({displaySymbol})</th>
                        {currencies.includes('USD') && usdRateNum != null && <th className="p-2">P. unit. (USD)</th>}
                        {currencies.includes('EUR') && eurRateNum != null && <th className="p-2">P. unit. (EUR)</th>}
                        <th className="p-2">Total ({displaySymbol})</th>
                        <th className="p-2">IVA ({displaySymbol})</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const lineTotalBs = (it.quantity ?? 0) * (it.unitPrice ?? 0);
                        const lineIvaBs = it.exentoIva ? 0 : (lineTotalBs * ivaPercent) / 100;
                        const unitDisplay = displayCurrency === 'BS' ? (it.unitPrice ?? 0) : (it.unitPrice ?? 0) / displayRate;
                        const lineTotalDisplay = displayCurrency === 'BS' ? lineTotalBs : lineTotalBs / displayRate;
                        const lineIvaDisplay = displayCurrency === 'BS' ? lineIvaBs : lineIvaBs / displayRate;
                        const unitUsd = usdRateNum ? (it.unitPrice ?? 0) / usdRateNum : 0;
                        const unitEur = eurRateNum ? (it.unitPrice ?? 0) / eurRateNum : 0;
                        return (
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
                          <td className="p-2 text-right tabular-nums">{unitDisplay.toFixed(2)}</td>
                          {currencies.includes('USD') && usdRateNum != null && <td className="p-2 text-right tabular-nums text-[var(--muted)]">{unitUsd.toFixed(2)}</td>}
                          {currencies.includes('EUR') && eurRateNum != null && <td className="p-2 text-right tabular-nums text-[var(--muted)]">{unitEur.toFixed(2)}</td>}
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
                      const defaultCurrency = getDefaultCurrencyFromConfig(config) ?? 'BS';
                      const usdRate = rateOfDay && !isNaN(Number(rateOfDay)) ? Number(rateOfDay) : config?.usdRate;
                      const eurRate = config?.eurRate;
                      const onlyUsd = currencies.length === 1 && currencies[0] === 'USD';
                      const onlyEur = currencies.length === 1 && currencies[0] === 'EUR';
                      const displayInUsd = onlyUsd && usdRate;
                      const displayInEur = onlyEur && eurRate;
                      const baseCurrency: 'USD' | 'EUR' | 'BS' = displayInUsd ? 'USD' : displayInEur ? 'EUR' : defaultCurrency;
                      const baseLabel = baseCurrency === 'BS' ? 'Bs.' : baseCurrency === 'USD' ? '$' : '€';
                      const displayRate = displayInUsd ? usdRate : displayInEur ? eurRate : 1;

                      const cantidadProductos = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
                      const subtotalSinIvaBs = items.filter((i) => i.exentoIva).reduce((s, i) => s + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);
                      const subtotalConIvaBs = items.filter((i) => !i.exentoIva).reduce((s, i) => s + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);
                      const ivaMontoBs = (subtotalConIvaBs * ivaPercent) / 100;
                      const totalBs = subtotalSinIvaBs + subtotalConIvaBs + ivaMontoBs;
                      const toDisplay = (x: number) => (baseCurrency === 'BS' ? x : x / (displayRate || 1));
                      const subtotalSinIva = toDisplay(subtotalSinIvaBs);
                      const subtotalConIva = toDisplay(subtotalConIvaBs);
                      const ivaMonto = toDisplay(ivaMontoBs);
                      const total = toDisplay(totalBs);
                      return (
                        <>
                          <p className="text-[var(--muted)]">Cantidad de productos: <strong className="text-[var(--foreground)]">{cantidadProductos}</strong></p>
                          <p className="text-[var(--foreground)]">Subtotal (sin IVA): <strong>{subtotalSinIva.toFixed(2)}</strong> {baseLabel}</p>
                          <p className="text-[var(--foreground)]">Subtotal (con IVA): <strong>{subtotalConIva.toFixed(2)}</strong> {baseLabel}</p>
                          <p className="text-[var(--foreground)]">IVA ({ivaPercent}%): <strong>{ivaMonto.toFixed(2)}</strong> {baseLabel}</p>
                          <p className="text-[var(--foreground)] font-medium">Total: <strong>{total.toFixed(2)}</strong> {baseLabel}</p>
                          <p className="text-[var(--muted)] mt-2 font-medium">Total por moneda:</p>
                          {currencies.includes('BS') && (
                            <p className="text-[var(--foreground)]">Total en Bs.: <strong>{totalBs.toFixed(2)}</strong></p>
                          )}
                          {currencies.includes('USD') && usdRate != null && (
                            <p className="text-[var(--foreground)]">Total en USD: <strong>{(totalBs / (usdRate || 1)).toFixed(2)}</strong> (tasa {usdRate})</p>
                          )}
                          {currencies.includes('EUR') && eurRate != null && (
                            <p className="text-[var(--foreground)]">Total en EUR: <strong>{(totalBs / (eurRate || 1)).toFixed(2)}</strong> (tasa {eurRate})</p>
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
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">IVA (%)</label>
                    <input type="number" min={0} step={0.01} value={ivaPercent} onChange={(e) => setIvaPercent(Number(e.target.value))} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                  </div>
                  {isFieldVisible('rateOfDay') && (
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
              <button type="button" onClick={handleSubmitBudget} disabled={saving || !hasValidClient || items.length === 0} className="rounded-lg bg-[var(--primary)] text-white px-6 py-2 font-medium disabled:opacity-50">
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
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleVisualizarPdf(b.id)}
                              disabled={previewLoading}
                              title="Visualizar"
                              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white w-8 h-8 transition-colors disabled:opacity-50"
                            >
                              <IconEye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(b)}
                              title="Editar"
                              className="inline-flex items-center justify-center rounded-full bg-[var(--card-hover)] text-[var(--foreground)] hover:bg-[var(--primary)] hover:text-white w-8 h-8 transition-colors"
                            >
                              <IconPencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDuplicateModal({ id: b.id, correlative: b.correlative })}
                              title="Duplicar"
                              className="inline-flex items-center justify-center rounded-full bg-[var(--alternative)]/10 text-[var(--alternative)] hover:bg-[var(--alternative)] hover:text-white w-8 h-8 transition-colors"
                            >
                              <IconCopy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteModal({ id: b.id, correlative: b.correlative })}
                              title="Eliminar"
                              className="inline-flex items-center justify-center rounded-full bg-[var(--destructive)]/10 text-[var(--destructive)] hover:bg-[var(--destructive)] hover:text-white w-8 h-8 transition-colors"
                            >
                              <IconTrash className="w-4 h-4" />
                            </button>
                          </div>
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
          {previewModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" role="dialog" aria-modal="true">
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-semibold text-[var(--foreground)] p-4 border-b border-[var(--border)]">Vista previa del presupuesto</h2>
                <div className="flex-1 min-h-0 p-4">
                  <iframe src={previewModal.url} title="Vista previa PDF" className="w-full h-[70vh] rounded-lg border border-[var(--border)] bg-white" />
                </div>
                <div className="p-4 border-t border-[var(--border)] flex flex-wrap gap-2 justify-end">
                  <button type="button" onClick={handlePreviewPrint} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium">Imprimir</button>
                  <button type="button" onClick={handlePreviewDownload} className="rounded-lg bg-[var(--card-hover)] text-[var(--foreground)] px-4 py-2 text-sm font-medium">Descargar</button>
                  <button type="button" onClick={closePreviewModal} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium">Cerrar</button>
                </div>
              </div>
            </div>
          )}
          {editModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditModal(null)}>
              <div className="bg-[var(--card)] rounded-xl p-6 max-w-4xl w-full border border-[var(--border)] max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-extrabold text-red-600 text-center mb-1">
                  Presupuesto {editModal.budget?.correlative ?? ''}
                </h2>
                <p className="text-sm text-[var(--muted)] mb-4 text-center">Edición rápida del presupuesto seleccionado.</p>

                <div className="space-y-4">
                  {isFieldVisible('title') && (
                    <section className="p-4 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                      <h3 className="font-semibold text-[var(--foreground)] mb-2">Título</h3>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Título"
                        className="w-full rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2"
                      />
                    </section>
                  )}

                  <section className="p-4 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                    <h3 className="font-semibold text-[var(--foreground)] mb-2">Cliente</h3>
                    {clientSearchResult && clientSearchResult !== 'loading' && clientSearchResult !== 'not-found' ? (
                      <div className="text-sm">
                        <p className="font-medium">{clientSearchResult.name}</p>
                        <p className="text-[var(--muted)]">RIF/Cédula: {clientSearchResult.rifCedula}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--muted)]">Cliente asociado al presupuesto.</p>
                    )}
                  </section>

                  <section className="p-4 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                    <h3 className="font-semibold text-[var(--foreground)] mb-2">Productos</h3>
                    <div className="flex gap-2 mb-3">
                      <input
                        ref={productCodeInputRef}
                        value={productCodeInput}
                        onChange={(e) => setProductCodeInput(e.target.value)}
                        onKeyDown={handleProductCodeKeyDown}
                        placeholder="Código del producto (Enter para buscar y agregar)"
                        className="flex-1 rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2"
                      />
                      <button
                        type="button"
                        onClick={openProductSearchModal}
                        title="Buscar producto por código o nombre"
                        className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]"
                      >
                        <IconSearch className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[var(--muted)]">
                            <th className="p-2">COD</th>
                            <th className="p-2">Nombre</th>
                            <th className="p-2">Cant.</th>
                            <th className="p-2">P. unit. ({displaySymbol})</th>
                            {currencies.includes('USD') && usdRateNum != null && <th className="p-2">P. unit. (USD)</th>}
                            {currencies.includes('EUR') && eurRateNum != null && <th className="p-2">P. unit. (EUR)</th>}
                            <th className="p-2">Total ({displaySymbol})</th>
                            <th className="p-2">IVA ({displaySymbol})</th>
                            <th className="p-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, idx) => {
                            const lineTotalBs = (it.quantity ?? 0) * (it.unitPrice ?? 0);
                            const lineIvaBs = it.exentoIva ? 0 : (lineTotalBs * ivaPercent) / 100;
                            const unitDisplay = displayCurrency === 'BS' ? (it.unitPrice ?? 0) : (it.unitPrice ?? 0) / displayRate;
                            const lineTotalDisplay = displayCurrency === 'BS' ? lineTotalBs : lineTotalBs / displayRate;
                            const lineIvaDisplay = displayCurrency === 'BS' ? lineIvaBs : lineIvaBs / displayRate;
                            const unitUsd = usdRateNum ? (it.unitPrice ?? 0) / usdRateNum : 0;
                            const unitEur = eurRateNum ? (it.unitPrice ?? 0) / eurRateNum : 0;
                            return (
                              <tr key={it.productId} className="border-t border-[var(--border)]">
                                <td className="p-2">{it.code}</td>
                                <td className="p-2">{it.name}</td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min={1}
                                    value={it.quantity}
                                    onChange={(e) => updateItem(it.productId, { quantity: Number(e.target.value) || 1 })}
                                    className="w-16 rounded bg-[var(--card)] border border-[var(--border)] px-2 py-1"
                                  />
                                </td>
                                <td className="p-2 text-right tabular-nums">{unitDisplay.toFixed(2)}</td>
                                {currencies.includes('USD') && usdRateNum != null && <td className="p-2 text-right tabular-nums text-[var(--muted)]">{unitUsd.toFixed(2)}</td>}
                                {currencies.includes('EUR') && eurRateNum != null && <td className="p-2 text-right tabular-nums text-[var(--muted)]">{unitEur.toFixed(2)}</td>}
                                <td className="p-2 text-right tabular-nums">{lineTotalDisplay.toFixed(2)}</td>
                                <td className="p-2 text-right tabular-nums text-[var(--muted)]">{it.exentoIva ? '—' : lineIvaDisplay.toFixed(2)}</td>
                                <td className="p-2">
                                  <button type="button" onClick={() => moveItem(it.productId, 'up')} disabled={idx === 0} className="mr-1 text-[var(--muted)] disabled:opacity-50">↑</button>
                                  <button type="button" onClick={() => moveItem(it.productId, 'down')} disabled={idx === items.length - 1} className="mr-1 text-[var(--muted)] disabled:opacity-50">↓</button>
                                  <button type="button" onClick={() => removeItem(it.productId)} className="text-[var(--destructive)]">Quitar</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {items.length > 0 && (
                    <section className="p-4 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm space-y-1">
                      {(() => {
                        const defaultCurrency = getDefaultCurrencyFromConfig(config) ?? 'BS';
                        const usdRate = rateOfDay && !isNaN(Number(rateOfDay)) ? Number(rateOfDay) : config?.usdRate;
                        const eurRate = config?.eurRate;
                        const onlyUsd = currencies.length === 1 && currencies[0] === 'USD';
                        const onlyEur = currencies.length === 1 && currencies[0] === 'EUR';
                        const displayInUsd = onlyUsd && usdRate;
                        const displayInEur = onlyEur && eurRate;
                        const baseCurrency: 'USD' | 'EUR' | 'BS' = displayInUsd ? 'USD' : displayInEur ? 'EUR' : defaultCurrency;
                        const baseLabel = baseCurrency === 'BS' ? 'Bs.' : baseCurrency === 'USD' ? '$' : '€';
                        const displayRateSummary = displayInUsd ? usdRate : displayInEur ? eurRate : 1;

                        const cantidadProductos = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
                        const subtotalSinIvaBs = items.filter((i) => i.exentoIva).reduce((s, i) => s + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);
                        const subtotalConIvaBs = items.filter((i) => !i.exentoIva).reduce((s, i) => s + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);
                        const ivaMontoBs = (subtotalConIvaBs * ivaPercent) / 100;
                        const totalBs = subtotalSinIvaBs + subtotalConIvaBs + ivaMontoBs;
                        const toDisplay = (x: number) => (baseCurrency === 'BS' ? x : x / (displayRateSummary || 1));
                        const subtotalSinIva = toDisplay(subtotalSinIvaBs);
                        const subtotalConIva = toDisplay(subtotalConIvaBs);
                        const ivaMonto = toDisplay(ivaMontoBs);
                        const total = toDisplay(totalBs);
                        return (
                          <>
                            <p className="text-[var(--muted)]">Cantidad de productos: <strong className="text-[var(--foreground)]">{cantidadProductos}</strong></p>
                            <p className="text-[var(--foreground)]">Subtotal (sin IVA): <strong>{subtotalSinIva.toFixed(2)}</strong> {baseLabel}</p>
                            <p className="text-[var(--foreground)]">Subtotal (con IVA): <strong>{subtotalConIva.toFixed(2)}</strong> {baseLabel}</p>
                            <p className="text-[var(--foreground)]">IVA ({ivaPercent}%): <strong>{ivaMonto.toFixed(2)}</strong> {baseLabel}</p>
                            <p className="text-[var(--foreground)] font-medium">Total: <strong>{total.toFixed(2)}</strong> {baseLabel}</p>
                          </>
                        );
                      })()}
                    </section>
                  )}

                  <section className="p-4 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                    <h3 className="font-semibold text-[var(--foreground)] mb-2">Configuración</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-[var(--muted)] mb-1">IVA (%)</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={ivaPercent}
                          onChange={(e) => setIvaPercent(Number(e.target.value))}
                          className="w-full rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2"
                        />
                      </div>
                      {isFieldVisible('rateOfDay') && (
                        <div>
                          <label className="block text-sm text-[var(--muted)] mb-1">Tasa del día</label>
                          <input
                            value={rateOfDay}
                            onChange={(e) => setRateOfDay(e.target.value)}
                            placeholder="Ej: 36.5"
                            className="w-full rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2"
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
                      </div>
                      {isFieldVisible('priority') && (
                        <div>
                          <label className="block text-sm text-[var(--muted)] mb-1">Prioridad</label>
                          <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value as 'NORMAL' | 'URGENT')}
                            className="w-full rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2"
                          >
                            <option value="NORMAL">Normal</option>
                            <option value="URGENT">Urgente</option>
                          </select>
                        </div>
                      )}
                      {isFieldVisible('paymentMethods') && (
                        <div>
                          <label className="block text-sm text-[var(--muted)] mb-1">Forma(s) de pago</label>
                          <div className="flex flex-wrap gap-2">
                            {PAYMENT_OPTIONS.map((p) => (
                              <label key={p} className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={paymentMethods.includes(p)}
                                  onChange={() => togglePayment(p)}
                                />
                                <span>{p}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {isFieldVisible('deliveryTime') && (
                        <div>
                          <label className="block text-sm text-[var(--muted)] mb-1">Tiempo de entrega</label>
                          <input
                            value={deliveryTime}
                            onChange={(e) => setDeliveryTime(e.target.value)}
                            placeholder="Ej: 3 días hábiles"
                            className="w-full rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2"
                          />
                        </div>
                      )}
                      {isFieldVisible('validity') && (
                        <div>
                          <label className="block text-sm text-[var(--muted)] mb-1">Validez</label>
                          <input
                            value={validity}
                            onChange={(e) => setValidity(e.target.value)}
                            placeholder="Ej: Válido por 15 días"
                            className="w-full rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2"
                          />
                        </div>
                      )}
                    </div>
                  </section>

                  {isFieldVisible('observations') && (
                    <section className="p-4 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                      <h3 className="font-semibold text-[var(--foreground)] mb-2">Observaciones</h3>
                      <textarea
                        value={observations}
                        onChange={(e) => setObservations(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2"
                        placeholder="Condiciones, notas adicionales, etc."
                      />
                    </section>
                  )}
                </div>

                {error && <p className="mt-4 text-sm text-[var(--destructive)]">{error}</p>}

                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={() => setEditModal(null)} className="rounded-lg bg-[var(--card-hover)] px-4 py-2">
                    Cancelar
                  </button>
                  <button type="button" onClick={handleUpdateBudget} disabled={saving} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {duplicateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDuplicateModal(null)}>
              <div className="bg-[var(--card)] rounded-xl p-6 max-w-lg w-full border border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
                <p className="font-medium">Duplicar presupuesto {duplicateModal.correlative}</p>
                <p className="text-sm text-[var(--muted)] mt-1">
                  Se creará un nuevo presupuesto con la misma información y el título con sufijo "(DUPLICADO)".
                </p>
                <div className="flex gap-2 mt-4 justify-end">
                  <button type="button" onClick={() => setDuplicateModal(null)} className="rounded-lg bg-[var(--card-hover)] px-4 py-2">
                    Cancelar
                  </button>
                  <button type="button" onClick={() => handleDuplicate(duplicateModal.id)} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2">
                    Duplicar
                  </button>
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
              <button type="button" onClick={handleRegisterProductSubmit} disabled={registerProductSaving} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 font-medium disabled:opacity-50">{registerProductSaving ? 'Guardando...' : 'Guardar y agregar al presupuesto'}</button>
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

      <ActionModal open={actionModal.open} onClose={closeActionModal} title={actionModal.title} message={actionModal.message} variant={actionModal.variant} />
    </div>
  );
}
