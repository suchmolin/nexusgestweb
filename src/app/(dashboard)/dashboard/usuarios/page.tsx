'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, companiesApi, configApi } from '@/lib/api';

const MODULE_LABELS: Record<string, string> = {
  CONFIGURACION: 'Configuración',
  CLIENTES: 'Clientes',
  PRESUPUESTOS: 'Presupuestos',
  FACTURACION: 'Facturación',
  INVENTARIO: 'Inventario',
  ADMINISTRACION: 'Administración',
  LOGS: 'Logs',
  GESTION_USUARIOS: 'Gestión de usuarios',
};

type CompanyRow = { id: string; name: string; adminUsername?: string | null; rif?: string; email?: string };

export default function UsuariosPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'administracion' | 'crear'>('administracion');

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdminOrSuperAdmin = isSuperAdmin || user?.role === 'ADMIN';

  useEffect(() => {
    if (!isSuperAdmin && tab === 'administracion') setTab('crear');
  }, [isSuperAdmin, tab]);

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [filterUsername, setFilterUsername] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterRif, setFilterRif] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [adminModules, setAdminModules] = useState<string[]>(Object.keys(MODULE_LABELS));
  const [savingModules, setSavingModules] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newRole, setNewRole] = useState<string>('VENDEDOR');
  const [companyIdForUser, setCompanyIdForUser] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyRif, setCompanyRif] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [companiesForDropdown, setCompaniesForDropdown] = useState<{ id: string; name: string }[]>([]);

  const loadCompanies = () => {
    if (!isSuperAdmin) return;
    setLoadingCompanies(true);
    companiesApi
      .list({
        ...(filterUsername.trim() && { username: filterUsername.trim() }),
        ...(filterName.trim() && { name: filterName.trim() }),
        ...(filterRif.trim() && { rif: filterRif.trim() }),
        ...(filterEmail.trim() && { email: filterEmail.trim() }),
      })
      .then((list) => setCompanies(list as CompanyRow[]))
      .catch(() => setCompanies([]))
      .finally(() => setLoadingCompanies(false));
  };

  useEffect(() => {
    if (isSuperAdmin) loadCompanies();
  }, [isSuperAdmin, filterUsername, filterName, filterRif, filterEmail]);

  useEffect(() => {
    if (isSuperAdmin && tab === 'crear') {
      companiesApi.list().then((list) => setCompaniesForDropdown((list || []).map((c: any) => ({ id: c.id, name: c.name })))).catch(() => []);
    }
  }, [isSuperAdmin, tab]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setAdminModules(Object.keys(MODULE_LABELS));
      return;
    }
    configApi.getRoleModules(selectedCompanyId).then((res) => {
      if (res.admin?.enabled && res.admin.modules?.length) {
        setAdminModules(res.admin.modules);
      } else {
        setAdminModules(Object.keys(MODULE_LABELS));
      }
    }).catch(() => setAdminModules(Object.keys(MODULE_LABELS)));
  }, [selectedCompanyId]);

  const handleSaveRoleModules = async () => {
    if (!selectedCompanyId) return;
    setSaveMessage(null);
    setSavingModules(true);
    try {
      await configApi.updateRoleModules(selectedCompanyId, {
        admin: { enabled: true, modules: adminModules },
      });
      setSaveMessage({ type: 'ok', text: 'Módulos guardados correctamente.' });
      setSavingModules(false);
    } catch (e) {
      setSaveMessage({ type: 'error', text: e instanceof Error ? e.message : 'Error al guardar' });
      setSavingModules(false);
    }
  };

  const handleCreateUser = async () => {
    setError('');
    if (!newUsername.trim()) {
      setError('Usuario es obligatorio.');
      return;
    }
    if (!newPassword) {
      setError('Contraseña es obligatoria.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La contraseña y la confirmación no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newRole === 'ADMIN' && !isSuperAdmin) {
      setError('Solo el Super Admin puede crear usuarios Admin.');
      return;
    }
    if ((newRole === 'VENDEDOR' || newRole === 'SUPERVISOR') && isSuperAdmin && !companyIdForUser) {
      setError('Selecciona la empresa para este usuario.');
      return;
    }
    setCreating(true);
    try {
      await usersApi.createUser({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
        ...(newRole === 'ADMIN' && {
          companyName: companyName.trim() || undefined,
          companyAddress: companyAddress.trim() || undefined,
          companyRif: companyRif.trim() || undefined,
          companyPhone: companyPhone.trim() || undefined,
          companyEmail: companyEmail.trim() || undefined,
        }),
        ...((newRole === 'VENDEDOR' || newRole === 'SUPERVISOR') && isSuperAdmin && { companyId: companyIdForUser }),
      });
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
      setCompanyIdForUser('');
      setCompanyName('');
      setCompanyAddress('');
      setCompanyRif('');
      setCompanyPhone('');
      setCompanyEmail('');
      if (isSuperAdmin) loadCompanies();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear usuario');
    } finally {
      setCreating(false);
    }
  };

  if (!user) return null;
  if (!isAdminOrSuperAdmin) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Gestión de usuarios</h1>
        <p className="text-[var(--muted)] mt-2">Solo Admin y Super Admin pueden acceder a este módulo.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Gestión de usuarios</h1>
      <p className="text-[var(--muted)] mt-1">
        {isSuperAdmin
          ? 'Administración: listar empresas, filtrar y activar/desactivar módulos por empresa. Crear usuario: Admin (nueva empresa) o Vendedor/Supervisor para una empresa.'
          : 'Crear usuarios Vendedor o Supervisor para tu empresa.'}
      </p>

      <div className="flex gap-2 mt-6 border-b border-[var(--border)]">
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setTab('administracion')}
            className={`px-4 py-2 font-medium rounded-t-lg ${tab === 'administracion' ? 'bg-[var(--card)] border border-[var(--border)] border-b-0 -mb-px text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
          >
            Administración
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab('crear')}
          className={`px-4 py-2 font-medium rounded-t-lg ${tab === 'crear' ? 'bg-[var(--card)] border border-[var(--border)] border-b-0 -mb-px text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
        >
          Crear usuario
        </button>
      </div>

      {tab === 'administracion' && isSuperAdmin && (
        <div className="mt-6 space-y-4">
          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Filtrar empresas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Nombre de usuario (admin)</label>
                <input
                  value={filterUsername}
                  onChange={(e) => setFilterUsername(e.target.value)}
                  placeholder="Usuario"
                  className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Nombre empresa</label>
                <input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Empresa" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">RIF</label>
                <input value={filterRif} onChange={(e) => setFilterRif(e.target.value)} placeholder="RIF" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">Correo</label>
                <input value={filterEmail} onChange={(e) => setFilterEmail(e.target.value)} placeholder="Correo" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <p className="p-3 bg-[var(--card)] border-b border-[var(--border)] text-sm text-[var(--muted)]">Solo se listan usuarios Admin (uno por empresa). No se muestran los usuarios internos —Vendedor/Supervisor— de cada empresa.</p>
            <table className="w-full text-left">
              <thead className="bg-[var(--card)]">
                <tr>
                  <th className="p-3 font-medium">Usuario admin</th>
                  <th className="p-3 font-medium">Empresa</th>
                  <th className="p-3 font-medium">RIF</th>
                  <th className="p-3 font-medium">Correo</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => { setSelectedCompanyId(selectedCompanyId === c.id ? null : c.id); setSaveMessage(null); }}
                    className={`border-t border-[var(--border)] cursor-pointer hover:bg-[var(--card-hover)] ${selectedCompanyId === c.id ? 'bg-[var(--primary)]/10' : ''}`}
                  >
                    <td className="p-3">{(c as any).adminUsername ?? '—'}</td>
                    <td className="p-3">{c.name}</td>
                    <td className="p-3">{c.rif ?? '—'}</td>
                    <td className="p-3">{c.email ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loadingCompanies && <p className="p-4 text-center text-[var(--muted)]">Cargando...</p>}
            {!loadingCompanies && companies.length === 0 && <p className="p-6 text-center text-[var(--muted)]">No hay usuarios admin o no coinciden los filtros.</p>}
          </div>

          {selectedCompanyId && (() => {
            const selected = companies.find((c) => c.id === selectedCompanyId);
            const adminUsername = (selected as any)?.adminUsername ?? '—';
            const companyName = selected?.name ?? '—';
            return (
            <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
              <h3 className="font-semibold text-[var(--foreground)] mb-3">Módulos visibles para {adminUsername} — {companyName}</h3>
              <p className="text-sm text-[var(--muted)] mb-4">Marca o desmarca los módulos que podrá ver este usuario. Por defecto todos están visibles.</p>
              <div className="flex flex-wrap gap-4">
                {Object.entries(MODULE_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminModules.includes(key)}
                      onChange={(e) =>
                        setAdminModules((prev) =>
                          e.target.checked ? [...prev, key] : prev.filter((m) => m !== key)
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              {saveMessage && (
                <p className={`mt-3 text-sm ${saveMessage.type === 'ok' ? 'text-green-600' : 'text-[var(--destructive)]'}`}>
                  {saveMessage.text}
                </p>
              )}
              <button type="button" onClick={handleSaveRoleModules} disabled={savingModules} className="mt-4 rounded-lg bg-[var(--primary)] text-white px-4 py-2 font-medium disabled:opacity-50">
                {savingModules ? 'Guardando...' : 'Guardar módulos'}
              </button>
            </div>
            );
          })()}
        </div>
      )}

      {tab === 'crear' && (
        <div className="mt-6 p-5 rounded-xl bg-[var(--card)] border border-[var(--border)] max-w-xl">
          <h2 className="font-semibold text-[var(--foreground)] mb-3">Crear usuario</h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            {isSuperAdmin ? 'Puedes crear un Admin (nueva empresa) o un Vendedor/Supervisor asignado a una empresa. Cada empresa tiene un solo Admin.' : 'Crea un Vendedor o Supervisor para tu empresa.'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Usuario (login) *</label>
              <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Nombre de usuario" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Rol *</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2">
                {isSuperAdmin && <option value="ADMIN">Admin (nueva empresa)</option>}
                <option value="VENDEDOR">Vendedor</option>
                <option value="SUPERVISOR">Supervisor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Contraseña *</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mín. 6 caracteres" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Confirmar contraseña *</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repetir contraseña" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
            </div>

            {(newRole === 'VENDEDOR' || newRole === 'SUPERVISOR') && isSuperAdmin && (
              <div className="md:col-span-2">
                <label className="block text-sm text-[var(--muted)] mb-1">Empresa *</label>
                <select value={companyIdForUser} onChange={(e) => setCompanyIdForUser(e.target.value)} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2">
                  <option value="">Seleccionar empresa</option>
                  {companiesForDropdown.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {newRole === 'ADMIN' && isSuperAdmin && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-sm text-[var(--muted)] mb-1">Nombre de la empresa (opcional)</label>
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Si no se indica, se usará &quot;Empresa de [usuario]&quot;" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">RIF</label>
                  <input value={companyRif} onChange={(e) => setCompanyRif(e.target.value)} placeholder="RIF" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Teléfono</label>
                  <input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="Teléfono" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-[var(--muted)] mb-1">Dirección</label>
                  <input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="Dirección" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-[var(--muted)] mb-1">Correo</label>
                  <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="Correo" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                </div>
              </>
            )}
          </div>
          {error && <p className="mt-2 text-sm text-[var(--destructive)]">{error}</p>}
          <button type="button" onClick={handleCreateUser} disabled={creating} className="mt-4 rounded-lg bg-[var(--primary)] text-white px-4 py-2 font-medium disabled:opacity-50">
            {creating ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      )}
    </div>
  );
}
