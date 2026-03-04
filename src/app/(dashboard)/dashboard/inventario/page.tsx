'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { productsApi, inventoryApi, companiesApi } from '@/lib/api';
import { ActionModal, type ActionModalVariant } from '@/components/ActionModal';

function getCompanyId(user: { role: string; companyId: string | null }, selected: string | null): string | null {
  return user.role === 'SUPER_ADMIN' ? selected : user.companyId;
}

export default function InventarioPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;

  const [subTab, setSubTab] = useState<'add' | 'ingreso' | 'egreso' | 'consulta'>('consulta');

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exentoIva, setExentoIva] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [ingresoProduct, setIngresoProduct] = useState<any | null>(null);
  const [ingresoQty, setIngresoQty] = useState('');
  const [ingresoUnitCost, setIngresoUnitCost] = useState('');
  const [ingresoSalePrice, setIngresoSalePrice] = useState('');
  const [ingresoObservation, setIngresoObservation] = useState('');
  const [ingresoSaving, setIngresoSaving] = useState(false);

  const [egresoProduct, setEgresoProduct] = useState<any | null>(null);
  const [egresoQty, setEgresoQty] = useState('');
  const [egresoReason, setEgresoReason] = useState('');
  const [egresoObservation, setEgresoObservation] = useState('');
  const [egresoSaving, setEgresoSaving] = useState(false);

  const [products, setProducts] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filterCode, setFilterCode] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [infoProduct, setInfoProduct] = useState<any | null>(null);
  const [movements, setMovements] = useState<{ items: any[] }>({ items: [] });
  const [movementFilterFrom, setMovementFilterFrom] = useState('');
  const [movementFilterTo, setMovementFilterTo] = useState('');
  const [movementFilterType, setMovementFilterType] = useState('');
  const [deleteProduct, setDeleteProduct] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const loadProducts = useCallback(() => {
    if (!companyId) return;
    const params: Record<string, string> = { companyId, page: String(page), limit: String(limit) };
    if (filterCode) params.code = filterCode;
    if (filterName) params.name = filterName;
    if (filterFrom) params.from = filterFrom;
    productsApi.list(companyId, page, limit, filterCode || undefined, filterName || undefined, filterFrom || undefined).then(setProducts).catch(() => {});
  }, [companyId, page, limit, filterCode, filterName, filterFrom]);

  useEffect(() => { if (subTab === 'consulta') loadProducts(); }, [subTab, loadProducts]);

  const handleAddProduct = async () => {
    if (!companyId || !code.trim() || !name.trim()) return;
    setAddSaving(true);
    try {
      await productsApi.create(companyId, { code: code.trim(), name: name.trim(), description: description.trim() || undefined, exentoIva });
      setCode('');
      setName('');
      setDescription('');
      setExentoIva(false);
      loadProducts();
      showActionModal('Producto agregado', 'El producto se ha registrado correctamente en el inventario.', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al agregar';
      showActionModal('Error al agregar producto', msg, 'error');
    } finally {
      setAddSaving(false);
    }
  };

  const handleSearch = async () => {
    if (!companyId || !searchQ.trim()) return;
    const list = await productsApi.search(companyId, searchQ.trim());
    setSearchResults(list as any[]);
  };

  const handleIngresoSubmit = async () => {
    if (!companyId || !ingresoProduct?.id || !ingresoQty || Number(ingresoQty) <= 0) return;
    setIngresoSaving(true);
    try {
      await inventoryApi.ingress(companyId, {
        productId: ingresoProduct.id,
        quantity: Number(ingresoQty),
        unitCost: ingresoUnitCost ? Number(ingresoUnitCost) : undefined,
        salePrice: ingresoSalePrice ? Number(ingresoSalePrice) : undefined,
        observation: ingresoObservation.trim() || undefined,
      });
      setIngresoProduct(null);
      setIngresoQty('');
      setIngresoUnitCost('');
      setIngresoSalePrice('');
      setIngresoObservation('');
      loadProducts();
      showActionModal('Ingreso registrado', 'El ingreso de producto se ha registrado correctamente.', 'success');
    } catch (e) {
      showActionModal('Error al registrar ingreso', e instanceof Error ? e.message : 'Error al registrar ingreso', 'error');
    } finally {
      setIngresoSaving(false);
    }
  };

  const handleEgresoSubmit = async () => {
    if (!companyId || !egresoProduct?.id || !egresoQty || Number(egresoQty) <= 0 || !egresoReason.trim()) return;
    setEgresoSaving(true);
    try {
      await inventoryApi.egress(companyId, {
        productId: egresoProduct.id,
        quantity: Number(egresoQty),
        reason: egresoReason.trim(),
        observation: egresoObservation.trim() || undefined,
      });
      setEgresoProduct(null);
      setEgresoQty('');
      setEgresoReason('');
      setEgresoObservation('');
      loadProducts();
      showActionModal('Egreso registrado', 'El egreso se ha realizado satisfactoriamente.', 'success');
    } catch (e) {
      showActionModal('Error al registrar egreso', e instanceof Error ? e.message : 'Error al registrar egreso', 'error');
    } finally {
      setEgresoSaving(false);
    }
  };

  const openInfo = (product: any) => {
    setInfoProduct(product);
    setMovements({ items: [] });
    setMovementFilterFrom('');
    setMovementFilterTo('');
    setMovementFilterType('');
  };

  useEffect(() => {
    if (!companyId || !infoProduct?.id) return;
    const params: Record<string, string> = { companyId };
    if (movementFilterFrom) params.from = movementFilterFrom;
    if (movementFilterTo) params.to = movementFilterTo;
    if (movementFilterType) params.type = movementFilterType;
    inventoryApi.movements(companyId, infoProduct.id, params).then((r: any) => setMovements(r)).catch(() => {});
  }, [companyId, infoProduct?.id, movementFilterFrom, movementFilterTo, movementFilterType]);

  const handleDeleteProduct = async () => {
    if (!companyId || !deleteProduct?.id) return;
    setDeleting(true);
    try {
      await productsApi.delete(deleteProduct.id, companyId);
      setDeleteProduct(null);
      loadProducts();
    } catch (e) {
      showActionModal('Error al eliminar', e instanceof Error ? e.message : 'Error al eliminar', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Inventario</h1>
      <p className="text-[var(--muted)] mt-1">Productos, ingresos, egresos y consultas.</p>

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
        <>
          <div className="flex gap-2 mt-6 border-b border-[var(--border)] flex-wrap">
            {(['consulta', 'ingreso', 'egreso', 'add'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setSubTab(t)} className={`px-4 py-2 font-medium rounded-t-lg ${subTab === t ? 'bg-[var(--card)] border border-[var(--border)] border-b-0 -mb-px text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}>
                {t === 'consulta' && 'Consulta'}
                {t === 'ingreso' && 'Ingreso'}
                {t === 'egreso' && 'Egreso'}
                {t === 'add' && 'Agregar producto'}
              </button>
            ))}
          </div>

          {subTab === 'add' && (
            <div className="mt-6 p-5 rounded-xl bg-[var(--card)] border border-[var(--border)] max-w-md">
              <h2 className="font-semibold text-[var(--foreground)] mb-3">Nuevo producto</h2>
              <div className="space-y-3">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código *" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre *" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" rows={2} className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={exentoIva} onChange={(e) => setExentoIva(e.target.checked)} className="rounded border-[var(--border)]" />
                  <span className="text-sm text-[var(--foreground)]">Exento de IVA</span>
                </label>
                <button type="button" onClick={handleAddProduct} disabled={addSaving} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 disabled:opacity-50">{addSaving ? 'Guardando...' : 'Agregar'}</button>
              </div>
            </div>
          )}

          {subTab === 'ingreso' && (
            <div className="mt-6">
              <div className="flex gap-2 mb-4">
                <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Código o nombre del producto" className="flex-1 max-w-md rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2" />
                <button type="button" onClick={handleSearch} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2">Buscar</button>
              </div>
              {searchResults.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden mb-4">
                  <table className="w-full text-left">
                    <thead className="bg-[var(--card)]"><tr><th className="p-3 font-medium">Código</th><th className="p-3 font-medium">Nombre</th><th className="p-3 font-medium">Stock</th><th className="p-3 font-medium"></th></tr></thead>
                    <tbody>
                      {searchResults.map((p: any) => (
                        <tr key={p.id} className="border-t border-[var(--border)]">
                          <td className="p-3">{p.code}</td>
                          <td className="p-3">{p.name}</td>
                          <td className="p-3">{p.stock}</td>
                          <td className="p-3">
                            <button type="button" onClick={() => { setIngresoProduct(p); setIngresoQty('1'); setIngresoUnitCost(''); setIngresoSalePrice(''); setIngresoObservation(''); }} className="rounded px-2 py-1 bg-[var(--primary)] text-white text-sm">Seleccionar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {ingresoProduct && (
                <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)] max-w-md">
                  <p className="font-medium">{ingresoProduct.name} (Stock: {ingresoProduct.stock})</p>
                  <div className="mt-3 space-y-2">
                    <input type="number" min={1} value={ingresoQty} onChange={(e) => setIngresoQty(e.target.value)} placeholder="Cantidad a ingresar" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    <input type="number" min={0} step={0.01} value={ingresoUnitCost} onChange={(e) => setIngresoUnitCost(e.target.value)} placeholder="Costo unitario" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    <input type="number" min={0} step={0.01} value={ingresoSalePrice} onChange={(e) => setIngresoSalePrice(e.target.value)} placeholder="Precio de venta" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    <input value={ingresoObservation} onChange={(e) => setIngresoObservation(e.target.value)} placeholder="Observación (opcional)" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    <div className="flex gap-2">
                      <button type="button" onClick={handleIngresoSubmit} disabled={ingresoSaving} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 disabled:opacity-50">Registrar ingreso</button>
                      <button type="button" onClick={() => setIngresoProduct(null)} className="rounded-lg bg-[var(--card-hover)] px-4 py-2">Cancelar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {subTab === 'egreso' && (
            <div className="mt-6">
              <div className="flex gap-2 mb-4">
                <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Código o nombre del producto" className="flex-1 max-w-md rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2" />
                <button type="button" onClick={handleSearch} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2">Buscar</button>
              </div>
              {searchResults.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden mb-4">
                  <table className="w-full text-left">
                    <thead className="bg-[var(--card)]"><tr><th className="p-3 font-medium">Código</th><th className="p-3 font-medium">Nombre</th><th className="p-3 font-medium">Stock</th><th className="p-3 font-medium"></th></tr></thead>
                    <tbody>
                      {searchResults.map((p: any) => (
                        <tr key={p.id} className="border-t border-[var(--border)]">
                          <td className="p-3">{p.code}</td>
                          <td className="p-3">{p.name}</td>
                          <td className="p-3">{p.stock}</td>
                          <td className="p-3">
                            <button type="button" onClick={() => { setEgresoProduct(p); setEgresoQty(''); setEgresoReason(''); setEgresoObservation(''); }} className="rounded px-2 py-1 bg-[var(--primary)] text-white text-sm">Seleccionar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {egresoProduct && (
                <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)] max-w-md">
                  <p className="font-medium">{egresoProduct.name} (Stock: {egresoProduct.stock})</p>
                  <div className="mt-3 space-y-2">
                    <input type="number" min={1} value={egresoQty} onChange={(e) => setEgresoQty(e.target.value)} placeholder="Cantidad a egresar *" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    <input value={egresoReason} onChange={(e) => setEgresoReason(e.target.value)} placeholder="Motivo del egreso *" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    <input value={egresoObservation} onChange={(e) => setEgresoObservation(e.target.value)} placeholder="Observación (opcional)" className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2" />
                    <div className="flex gap-2">
                      <button type="button" onClick={handleEgresoSubmit} disabled={egresoSaving} className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 disabled:opacity-50">Registrar egreso</button>
                      <button type="button" onClick={() => setEgresoProduct(null)} className="rounded-lg bg-[var(--card-hover)] px-4 py-2">Cancelar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {subTab === 'consulta' && (
            <div className="mt-6">
              <div className="flex flex-wrap gap-3 mb-4">
                <input value={filterCode} onChange={(e) => setFilterCode(e.target.value)} placeholder="Código" className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 w-32" />
                <input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Nombre" className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 w-40" />
                <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} placeholder="Desde" className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2" />
                <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-2 py-2">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-left">
                  <thead className="bg-[var(--card)]">
                    <tr>
                      <th className="p-3 font-medium">Código</th>
                      <th className="p-3 font-medium">Nombre</th>
                      <th className="p-3 font-medium">Stock</th>
                      <th className="p-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.items.map((p: any) => (
                      <tr key={p.id} className="border-t border-[var(--border)]">
                        <td className="p-3">{p.code}</td>
                        <td className="p-3">{p.name}</td>
                        <td className="p-3">{p.stock}</td>
                        <td className="p-3 flex gap-1">
                          <button type="button" onClick={() => openInfo(p)} className="rounded px-2 py-1 text-sm bg-[var(--card-hover)]">Info</button>
                          <button type="button" onClick={() => setDeleteProduct(p)} className="rounded px-2 py-1 text-sm bg-[var(--destructive)] text-white">Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {products.items.length === 0 && <p className="py-6 text-center text-[var(--muted)]">No hay productos.</p>}
              <div className="mt-3 flex justify-between text-sm text-[var(--muted)]">
                <span>Total: {products.total}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded px-2 py-1 bg-[var(--card)] disabled:opacity-50">Anterior</button>
                  <span>Pág. {page}</span>
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page * limit >= products.total} className="rounded px-2 py-1 bg-[var(--card)] disabled:opacity-50">Siguiente</button>
                </div>
              </div>
            </div>
          )}

          {infoProduct && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setInfoProduct(null)}>
              <div className="bg-[var(--card)] rounded-xl p-6 max-w-2xl w-full max-h-[85vh] overflow-auto border border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold">{infoProduct.name} — {infoProduct.code}</h3>
                <p className="text-sm text-[var(--muted)]">Stock: {infoProduct.stock}</p>
                <p className="text-sm mt-2">Movimientos (filtro por fechas y tipo):</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <input type="date" value={movementFilterFrom} onChange={(e) => setMovementFilterFrom(e.target.value)} className="rounded bg-[var(--background)] border border-[var(--border)] px-2 py-1" />
                  <input type="date" value={movementFilterTo} onChange={(e) => setMovementFilterTo(e.target.value)} className="rounded bg-[var(--background)] border border-[var(--border)] px-2 py-1" />
                  <select value={movementFilterType} onChange={(e) => setMovementFilterType(e.target.value)} className="rounded bg-[var(--background)] border border-[var(--border)] px-2 py-1">
                    <option value="">Todo</option>
                    <option value="INGRESO">Solo ingresos</option>
                    <option value="EGRESO">Solo egresos</option>
                  </select>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-[var(--muted)]"><th className="p-2">Fecha</th><th className="p-2">Tipo</th><th className="p-2">Cant.</th><th className="p-2">Usuario</th></tr></thead>
                    <tbody>
                      {movements.items.map((m: any) => (
                        <tr key={m.id} className="border-t border-[var(--border)]">
                          <td className="p-2">{new Date(m.createdAt).toLocaleString()}</td>
                          <td className="p-2">{m.type}</td>
                          <td className="p-2">{m.quantity}</td>
                          <td className="p-2">{m.user?.username ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={() => setInfoProduct(null)} className="mt-4 rounded-lg bg-[var(--card-hover)] px-4 py-2">Cerrar</button>
              </div>
            </div>
          )}

          {deleteProduct && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteProduct(null)}>
              <div className="bg-[var(--card)] rounded-xl p-6 max-w-md w-full border border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
                <p className="font-medium">¿Eliminar producto {deleteProduct.code} — {deleteProduct.name}?</p>
                <p className="text-sm text-[var(--muted)] mt-1">Se hará un soft delete (no se pierde información).</p>
                <div className="flex gap-2 mt-4">
                  <button type="button" onClick={handleDeleteProduct} disabled={deleting} className="rounded-lg bg-[var(--destructive)] text-white px-4 py-2 disabled:opacity-50">Sí, eliminar</button>
                  <button type="button" onClick={() => setDeleteProduct(null)} className="rounded-lg bg-[var(--card-hover)] px-4 py-2">Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <ActionModal open={actionModal.open} onClose={closeActionModal} title={actionModal.title} message={actionModal.message} variant={actionModal.variant} />
    </div>
  );
}
