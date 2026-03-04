'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clientsApi, companiesApi } from '@/lib/api';

type Client = {
  id: string;
  name: string;
  address?: string;
  rifCedula: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
};

function getCompanyId(user: { role: string; companyId: string | null }, selectedCompanyId: string | null): string | null {
  if (user.role === 'SUPER_ADMIN') return selectedCompanyId;
  return user.companyId;
}

export default function ClientesPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [rifCedulaSearch, setRifCedulaSearch] = useState('');
  const [searchResult, setSearchResult] = useState<Client | null | 'loading' | 'not-found'>(null);
  const [form, setForm] = useState<Partial<Client>>({
    name: '',
    address: '',
    rifCedula: '',
    description: '',
    phone: '',
    email: '',
  });
  const [list, setList] = useState<{ items: Client[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listSearch, setListSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      companiesApi.list().then(setCompanies).catch(() => {});
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' && companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    }
    if (user?.role !== 'SUPER_ADMIN' && user?.companyId) {
      setSelectedCompanyId(user.companyId);
    }
  }, [user, companies, selectedCompanyId]);

  useEffect(() => {
    if (!companyId) return;
    clientsApi.list(companyId, page, limit, listSearch || undefined).then((data) => setList(data as { items: Client[]; total: number })).catch(() => {});
  }, [companyId, page, limit, listSearch]);

  const handleSearchByRifCedula = async () => {
    if (!companyId || !rifCedulaSearch.trim()) return;
    setSearchResult('loading');
    setError('');
    try {
      const found = await clientsApi.search(companyId, rifCedulaSearch.trim());
      if (found) {
        setSearchResult(found as Client);
        setForm({
          name: (found as Client).name,
          address: (found as Client).address ?? '',
          rifCedula: (found as Client).rifCedula,
          description: (found as Client).description ?? '',
          phone: (found as Client).phone ?? '',
          email: (found as Client).email ?? '',
        });
      } else {
        setSearchResult('not-found');
        setForm({
          name: '',
          address: '',
          rifCedula: rifCedulaSearch.trim(),
          description: '',
          phone: '',
          email: '',
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar');
      setSearchResult(null);
    }
  };

  const handleCreateClient = async () => {
    if (!companyId || !form.rifCedula?.trim() || !form.name?.trim()) {
      setError('Nombre y RIF/Cédula son obligatorios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await clientsApi.create(companyId, {
        name: form.name.trim(),
        address: form.address?.trim() || undefined,
        rifCedula: form.rifCedula.trim(),
        description: form.description?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        email: form.email?.trim() || undefined,
      });
      setRifCedulaSearch('');
      setSearchResult(null);
      setForm({ name: '', address: '', rifCedula: '', description: '', phone: '', email: '' });
      clientsApi.list(companyId, page, limit, listSearch || undefined).then((data) => setList(data as { items: Client[]; total: number })).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Clientes</h1>
      <p className="text-[var(--muted)] mt-1">Buscar por RIF/Cédula o agregar nuevos clientes.</p>

      {user.role === 'SUPER_ADMIN' && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Empresa</label>
          <select
            value={selectedCompanyId ?? ''}
            onChange={(e) => setSelectedCompanyId(e.target.value || null)}
            className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 text-[var(--foreground)]"
          >
            <option value="">Seleccionar empresa</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {!companyId && (
        <p className="mt-4 text-[var(--muted)]">Selecciona una empresa para gestionar clientes.</p>
      )}

      {companyId && (
        <>
          {/* Buscar o agregar */}
          <section className="mt-6 p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Buscar o agregar cliente</h2>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="RIF o Cédula"
                value={rifCedulaSearch}
                onChange={(e) => setRifCedulaSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchByRifCedula()}
                className="flex-1 min-w-[200px] rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-[var(--foreground)] placeholder-[var(--muted)]"
              />
              <button
                type="button"
                onClick={handleSearchByRifCedula}
                disabled={!rifCedulaSearch.trim()}
                className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 font-medium disabled:opacity-50"
              >
                Buscar
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-[var(--destructive)]">{error}</p>}
            {searchResult === 'loading' && <p className="mt-2 text-sm text-[var(--muted)]">Buscando...</p>}
            {searchResult !== null && searchResult !== 'loading' && (
              <div className="mt-4 space-y-4">
                {searchResult !== 'not-found' ? (
                  <div className="p-4 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                    <p className="text-sm font-medium text-[var(--muted)] mb-2">Cliente encontrado</p>
                    <p><span className="text-[var(--muted)]">Nombre:</span> {searchResult.name}</p>
                    {searchResult.address && <p><span className="text-[var(--muted)]">Dirección:</span> {searchResult.address}</p>}
                    <p><span className="text-[var(--muted)]">RIF/Cédula:</span> {searchResult.rifCedula}</p>
                    {searchResult.phone && <p><span className="text-[var(--muted)]">Teléfono:</span> {searchResult.phone}</p>}
                    {searchResult.email && <p><span className="text-[var(--muted)]">Correo:</span> {searchResult.email}</p>}
                    {searchResult.description && <p><span className="text-[var(--muted)]">Descripción:</span> {searchResult.description}</p>}
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-[var(--muted)]">No existe un cliente con ese RIF/Cédula. Completa los datos para darlo de alta.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Nombre *</label>
                        <input
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">RIF / Cédula *</label>
                        <input
                          value={form.rifCedula}
                          readOnly
                          className="w-full rounded-lg bg-[var(--border)]/30 border border-[var(--border)] px-3 py-2 cursor-not-allowed text-[var(--muted)]"
                          title="RIF/Cédula fijado por la búsqueda"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Dirección</label>
                        <input
                          value={form.address}
                          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                          className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Teléfono</label>
                        <input
                          value={form.phone ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                          className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Correo electrónico</label>
                        <input
                          type="email"
                          value={form.email ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Descripción</label>
                        <textarea
                          value={form.description ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                          rows={2}
                          className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateClient}
                      disabled={saving}
                      className="mt-4 rounded-lg bg-[var(--primary)] text-white px-4 py-2 font-medium disabled:opacity-50"
                    >
                      {saving ? 'Guardando...' : 'Ingresar cliente'}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Listado */}
          <section className="mt-8">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Listado de clientes</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              <input
                type="text"
                placeholder="Buscar por nombre, RIF o correo..."
                value={listSearch}
                onChange={(e) => { setListSearch(e.target.value); setPage(1); }}
                className="flex-1 min-w-[200px] rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 text-[var(--foreground)]"
              />
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 text-[var(--foreground)]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-left">
                <thead className="bg-[var(--card)]">
                  <tr>
                    <th className="p-3 font-medium text-[var(--foreground)]">Nombre</th>
                    <th className="p-3 font-medium text-[var(--foreground)]">RIF/Cédula</th>
                    <th className="p-3 font-medium text-[var(--foreground)] hidden md:table-cell">Teléfono</th>
                    <th className="p-3 font-medium text-[var(--foreground)] hidden lg:table-cell">Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--border)] hover:bg-[var(--card-hover)]">
                      <td className="p-3">{c.name}</td>
                      <td className="p-3">{c.rifCedula}</td>
                      <td className="p-3 hidden md:table-cell">{c.phone ?? '—'}</td>
                      <td className="p-3 hidden lg:table-cell">{c.email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.items.length === 0 && (
              <p className="py-6 text-center text-[var(--muted)]">No hay clientes registrados.</p>
            )}
            <div className="mt-3 flex items-center justify-between text-sm text-[var(--muted)]">
              <span>Total: {list.total} registros</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded px-2 py-1 bg-[var(--card)] disabled:opacity-50"
                >
                  Anterior
                </button>
                <span>Pág. {page}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= list.total}
                  className="rounded px-2 py-1 bg-[var(--card)] disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
