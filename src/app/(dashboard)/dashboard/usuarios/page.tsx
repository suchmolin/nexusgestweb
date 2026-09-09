'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, companiesApi, configApi } from '@/lib/api';
import { SUPERADMIN_COMPANY_STORAGE_KEY } from '@/lib/constants';
import { MODULE_LABELS, hasModuleAccess } from '@/lib/role-modules';

type CompanyRow = { id: string; name: string; adminUsername?: string | null; rif?: string; email?: string };
type CompanyUser = {
  id: string;
  username: string;
  role: string;
  enabled: boolean;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  VENDEDOR: 'Vendedor',
  SUPERVISOR: 'Supervisor',
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function UsuariosPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'usuarios' | 'administracion' | 'crear'>('usuarios');

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdminOrSuperAdmin = isSuperAdmin || user?.role === 'ADMIN';

  useEffect(() => {
    if (!isSuperAdmin && tab === 'administracion') setTab('usuarios');
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

  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersCompanyId, setUsersCompanyId] = useState('');
  const [usersMessage, setUsersMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CompanyUser | null>(null);

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
  const [createdUserModal, setCreatedUserModal] = useState<string | null>(null);

  const listCompanyId = isSuperAdmin ? usersCompanyId : user?.companyId || '';

  const loadCompanyUsers = useCallback(() => {
    if (!isAdminOrSuperAdmin) return;
    if (isSuperAdmin && !usersCompanyId) {
      setCompanyUsers([]);
      return;
    }
    setLoadingUsers(true);
    setUsersMessage(null);
    usersApi
      .listByCompany(isSuperAdmin ? usersCompanyId : undefined)
      .then((list) => setCompanyUsers(list || []))
      .catch((e) => {
        setCompanyUsers([]);
        setUsersMessage({ type: 'error', text: e instanceof Error ? e.message : 'Error al cargar usuarios' });
      })
      .finally(() => setLoadingUsers(false));
  }, [isAdminOrSuperAdmin, isSuperAdmin, usersCompanyId]);

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
    if (isSuperAdmin && companies.length > 0) {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(SUPERADMIN_COMPANY_STORAGE_KEY) : null;
      if (stored && companies.some((c) => c.id === stored)) {
        setSelectedCompanyId(stored);
        setUsersCompanyId((prev) => prev || stored);
      }
    }
  }, [isSuperAdmin, companies]);

  useEffect(() => {
    if (isSuperAdmin && (tab === 'crear' || tab === 'usuarios')) {
      companiesApi.list().then((list) => setCompaniesForDropdown((list || []).map((c: any) => ({ id: c.id, name: c.name })))).catch(() => []);
    }
  }, [isSuperAdmin, tab]);

  useEffect(() => {
    if (tab === 'usuarios') loadCompanyUsers();
  }, [tab, loadCompanyUsers]);

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

  const canManageActions = (row: CompanyUser) => {
    if (row.id === user?.sub) return false;
    if (row.role === 'ADMIN') return isSuperAdmin;
    return row.role === 'VENDEDOR' || row.role === 'SUPERVISOR';
  };

  const canDelete = (row: CompanyUser) => {
    if (row.id === user?.sub) return false;
    return row.role === 'VENDEDOR' || row.role === 'SUPERVISOR';
  };

  const handleToggleEnabled = async (row: CompanyUser) => {
    if (!canManageActions(row)) return;
    setActionUserId(row.id);
    setUsersMessage(null);
    try {
      const updated = await usersApi.setEnabled(row.id, !row.enabled);
      setCompanyUsers((prev) => prev.map((u) => (u.id === row.id ? { ...u, enabled: updated.enabled } : u)));
      setUsersMessage({
        type: 'ok',
        text: updated.enabled
          ? `Usuario ${row.username} desbloqueado.`
          : `Usuario ${row.username} bloqueado.`,
      });
    } catch (e) {
      setUsersMessage({ type: 'error', text: e instanceof Error ? e.message : 'Error al actualizar usuario' });
    } finally {
      setActionUserId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const row = confirmDelete;
    setActionUserId(row.id);
    setUsersMessage(null);
    try {
      await usersApi.deleteUser(row.id);
      setCompanyUsers((prev) => prev.filter((u) => u.id !== row.id));
      setUsersMessage({ type: 'ok', text: `Usuario ${row.username} eliminado.` });
      setConfirmDelete(null);
    } catch (e) {
      setUsersMessage({ type: 'error', text: e instanceof Error ? e.message : 'Error al eliminar usuario' });
    } finally {
      setActionUserId(null);
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
    const usernameToCreate = newUsername.trim();
    try {
      await usersApi.createUser({
        username: usernameToCreate,
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
      if (tab === 'usuarios' || !isSuperAdmin) loadCompanyUsers();
      setCreatedUserModal(usernameToCreate);
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
          ? 'Listar y gestionar usuarios por empresa, administrar módulos y crear usuarios Admin, Vendedor o Supervisor.'
          : 'Listar, bloquear o eliminar usuarios de tu empresa, y crear Vendedores o Supervisores.'}
      </p>

      <div className="flex gap-2 mt-6 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setTab('usuarios')}
          className={`px-4 py-2 font-medium rounded-t-lg ${tab === 'usuarios' ? 'bg-[var(--card)] border border-[var(--border)] border-b-0 -mb-px text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
        >
          Usuarios
        </button>
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

      {tab === 'usuarios' && (
        <div className="mt-6 space-y-4">
          {isSuperAdmin && (
            <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] max-w-md">
              <label className="block text-sm text-[var(--muted)] mb-1">Empresa</label>
              <select
                value={usersCompanyId}
                onChange={(e) => setUsersCompanyId(e.target.value)}
                className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
              >
                <option value="">Seleccionar empresa</option>
                {companiesForDropdown.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {usersMessage && (
            <p className={`text-sm ${usersMessage.type === 'ok' ? 'text-green-600' : 'text-[var(--destructive)]'}`}>
              {usersMessage.text}
            </p>
          )}

          {!listCompanyId && isSuperAdmin ? (
            <p className="text-[var(--muted)]">Selecciona una empresa para ver sus usuarios.</p>
          ) : (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[var(--card)]">
                  <tr>
                    <th className="p-3 font-medium">Usuario</th>
                    <th className="p-3 font-medium">Rol</th>
                    <th className="p-3 font-medium">Estado</th>
                    <th className="p-3 font-medium">Creado</th>
                    <th className="p-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {companyUsers.map((row) => {
                    const managing = actionUserId === row.id;
                    const showManage = canManageActions(row);
                    const showDelete = canDelete(row);
                    return (
                      <tr key={row.id} className="border-t border-[var(--border)]">
                        <td className="p-3">
                          {row.username}
                          {row.id === user.sub && (
                            <span className="ml-2 text-xs text-[var(--muted)]">(tú)</span>
                          )}
                        </td>
                        <td className="p-3">{ROLE_LABELS[row.role] ?? row.role}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              row.enabled
                                ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                                : 'bg-red-500/15 text-red-700 dark:text-red-400'
                            }`}
                          >
                            {row.enabled ? 'Activo' : 'Bloqueado'}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-[var(--muted)]">{formatDate(row.createdAt)}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            {showManage && (
                              <button
                                type="button"
                                disabled={managing}
                                onClick={() => handleToggleEnabled(row)}
                                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--card-hover)] disabled:opacity-50"
                              >
                                {managing ? '...' : row.enabled ? 'Bloquear' : 'Desbloquear'}
                              </button>
                            )}
                            {showDelete && (
                              <button
                                type="button"
                                disabled={managing}
                                onClick={() => setConfirmDelete(row)}
                                className="rounded-lg border border-[var(--destructive)]/40 text-[var(--destructive)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--destructive)]/10 disabled:opacity-50"
                              >
                                Eliminar
                              </button>
                            )}
                            {!showManage && !showDelete && (
                              <span className="text-sm text-[var(--muted)]">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {loadingUsers && <p className="p-4 text-center text-[var(--muted)]">Cargando...</p>}
              {!loadingUsers && companyUsers.length === 0 && (
                <p className="p-6 text-center text-[var(--muted)]">No hay usuarios en esta empresa.</p>
              )}
            </div>
          )}
        </div>
      )}

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
                    onClick={() => {
                      const next = selectedCompanyId === c.id ? null : c.id;
                      setSelectedCompanyId(next);
                      setSaveMessage(null);
                      try {
                        if (typeof window !== 'undefined') {
                          if (next) localStorage.setItem(SUPERADMIN_COMPANY_STORAGE_KEY, next);
                          else localStorage.removeItem(SUPERADMIN_COMPANY_STORAGE_KEY);
                        }
                      } catch {}
                    }}
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
            const companyNameSelected = selected?.name ?? '—';
            return (
            <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
              <h3 className="font-semibold text-[var(--foreground)] mb-3">Módulos visibles para {adminUsername} — {companyNameSelected}</h3>
              <p className="text-sm text-[var(--muted)] mb-4">Marca o desmarca los módulos que podrá ver este usuario. Por defecto todos están visibles.</p>
              <div className="flex flex-wrap gap-4">
                {Object.entries(MODULE_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasModuleAccess(key, adminModules)}
                      onChange={(e) =>
                        setAdminModules((prev) => {
                          const withoutModule = prev.filter(
                            (m) => m !== key && !m.startsWith(`${key}_`)
                          );
                          return e.target.checked ? [...withoutModule, key] : withoutModule;
                        })
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

      {createdUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="created-user-modal-title">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="created-user-modal-title" className="font-semibold text-[var(--foreground)] text-lg mb-2">Usuario creado</h2>
            <p className="text-sm text-[var(--muted)] mb-6">El usuario <strong className="text-[var(--foreground)]">{createdUserModal}</strong> ha sido creado correctamente.</p>
            <div className="flex justify-end">
              <button type="button" onClick={() => setCreatedUserModal(null)} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium">
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="delete-user-modal-title">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="delete-user-modal-title" className="font-semibold text-[var(--foreground)] text-lg mb-2">Eliminar usuario</h2>
            <p className="text-sm text-[var(--muted)] mb-6">
              ¿Eliminar a <strong className="text-[var(--foreground)]">{confirmDelete.username}</strong> ({ROLE_LABELS[confirmDelete.role] ?? confirmDelete.role})? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={actionUserId === confirmDelete.id}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionUserId === confirmDelete.id}
                className="rounded-lg bg-[var(--destructive)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {actionUserId === confirmDelete.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
