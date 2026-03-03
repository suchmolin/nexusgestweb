'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { configApi, companiesApi } from '@/lib/api';
import { ActionModal, type ActionModalVariant } from '@/components/ActionModal';

const INVOICE_FORMATS = ['LETTER', 'A4', 'TICKET'];
const CURRENCY_SYMBOLS = [{ value: 'BS', label: 'Bs.' }, { value: 'USD', label: '$' }, { value: 'EUR', label: '€' }];
const BUDGET_FIELDS = [
  { key: 'title', label: 'Título' },
  { key: 'rateOfDay', label: 'Tasa del día' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'observations', label: 'Observaciones' },
  { key: 'deliveryTime', label: 'Tiempo de entrega' },
  { key: 'validity', label: 'Validez' },
  { key: 'paymentMethods', label: 'Forma de pago' },
];
const MODULE_LABELS: Record<string, string> = {
  CONFIGURACION: 'Configuración',
  CLIENTES: 'Clientes',
  PRESUPUESTOS: 'Presupuestos',
  FACTURACION: 'Facturación',
  INVENTARIO: 'Inventario',
  ADMINISTRACION: 'Administración',
  LOGS: 'Logs',
};

function getCompanyId(user: { role: string; companyId: string | null }, selected: string | null): string | null {
  return user.role === 'SUPER_ADMIN' ? selected : user.companyId;
}

export default function ConfiguracionPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;

  const [company, setCompany] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [rif, setRif] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [usdRate, setUsdRate] = useState('');
  const [eurRate, setEurRate] = useState('');
  const [defaultIvaPercent, setDefaultIvaPercent] = useState('');
  const [invoiceFormat, setInvoiceFormat] = useState('LETTER');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState('#7c3aed');
  const [alternativeColor, setAlternativeColor] = useState('#0891b2');
  const [currencySymbol, setCurrencySymbol] = useState('USD');
  const [logoUrl, setLogoUrl] = useState('');
  const [budgetBackgroundUrl, setBudgetBackgroundUrl] = useState('');
  const [invoiceBackgroundUrl, setInvoiceBackgroundUrl] = useState('');
  const [budgetFieldsConfig, setBudgetFieldsConfig] = useState<Record<string, { visible: boolean; required: boolean }>>({});
  const [invoiceFieldsConfig, setInvoiceFieldsConfig] = useState<Record<string, { visible: boolean; required: boolean }>>({});
  const [roleModules, setRoleModules] = useState<{ vendedor: { enabled: boolean; modules: string[] }; supervisor: { enabled: boolean; modules: string[] } }>({ vendedor: { enabled: false, modules: [] }, supervisor: { enabled: false, modules: [] } });
  const [savingRoles, setSavingRoles] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

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
    companiesApi.get(companyId).then((c: any) => {
      setCompany(c);
      setName(c?.name ?? '');
      setAddress(c?.address ?? '');
      setRif(c?.rif ?? '');
      setPhone(c?.phone ?? '');
      setEmail(c?.email ?? '');
    }).catch(() => setCompany(null));
    configApi.get(companyId).then((c: any) => {
      setConfig(c);
      setUsdRate(c?.usdRate != null ? String(c.usdRate) : '');
      setEurRate(c?.eurRate != null ? String(c.eurRate) : '');
      setDefaultIvaPercent(c?.defaultIvaPercent != null ? String(c.defaultIvaPercent) : '');
      setInvoiceFormat(c?.invoiceFormat ?? 'LETTER');
      setPrimaryColor(c?.primaryColor ?? '#2563eb');
      setSecondaryColor(c?.secondaryColor ?? '#7c3aed');
      setAlternativeColor(c?.alternativeColor ?? '#0891b2');
      setCurrencySymbol(c?.currencySymbol ?? 'USD');
      setLogoUrl(c?.logoUrl ?? '');
      setBudgetBackgroundUrl(c?.budgetBackgroundImageUrl ?? '');
      setInvoiceBackgroundUrl(c?.invoiceBackgroundImageUrl ?? '');
      const defaultFields = Object.fromEntries(BUDGET_FIELDS.map((f) => [f.key, { visible: true, required: false }]));
      setBudgetFieldsConfig({ ...defaultFields, ...(c?.budgetFieldsConfig || {}) });
      setInvoiceFieldsConfig({ ...defaultFields, ...(c?.invoiceFieldsConfig || {}) });
      const root = document.documentElement;
      if (c?.primaryColor) { root.style.setProperty('--primary', c.primaryColor); root.style.setProperty('--primary-hover', c.primaryColor); }
      if (c?.secondaryColor) { root.style.setProperty('--secondary', c.secondaryColor); root.style.setProperty('--secondary-hover', c.secondaryColor); }
      if (c?.alternativeColor) { root.style.setProperty('--alternative', c.alternativeColor); root.style.setProperty('--alternative-hover', c.alternativeColor); }
    }).catch(() => setConfig(null));
    configApi.getRoleModules(companyId).then((res) => setRoleModules({
      vendedor: res.vendedor ?? { enabled: false, modules: [] },
      supervisor: res.supervisor ?? { enabled: false, modules: [] },
    })).catch(() => setRoleModules({ vendedor: { enabled: false, modules: [] }, supervisor: { enabled: false, modules: [] } }));
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      await configApi.update(companyId, {
        primaryColor,
        secondaryColor,
        alternativeColor,
        currencySymbol,
        invoiceFormat,
        usdRate: usdRate ? Number(usdRate) : null,
        eurRate: eurRate ? Number(eurRate) : null,
        defaultIvaPercent: defaultIvaPercent !== '' && !isNaN(Number(defaultIvaPercent)) ? Number(defaultIvaPercent) : null,
        logoUrl: logoUrl.trim() || null,
        budgetBackgroundImageUrl: budgetBackgroundUrl.trim() || null,
        invoiceBackgroundImageUrl: invoiceBackgroundUrl.trim() || null,
        budgetFieldsConfig: Object.keys(budgetFieldsConfig).length ? budgetFieldsConfig : null,
        invoiceFieldsConfig: Object.keys(invoiceFieldsConfig).length ? invoiceFieldsConfig : null,
      });
      const root = document.documentElement;
      root.style.setProperty('--primary', primaryColor);
      root.style.setProperty('--primary-hover', primaryColor);
      root.style.setProperty('--secondary', secondaryColor);
      root.style.setProperty('--secondary-hover', secondaryColor);
      root.style.setProperty('--alternative', alternativeColor);
      root.style.setProperty('--alternative-hover', alternativeColor);
      showActionModal('Configuración guardada', 'Los cambios se han guardado correctamente.', 'success');
    } catch (e) {
      showActionModal('Error al guardar', e instanceof Error ? e.message : 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Configuración</h1>
      <p className="text-[var(--muted)] mt-1">Datos de la empresa, tasas cambiarias, colores y formato de facturación.</p>

      {user.role === 'SUPER_ADMIN' && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Empresa</label>
          <select value={selectedCompanyId ?? ''} onChange={(e) => setSelectedCompanyId(e.target.value || null)} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2">
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {!companyId && <p className="mt-4 text-[var(--muted)]">Selecciona una empresa.</p>}

      {companyId && (
        <div className="mt-6 space-y-6 max-w-2xl">
          <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Datos de la empresa</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Nombre</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">RIF</label>
                <input value={rif} onChange={(e) => setRif(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-[var(--muted)] mb-1">Dirección</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Teléfono</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Correo</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
            </div>
            <button type="button" onClick={async () => { if (!companyId) return; setSavingCompany(true); try { await companiesApi.update(companyId, { name, address, rif, phone, email }); showActionModal('Datos de empresa guardados', 'Los datos de la empresa se han actualizado correctamente.', 'success'); } catch (e) { showActionModal('Error', e instanceof Error ? e.message : 'Error', 'error'); } finally { setSavingCompany(false); } }} disabled={savingCompany} className="mt-3 rounded-lg bg-[var(--secondary)] text-white px-4 py-2 disabled:opacity-50">Guardar datos empresa</button>
          </section>

          <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Tasas cambiarias (opcional)</h2>
            <p className="text-sm text-[var(--muted)] mb-3">Si se configuran, se usan en todo el sistema y no se editan en presupuestos/facturas.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Tasa USD</label>
                <input type="number" min={0} step={0.0001} value={usdRate} onChange={(e) => setUsdRate(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Tasa EUR</label>
                <input type="number" min={0} step={0.0001} value={eurRate} onChange={(e) => setEurRate(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
            </div>
          </section>

          <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">IVA por defecto</h2>
            <p className="text-sm text-[var(--muted)] mb-3">Porcentaje de IVA que se usará por defecto en presupuestos y facturas. Siempre se puede editar en cada documento.</p>
            <div className="max-w-xs">
              <label className="block text-sm text-[var(--muted)] mb-1">IVA (%)</label>
              <input type="number" min={0} max={100} step={0.01} value={defaultIvaPercent} onChange={(e) => setDefaultIvaPercent(e.target.value)} placeholder="Ej: 12" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
            </div>
          </section>

          <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Formato de exportación de facturas</h2>
            <select value={invoiceFormat} onChange={(e) => setInvoiceFormat(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2">
              {INVOICE_FORMATS.map((f) => <option key={f} value={f}>{f === 'LETTER' ? 'Carta' : f === 'A4' ? 'A4' : 'Ticket'}</option>)}
            </select>
          </section>

          <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Colores del sistema</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Primario</label>
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-full h-10 rounded border border-[var(--border)]" />
                <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-full mt-1 rounded bg-[var(--background)] border border-[var(--border)] px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Secundario</label>
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-full h-10 rounded border border-[var(--border)]" />
                <input type="text" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-full mt-1 rounded bg-[var(--background)] border border-[var(--border)] px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Alternativo</label>
                <input type="color" value={alternativeColor} onChange={(e) => setAlternativeColor(e.target.value)} className="w-full h-10 rounded border border-[var(--border)]" />
                <input type="text" value={alternativeColor} onChange={(e) => setAlternativeColor(e.target.value)} className="w-full mt-1 rounded bg-[var(--background)] border border-[var(--border)] px-2 py-1 text-sm" />
              </div>
            </div>
          </section>

          <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Símbolo de dinero</h2>
            <select value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2">
              {CURRENCY_SYMBOLS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </section>

          <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Imágenes (URL)</h2>
            <p className="text-sm text-[var(--muted)] mb-3">Pega la URL de la imagen. Logo en el menú, fondos para PDF de presupuestos y facturas.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Logo de la empresa</label>
                <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Fondo presupuestos</label>
                <input value={budgetBackgroundUrl} onChange={(e) => setBudgetBackgroundUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Fondo facturas</label>
                <input value={invoiceBackgroundUrl} onChange={(e) => setInvoiceBackgroundUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
            </div>
          </section>

          <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Campos en presupuestos y facturas</h2>
            <p className="text-sm text-[var(--muted)] mb-3">Para cada campo puedes elegir si se <strong>muestra</strong> en el documento y si es <strong>obligatorio</strong> al guardar.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-sm mb-2">Presupuestos</h3>
                <div className="space-y-2">
                  {BUDGET_FIELDS.map((f) => (
                    <div key={f.key} className="flex flex-wrap items-center gap-3 text-sm border-b border-[var(--border)] pb-2">
                      <span className="w-32">{f.label}</span>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={budgetFieldsConfig[f.key]?.visible ?? true} onChange={(e) => setBudgetFieldsConfig((prev) => ({ ...prev, [f.key]: { ...(prev[f.key] ?? { visible: true, required: false }), visible: e.target.checked } }))} />
                        <span className="text-[var(--muted)]">Visible</span>
                      </label>
                      {budgetFieldsConfig[f.key]?.visible && (
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={budgetFieldsConfig[f.key]?.required} onChange={(e) => setBudgetFieldsConfig((prev) => ({ ...prev, [f.key]: { ...(prev[f.key] ?? { visible: true, required: false }), required: e.target.checked } }))} />
                          <span className="text-[var(--muted)]">Obligatorio</span>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-medium text-sm mb-2">Facturas</h3>
                <div className="space-y-2">
                  {BUDGET_FIELDS.map((f) => (
                    <div key={f.key} className="flex flex-wrap items-center gap-3 text-sm border-b border-[var(--border)] pb-2">
                      <span className="w-32">{f.label}</span>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={invoiceFieldsConfig[f.key]?.visible ?? true} onChange={(e) => setInvoiceFieldsConfig((prev) => ({ ...prev, [f.key]: { ...(prev[f.key] ?? { visible: true, required: false }), visible: e.target.checked } }))} />
                        <span className="text-[var(--muted)]">Visible</span>
                      </label>
                      {invoiceFieldsConfig[f.key]?.visible && (
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={invoiceFieldsConfig[f.key]?.required} onChange={(e) => setInvoiceFieldsConfig((prev) => ({ ...prev, [f.key]: { ...(prev[f.key] ?? { visible: true, required: false }), required: e.target.checked } }))} />
                          <span className="text-[var(--muted)]">Obligatorio</span>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Roles vendedor y supervisor</h2>
            <p className="text-sm text-[var(--muted)] mb-3">Activa los roles y define qué módulos puede ver cada uno.</p>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={roleModules.vendedor.enabled} onChange={(e) => setRoleModules((prev) => ({ ...prev, vendedor: { ...prev.vendedor, enabled: e.target.checked } }))} />
                  Vendedor
                </label>
                {roleModules.vendedor.enabled && (
                  <div className="mt-2 flex flex-wrap gap-2 ml-4">
                    {Object.entries(MODULE_LABELS).filter(([k]) => k !== 'GESTION_USUARIOS').map(([key, label]) => (
                      <label key={key} className="flex items-center gap-1 text-sm">
                        <input type="checkbox" checked={roleModules.vendedor.modules.includes(key)} onChange={(e) => setRoleModules((prev) => ({ ...prev, vendedor: { ...prev.vendedor, modules: e.target.checked ? [...prev.vendedor.modules, key] : prev.vendedor.modules.filter((m) => m !== key) } }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={roleModules.supervisor.enabled} onChange={(e) => setRoleModules((prev) => ({ ...prev, supervisor: { ...prev.supervisor, enabled: e.target.checked } }))} />
                  Supervisor
                </label>
                {roleModules.supervisor.enabled && (
                  <div className="mt-2 flex flex-wrap gap-2 ml-4">
                    {Object.entries(MODULE_LABELS).filter(([k]) => k !== 'GESTION_USUARIOS').map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={roleModules.supervisor.modules.includes(key)} onChange={(e) => setRoleModules((prev) => ({ ...prev, supervisor: { ...prev.supervisor, modules: e.target.checked ? [...prev.supervisor.modules, key] : prev.supervisor.modules.filter((m) => m !== key) } }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button type="button" onClick={async () => { setSavingRoles(true); try { await configApi.updateRoleModules(companyId, { vendedor: roleModules.vendedor, supervisor: roleModules.supervisor }); showActionModal('Roles guardados', 'Los roles y módulos se han actualizado correctamente.', 'success'); } catch (e) { showActionModal('Error', e instanceof Error ? e.message : 'Error', 'error'); } finally { setSavingRoles(false); } }} disabled={savingRoles} className="mt-3 rounded-lg bg-[var(--secondary)] text-white px-4 py-2 disabled:opacity-50">Guardar roles</button>
          </section>

          <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-[var(--primary)] text-white px-6 py-2 font-medium disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      )}
      <ActionModal open={actionModal.open} onClose={closeActionModal} title={actionModal.title} message={actionModal.message} variant={actionModal.variant} />
    </div>
  );
}
