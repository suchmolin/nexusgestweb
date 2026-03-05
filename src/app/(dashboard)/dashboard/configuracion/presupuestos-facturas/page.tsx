'use client';

import { useState, useEffect, useRef } from 'react';
import { useConfigContext } from '../layout';
import { configApi, uploadImage } from '@/lib/api';
import { ActionModal, type ActionModalVariant } from '@/components/ActionModal';

const PAGE_FORMATS = ['LETTER', 'A4', 'TICKET'];
const BUDGET_FIELDS = [
  { key: 'title', label: 'Título' },
  { key: 'rateOfDay', label: 'Tasa del día' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'observations', label: 'Observaciones' },
  { key: 'deliveryTime', label: 'Tiempo de entrega' },
  { key: 'validity', label: 'Validez' },
  { key: 'paymentMethods', label: 'Forma de pago' },
];

const DEFAULT_MARGIN = 45;

export default function ConfigPresupuestosFacturasPage() {
  const { companyId } = useConfigContext();
  const [budgetFormat, setBudgetFormat] = useState('LETTER');
  const [budgetBackgroundUrl, setBudgetBackgroundUrl] = useState('');
  const [budgetMarginTop, setBudgetMarginTop] = useState(DEFAULT_MARGIN);
  const [budgetMarginLeft, setBudgetMarginLeft] = useState(DEFAULT_MARGIN);
  const [budgetMarginRight, setBudgetMarginRight] = useState(DEFAULT_MARGIN);
  const [budgetMarginBottom, setBudgetMarginBottom] = useState(DEFAULT_MARGIN);
  const [budgetFieldsConfig, setBudgetFieldsConfig] = useState<Record<string, { visible: boolean; required: boolean }>>({});
  const [invoiceFormat, setInvoiceFormat] = useState('LETTER');
  const [invoiceOnlyBolivares, setInvoiceOnlyBolivares] = useState(false);
  const [invoicePaymentBreakdown, setInvoicePaymentBreakdown] = useState(false);
  const [invoiceBackgroundUrl, setInvoiceBackgroundUrl] = useState('');
  const [invoiceMarginTop, setInvoiceMarginTop] = useState(DEFAULT_MARGIN);
  const [invoiceMarginLeft, setInvoiceMarginLeft] = useState(DEFAULT_MARGIN);
  const [invoiceMarginRight, setInvoiceMarginRight] = useState(DEFAULT_MARGIN);
  const [invoiceMarginBottom, setInvoiceMarginBottom] = useState(DEFAULT_MARGIN);
  const [invoiceFieldsConfig, setInvoiceFieldsConfig] = useState<Record<string, { visible: boolean; required: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<'budgetBg' | 'invoiceBg' | null>(null);
  const budgetBgInputRef = useRef<HTMLInputElement>(null);
  const invoiceBgInputRef = useRef<HTMLInputElement>(null);
  const [actionModal, setActionModal] = useState<{ open: boolean; title: string; message: string; variant: ActionModalVariant }>({ open: false, title: '', message: '', variant: 'info' });
  const showActionModal = (title: string, message: string, variant: ActionModalVariant = 'info') => setActionModal({ open: true, title, message, variant });
  const closeActionModal = () => setActionModal((p) => ({ ...p, open: false }));

  useEffect(() => {
    if (!companyId) return;
    configApi.get(companyId).then((c: any) => {
      setBudgetFormat(c?.budgetFormat ?? c?.invoiceFormat ?? 'LETTER');
      setBudgetBackgroundUrl(c?.budgetBackgroundImageUrl ?? '');
      setBudgetMarginTop(c?.budgetPdfMarginTop ?? c?.pdfMarginTop ?? DEFAULT_MARGIN);
      setBudgetMarginLeft(c?.budgetPdfMarginLeft ?? c?.pdfMarginLeft ?? DEFAULT_MARGIN);
      setBudgetMarginRight(c?.budgetPdfMarginRight ?? c?.pdfMarginRight ?? DEFAULT_MARGIN);
      setBudgetMarginBottom(c?.budgetPdfMarginBottom ?? c?.pdfMarginBottom ?? DEFAULT_MARGIN);
      setInvoiceFormat(c?.invoiceFormat ?? 'LETTER');
      setInvoiceOnlyBolivares(!!c?.invoiceOnlyBolivares);
      setInvoicePaymentBreakdown(!!c?.invoicePaymentBreakdown);
      setInvoiceBackgroundUrl(c?.invoiceBackgroundImageUrl ?? '');
      setInvoiceMarginTop(c?.invoicePdfMarginTop ?? c?.pdfMarginTop ?? DEFAULT_MARGIN);
      setInvoiceMarginLeft(c?.invoicePdfMarginLeft ?? c?.pdfMarginLeft ?? DEFAULT_MARGIN);
      setInvoiceMarginRight(c?.invoicePdfMarginRight ?? c?.pdfMarginRight ?? DEFAULT_MARGIN);
      setInvoiceMarginBottom(c?.invoicePdfMarginBottom ?? c?.pdfMarginBottom ?? DEFAULT_MARGIN);
      const defaultFields = Object.fromEntries(BUDGET_FIELDS.map((f) => [f.key, { visible: true, required: false }]));
      setBudgetFieldsConfig({ ...defaultFields, ...(c?.budgetFieldsConfig || {}) });
      setInvoiceFieldsConfig({ ...defaultFields, ...(c?.invoiceFieldsConfig || {}) });
    }).catch(() => {});
  }, [companyId]);

  const handleImageUpload = async (field: 'budgetBg' | 'invoiceBg', file: File) => {
    if (!companyId) return;
    setUploadingField(field);
    try {
      const { url } = await uploadImage(file);
      if (field === 'budgetBg') {
        await configApi.update(companyId, { budgetBackgroundImageUrl: url });
        setBudgetBackgroundUrl(url);
      } else {
        await configApi.update(companyId, { invoiceBackgroundImageUrl: url });
        setInvoiceBackgroundUrl(url);
      }
      showActionModal('Imagen guardada', 'La imagen se subió y guardó correctamente.', 'success');
    } catch (e) {
      showActionModal('Error al subir', e instanceof Error ? e.message : 'Error al subir la imagen', 'error');
    } finally {
      setUploadingField(null);
      if (field === 'budgetBg' && budgetBgInputRef.current) budgetBgInputRef.current.value = '';
      else if (invoiceBgInputRef.current) invoiceBgInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      await configApi.update(companyId, {
        budgetFormat: budgetFormat || null,
        budgetBackgroundImageUrl: budgetBackgroundUrl.trim() || null,
        budgetPdfMarginTop: budgetMarginTop >= 0 ? budgetMarginTop : null,
        budgetPdfMarginLeft: budgetMarginLeft >= 0 ? budgetMarginLeft : null,
        budgetPdfMarginRight: budgetMarginRight >= 0 ? budgetMarginRight : null,
        budgetPdfMarginBottom: budgetMarginBottom >= 0 ? budgetMarginBottom : null,
        budgetFieldsConfig: Object.keys(budgetFieldsConfig).length ? budgetFieldsConfig : null,
        invoiceFormat: invoiceFormat || null,
        invoiceOnlyBolivares,
        invoicePaymentBreakdown,
        invoiceBackgroundImageUrl: invoiceBackgroundUrl.trim() || null,
        invoicePdfMarginTop: invoiceMarginTop >= 0 ? invoiceMarginTop : null,
        invoicePdfMarginLeft: invoiceMarginLeft >= 0 ? invoiceMarginLeft : null,
        invoicePdfMarginRight: invoiceMarginRight >= 0 ? invoiceMarginRight : null,
        invoicePdfMarginBottom: invoiceMarginBottom >= 0 ? invoiceMarginBottom : null,
        invoiceFieldsConfig: Object.keys(invoiceFieldsConfig).length ? invoiceFieldsConfig : null,
      });
      showActionModal('Configuración guardada', 'Los cambios de presupuestos y facturas se han guardado correctamente.', 'success');
    } catch (e) {
      showActionModal('Error al guardar', e instanceof Error ? e.message : 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderMarginFields = (
    top: number, setTop: (n: number) => void,
    left: number, setLeft: (n: number) => void,
    right: number, setRight: (n: number) => void,
    bottom: number, setBottom: (n: number) => void,
    onRestore: () => void,
  ) => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Superior</label>
          <input type="number" min={0} value={top} onChange={(e) => setTop(parseInt(e.target.value, 10) || 0)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Izquierdo</label>
          <input type="number" min={0} value={left} onChange={(e) => setLeft(parseInt(e.target.value, 10) || 0)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Derecho</label>
          <input type="number" min={0} value={right} onChange={(e) => setRight(parseInt(e.target.value, 10) || 0)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Inferior</label>
          <input type="number" min={0} value={bottom} onChange={(e) => setBottom(parseInt(e.target.value, 10) || 0)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
        </div>
      </div>
      <button type="button" onClick={onRestore} className="mt-3 rounded-lg bg-[var(--card)] border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--card-hover)]">
        Restaurar valores por defecto (45 px)
      </button>
    </>
  );

  return (
    <>
      <div className="max-w-2xl space-y-6">
        <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)] mb-4">Presupuestos</h2>
          <p className="text-sm text-[var(--muted)] mb-4">Márgenes, formato de página, imagen de fondo y campos del PDF de presupuestos.</p>

          <h3 className="font-medium text-[var(--foreground)] mb-2">Márgenes del PDF (píxeles)</h3>
          <p className="text-xs text-[var(--muted)] mb-2">Separación desde el borde hasta el contenido.</p>
          {renderMarginFields(budgetMarginTop, setBudgetMarginTop, budgetMarginLeft, setBudgetMarginLeft, budgetMarginRight, setBudgetMarginRight, budgetMarginBottom, setBudgetMarginBottom, () => {
            setBudgetMarginTop(DEFAULT_MARGIN);
            setBudgetMarginLeft(DEFAULT_MARGIN);
            setBudgetMarginRight(DEFAULT_MARGIN);
            setBudgetMarginBottom(DEFAULT_MARGIN);
          })}

          <h3 className="font-medium text-[var(--foreground)] mt-6 mb-2">Formato de exportación</h3>
          <select value={budgetFormat} onChange={(e) => setBudgetFormat(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2">
            {PAGE_FORMATS.map((f) => <option key={f} value={f}>{f === 'LETTER' ? 'Carta' : f === 'A4' ? 'A4' : 'Ticket'}</option>)}
          </select>

          <h3 className="font-medium text-[var(--foreground)] mt-6 mb-2">Imagen de fondo</h3>
          <div className="flex flex-wrap items-start gap-3">
            {budgetBackgroundUrl && (
              <div className="relative">
                <img src={budgetBackgroundUrl} alt="Fondo presupuestos" className="h-16 w-auto max-w-[200px] object-contain rounded border border-[var(--border)] bg-[var(--background)]" />
                <button type="button" onClick={async () => { if (!companyId) return; try { await configApi.update(companyId, { budgetBackgroundImageUrl: null }); setBudgetBackgroundUrl(''); showActionModal('Imagen quitada', 'La imagen de fondo de presupuestos se ha eliminado.', 'success'); } catch (e) { showActionModal('Error', e instanceof Error ? e.message : 'Error', 'error'); } }} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--destructive)] text-white text-xs leading-none" title="Quitar">×</button>
              </div>
            )}
            <div>
              <input ref={budgetBgInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload('budgetBg', f); }} />
              <button type="button" onClick={() => budgetBgInputRef.current?.click()} disabled={uploadingField === 'budgetBg'} className="rounded-lg bg-[var(--secondary)] text-white px-3 py-2 text-sm disabled:opacity-50">{uploadingField === 'budgetBg' ? 'Subiendo...' : 'Subir imagen'}</button>
            </div>
          </div>

          <h3 className="font-medium text-[var(--foreground)] mt-6 mb-2">Campos del documento</h3>
          <p className="text-xs text-[var(--muted)] mb-2">Visible u obligatorio en el presupuesto.</p>
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
        </section>

        <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)] mb-4">Facturas</h2>
          <p className="text-sm text-[var(--muted)] mb-4">Márgenes, formato de página, imagen de fondo y campos del PDF de facturas.</p>

          <h3 className="font-medium text-[var(--foreground)] mb-2">Márgenes del PDF (píxeles)</h3>
          <p className="text-xs text-[var(--muted)] mb-2">Separación desde el borde hasta el contenido.</p>
          {renderMarginFields(invoiceMarginTop, setInvoiceMarginTop, invoiceMarginLeft, setInvoiceMarginLeft, invoiceMarginRight, setInvoiceMarginRight, invoiceMarginBottom, setInvoiceMarginBottom, () => {
            setInvoiceMarginTop(DEFAULT_MARGIN);
            setInvoiceMarginLeft(DEFAULT_MARGIN);
            setInvoiceMarginRight(DEFAULT_MARGIN);
            setInvoiceMarginBottom(DEFAULT_MARGIN);
          })}

          <h3 className="font-medium text-[var(--foreground)] mt-6 mb-2">Formato de exportación</h3>
          <select value={invoiceFormat} onChange={(e) => setInvoiceFormat(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2">
            {PAGE_FORMATS.map((f) => <option key={f} value={f}>{f === 'LETTER' ? 'Carta' : f === 'A4' ? 'A4' : 'Ticket'}</option>)}
          </select>

          <h3 className="font-medium text-[var(--foreground)] mt-6 mb-2">Facturación sólo en bolívares</h3>
          <p className="text-xs text-[var(--muted)] mb-2">Si está activo, el PDF de la factura mostrará únicamente montos en bolívares (usando la tasa del día si la factura tiene USD/EUR). No cambia lo que se ve en pantalla al crear o consultar facturas.</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={invoiceOnlyBolivares} onChange={(e) => setInvoiceOnlyBolivares(e.target.checked)} className="rounded border-[var(--border)]" />
            <span className="text-sm text-[var(--foreground)]">Facturación sólo en bolívares</span>
          </label>

          <h3 className="font-medium text-[var(--foreground)] mt-6 mb-2">Desglose del pago</h3>
          <p className="text-xs text-[var(--muted)] mb-2">Si está activo, al guardar una factura se abrirá un modal para indicar el desglose por método de pago (efectivo Bs, tarjeta, transferencia, etc.) y ver el monto restante en Bs y USD/EUR.</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={invoicePaymentBreakdown} onChange={(e) => setInvoicePaymentBreakdown(e.target.checked)} className="rounded border-[var(--border)]" />
            <span className="text-sm text-[var(--foreground)]">Activar desglose del pago</span>
          </label>

          <h3 className="font-medium text-[var(--foreground)] mt-6 mb-2">Imagen de fondo</h3>
          <div className="flex flex-wrap items-start gap-3">
            {invoiceBackgroundUrl && (
              <div className="relative">
                <img src={invoiceBackgroundUrl} alt="Fondo facturas" className="h-16 w-auto max-w-[200px] object-contain rounded border border-[var(--border)] bg-[var(--background)]" />
                <button type="button" onClick={async () => { if (!companyId) return; try { await configApi.update(companyId, { invoiceBackgroundImageUrl: null }); setInvoiceBackgroundUrl(''); showActionModal('Imagen quitada', 'La imagen de fondo de facturas se ha eliminado.', 'success'); } catch (e) { showActionModal('Error', e instanceof Error ? e.message : 'Error', 'error'); } }} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--destructive)] text-white text-xs leading-none" title="Quitar">×</button>
              </div>
            )}
            <div>
              <input ref={invoiceBgInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload('invoiceBg', f); }} />
              <button type="button" onClick={() => invoiceBgInputRef.current?.click()} disabled={uploadingField === 'invoiceBg'} className="rounded-lg bg-[var(--secondary)] text-white px-3 py-2 text-sm disabled:opacity-50">{uploadingField === 'invoiceBg' ? 'Subiendo...' : 'Subir imagen'}</button>
            </div>
          </div>

          <h3 className="font-medium text-[var(--foreground)] mt-6 mb-2">Campos del documento</h3>
          <p className="text-xs text-[var(--muted)] mb-2">Visible u obligatorio en la factura.</p>
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
        </section>

        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-[var(--primary)] text-white px-6 py-2 font-medium disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
      <ActionModal open={actionModal.open} onClose={closeActionModal} title={actionModal.title} message={actionModal.message} variant={actionModal.variant} />
    </>
  );
}
