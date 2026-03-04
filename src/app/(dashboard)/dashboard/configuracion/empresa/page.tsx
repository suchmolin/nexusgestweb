'use client';

import { useState, useEffect, useRef } from 'react';
import { useConfigContext } from '../layout';
import { configApi, companiesApi, uploadImage } from '@/lib/api';
import { ActionModal, type ActionModalVariant } from '@/components/ActionModal';

const MODULE_LABELS: Record<string, string> = {
  CONFIGURACION: 'Configuración',
  CLIENTES: 'Clientes',
  PRESUPUESTOS: 'Presupuestos',
  FACTURACION: 'Facturación',
  INVENTARIO: 'Inventario',
  ADMINISTRACION: 'Administración',
  LOGS: 'Logs',
};

export default function ConfigEmpresaPage() {
  const { companyId } = useConfigContext();
  const [company, setCompany] = useState<any>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [rif, setRif] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState('#7c3aed');
  const [alternativeColor, setAlternativeColor] = useState('#0891b2');
  const [roleModules, setRoleModules] = useState<{ vendedor: { enabled: boolean; modules: string[] }; supervisor: { enabled: boolean; modules: string[] } }>({ vendedor: { enabled: false, modules: [] }, supervisor: { enabled: false, modules: [] } });
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [actionModal, setActionModal] = useState<{ open: boolean; title: string; message: string; variant: ActionModalVariant }>({ open: false, title: '', message: '', variant: 'info' });
  const showActionModal = (title: string, message: string, variant: ActionModalVariant = 'info') => setActionModal({ open: true, title, message, variant });
  const closeActionModal = () => setActionModal((p) => ({ ...p, open: false }));

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
      setLogoUrl(c?.logoUrl ?? '');
      setPrimaryColor(c?.primaryColor ?? '#2563eb');
      setSecondaryColor(c?.secondaryColor ?? '#7c3aed');
      setAlternativeColor(c?.alternativeColor ?? '#0891b2');
      const root = document.documentElement;
      if (c?.primaryColor) { root.style.setProperty('--primary', c.primaryColor); root.style.setProperty('--primary-hover', c.primaryColor); }
      if (c?.secondaryColor) { root.style.setProperty('--secondary', c.secondaryColor); root.style.setProperty('--secondary-hover', c.secondaryColor); }
      if (c?.alternativeColor) { root.style.setProperty('--alternative', c.alternativeColor); root.style.setProperty('--alternative-hover', c.alternativeColor); }
    }).catch(() => {});
    configApi.getRoleModules(companyId).then((res) => setRoleModules({
      vendedor: res.vendedor ?? { enabled: false, modules: [] },
      supervisor: res.supervisor ?? { enabled: false, modules: [] },
    })).catch(() => setRoleModules({ vendedor: { enabled: false, modules: [] }, supervisor: { enabled: false, modules: [] } }));
  }, [companyId]);

  const handleSaveColors = async () => {
    if (!companyId) return;
    try {
      await configApi.update(companyId, { primaryColor, secondaryColor, alternativeColor });
      const root = document.documentElement;
      root.style.setProperty('--primary', primaryColor);
      root.style.setProperty('--primary-hover', primaryColor);
      root.style.setProperty('--secondary', secondaryColor);
      root.style.setProperty('--secondary-hover', secondaryColor);
      root.style.setProperty('--alternative', alternativeColor);
      root.style.setProperty('--alternative-hover', alternativeColor);
      showActionModal('Colores guardados', 'Los colores del sistema se han actualizado.', 'success');
    } catch (e) {
      showActionModal('Error', e instanceof Error ? e.message : 'Error al guardar', 'error');
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!companyId) return;
    setUploadingLogo(true);
    try {
      const { url } = await uploadImage(file);
      await configApi.update(companyId, { logoUrl: url });
      setLogoUrl(url);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('config-updated'));
      showActionModal('Logo guardado', 'El logo se subió y guardó correctamente. Se mostrará en la barra del sistema.', 'success');
    } catch (e) {
      showActionModal('Error al subir', e instanceof Error ? e.message : 'Error al subir el logo', 'error');
    } finally {
      setUploadingLogo(false);
      logoInputRef.current && (logoInputRef.current.value = '');
    }
  };

  return (
    <>
      <div className="max-w-2xl space-y-6">
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
          <h2 className="font-semibold text-[var(--foreground)] mb-3">Logo del sistema</h2>
          <p className="text-sm text-[var(--muted)] mb-3">Se muestra arriba a la izquierda en la barra lateral en lugar de &quot;NexusGest&quot;.</p>
          <div className="flex flex-wrap items-start gap-3">
            {logoUrl && (
              <div className="relative">
                <img src={logoUrl} alt="Logo" className="h-16 w-auto max-w-[200px] object-contain rounded border border-[var(--border)] bg-[var(--background)]" />
                <button type="button" onClick={async () => { if (!companyId) return; await configApi.update(companyId, { logoUrl: null }); setLogoUrl(''); if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('config-updated')); showActionModal('Logo quitado', 'El logo se ha eliminado.', 'success'); }} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--destructive)] text-white text-xs leading-none" title="Quitar">×</button>
              </div>
            )}
            <div>
              <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
              <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="rounded-lg bg-[var(--secondary)] text-white px-3 py-2 text-sm disabled:opacity-50">{uploadingLogo ? 'Subiendo...' : 'Subir imagen'}</button>
            </div>
          </div>
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
          <button type="button" onClick={handleSaveColors} className="mt-3 rounded-lg bg-[var(--secondary)] text-white px-4 py-2">Guardar colores</button>
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
          <button type="button" onClick={async () => { setSavingRoles(true); try { await configApi.updateRoleModules(companyId!, { vendedor: roleModules.vendedor, supervisor: roleModules.supervisor }); showActionModal('Roles guardados', 'Los roles y módulos se han actualizado correctamente.', 'success'); } catch (e) { showActionModal('Error', e instanceof Error ? e.message : 'Error', 'error'); } finally { setSavingRoles(false); } }} disabled={savingRoles} className="mt-3 rounded-lg bg-[var(--secondary)] text-white px-4 py-2 disabled:opacity-50">Guardar roles</button>
        </section>
      </div>
      <ActionModal open={actionModal.open} onClose={closeActionModal} title={actionModal.title} message={actionModal.message} variant={actionModal.variant} />
    </>
  );
}
