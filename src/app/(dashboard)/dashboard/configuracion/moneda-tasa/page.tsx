'use client';

import { useState, useEffect } from 'react';
import { useConfigContext } from '../layout';
import { configApi } from '@/lib/api';
import { ActionModal, type ActionModalVariant } from '@/components/ActionModal';

const CURRENCY_SYMBOLS = [{ value: 'BS', label: 'Bs.' }, { value: 'USD', label: '$' }, { value: 'EUR', label: '€' }];

export default function ConfigMonedaTasaPage() {
  const { companyId } = useConfigContext();
  const [usdRate, setUsdRate] = useState('');
  const [eurRate, setEurRate] = useState('');
  const [defaultIvaPercent, setDefaultIvaPercent] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [actionModal, setActionModal] = useState<{ open: boolean; title: string; message: string; variant: ActionModalVariant }>({ open: false, title: '', message: '', variant: 'info' });
  const showActionModal = (title: string, message: string, variant: ActionModalVariant = 'info') => setActionModal({ open: true, title, message, variant });
  const closeActionModal = () => setActionModal((p) => ({ ...p, open: false }));

  useEffect(() => {
    if (!companyId) return;
    configApi.get(companyId).then((c: any) => {
      setUsdRate(c?.usdRate != null && !isNaN(Number(c.usdRate)) ? Number(c.usdRate).toFixed(2) : '');
      setEurRate(c?.eurRate != null && !isNaN(Number(c.eurRate)) ? Number(c.eurRate).toFixed(2) : '');
      setDefaultIvaPercent(c?.defaultIvaPercent != null ? String(c.defaultIvaPercent) : '');
      setCurrencySymbol(c?.currencySymbol ?? 'USD');
    }).catch(() => {});
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      await configApi.update(companyId, {
        usdRate: usdRate ? Number(usdRate) : null,
        eurRate: eurRate ? Number(eurRate) : null,
        defaultIvaPercent: defaultIvaPercent !== '' && !isNaN(Number(defaultIvaPercent)) ? Number(defaultIvaPercent) : null,
        currencySymbol,
      });
      showActionModal('Configuración guardada', 'Las tasas, IVA y símbolo de dinero se han guardado correctamente.', 'success');
    } catch (e) {
      showActionModal('Error al guardar', e instanceof Error ? e.message : 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="max-w-2xl space-y-6">
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
          <h2 className="font-semibold text-[var(--foreground)] mb-3">Símbolo de dinero</h2>
          <select value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2">
            {CURRENCY_SYMBOLS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </section>

        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-[var(--primary)] text-white px-6 py-2 font-medium disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
      <ActionModal open={actionModal.open} onClose={closeActionModal} title={actionModal.title} message={actionModal.message} variant={actionModal.variant} />
    </>
  );
}
