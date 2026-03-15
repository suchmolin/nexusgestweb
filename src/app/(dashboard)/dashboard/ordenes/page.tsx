'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ordersApi, companiesApi } from '@/lib/api';
import { SUPERADMIN_COMPANY_STORAGE_KEY } from '@/lib/constants';
import { useIsMobile } from '@/hooks/useIsMobile';
import { IconEye, IconEyeOff } from '@/components/Icons';

const SHOW_PRODUCT_NAMES_STORAGE_KEY = 'nexusgest_ordenes_show_product_names';
const NEW_ORDER_POLL_INTERVAL_MS = 15000; // cada 15 s

function getShowProductNamesPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = localStorage.getItem(SHOW_PRODUCT_NAMES_STORAGE_KEY);
    if (v === 'false') return false;
    if (v === 'true') return true;
  } catch {}
  return true;
}

/** Reproduce un sonido corto tipo notificación (dos tonos). */
function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    playTone(880, 0, 0.12);
    playTone(1100, 0.15, 0.12);
  } catch {}
}

const ORDER_STATUSES = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_preparacion', label: 'En preparación' },
  { value: 'cerrada', label: 'Cerrada' },
] as const;
type OrderStatusValue = (typeof ORDER_STATUSES)[number]['value'];

function getCompanyId(user: { role: string; companyId: string | null }, selected: string | null): string | null {
  return user?.role === 'SUPER_ADMIN' ? selected : user?.companyId ?? null;
}

type OrderItem = {
  id: string;
  status: string;
  createdAt: string;
  invoice?: {
    correlative?: string;
    date?: string;
    client?: { name?: string };
    items?: { product?: { name?: string } }[];
  };
};

type InvoiceItemDetail = {
  id: string;
  quantity: number;
  unitPrice: number;
  product?: { code?: string; name?: string };
};

type OrderDetail = OrderItem & {
  invoice?: {
    correlative?: string;
    date?: string;
    client?: { name?: string };
    items?: InvoiceItemDetail[];
  };
};

export default function OrdenesPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const companyId = user ? getCompanyId(user, selectedCompanyId) : null;

  const [ordersByStatus, setOrdersByStatus] = useState<Record<OrderStatusValue, OrderItem[]>>({
    pendiente: [],
    en_preparacion: [],
    cerrada: [],
  });
  const [loading, setLoading] = useState(false);
  const [draggedOrder, setDraggedOrder] = useState<{ id: string; fromStatus: OrderStatusValue } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<OrderStatusValue | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<OrderDetail | null>(null);
  const [detailModalLoading, setDetailModalLoading] = useState(false);
  const [showProductNamesInPreview, setShowProductNamesInPreview] = useState(() => getShowProductNamesPreference());
  const justDraggedRef = useRef(false);
  const lastPendingCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') companiesApi.list().then(setCompanies).catch(() => {});
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' && companies.length > 0) {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(SUPERADMIN_COMPANY_STORAGE_KEY) : null;
      const id = stored && companies.some((c) => c.id === stored) ? stored : companies[0].id;
      setSelectedCompanyId(id);
      try {
        if (typeof window !== 'undefined') localStorage.setItem(SUPERADMIN_COMPANY_STORAGE_KEY, id);
      } catch {}
    } else if (user?.role !== 'SUPER_ADMIN' && user?.companyId) {
      setSelectedCompanyId(user.companyId);
    }
  }, [user?.role, user?.companyId, companies]);

  const loadOrders = useCallback(() => {
    if (!companyId) return;
    setLoading(true);
    ordersApi
      .list(companyId, { limit: 200 })
      .then((res) => {
        const items = (res.items || []) as OrderItem[];
        const next: Record<OrderStatusValue, OrderItem[]> = {
          pendiente: items.filter((o) => o.status === 'pendiente'),
          en_preparacion: items.filter((o) => o.status === 'en_preparacion'),
          cerrada: items.filter((o) => o.status === 'cerrada'),
        };
        setOrdersByStatus(next);
      })
      .catch(() => setOrdersByStatus({ pendiente: [], en_preparacion: [], cerrada: [] }))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Poll para detectar nuevas órdenes y reproducir sonido de notificación
  useEffect(() => {
    if (!companyId) return;
    const checkNewOrders = () => {
      ordersApi.getPendingCount(companyId).then((r) => {
        const count = r.count ?? 0;
        if (lastPendingCountRef.current !== null && count > lastPendingCountRef.current) {
          playNotificationSound();
        }
        lastPendingCountRef.current = count;
      }).catch(() => {});
    };
    checkNewOrders();
    const interval = setInterval(checkNewOrders, NEW_ORDER_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [companyId]);

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatusValue) => {
    if (!companyId) return;
    setUpdatingId(orderId);
    try {
      await ordersApi.updateStatus(orderId, companyId, newStatus);
      setDetailModal((prev) => (prev?.id === orderId ? { ...prev, status: newStatus } : prev));
      loadOrders();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('orders-updated'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, orderId: string, fromStatus: OrderStatusValue) => {
    setDraggedOrder({ id: orderId, fromStatus });
    e.dataTransfer.setData('text/plain', orderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: OrderStatusValue) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, toStatus: OrderStatusValue) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedOrder || draggedOrder.fromStatus === toStatus) {
      setDraggedOrder(null);
      return;
    }
    updateOrderStatus(draggedOrder.id, toStatus);
    setDraggedOrder(null);
  };

  const handleDragEnd = () => {
    setDraggedOrder(null);
    setDragOverColumn(null);
    justDraggedRef.current = true;
    setTimeout(() => { justDraggedRef.current = false; }, 150);
  };

  const toggleShowProductNames = () => {
    const next = !showProductNamesInPreview;
    setShowProductNamesInPreview(next);
    try {
      localStorage.setItem(SHOW_PRODUCT_NAMES_STORAGE_KEY, String(next));
    } catch {}
  };

  const openOrderDetail = (orderId: string) => {
    if (justDraggedRef.current || !companyId) return;
    setDetailModalLoading(true);
    setDetailModal(null);
    ordersApi
      .get(orderId, companyId)
      .then((data) => setDetailModal(data as OrderDetail))
      .catch(() => setDetailModal(null))
      .finally(() => setDetailModalLoading(false));
  };

  if (!user) return null;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Órdenes</h1>
      <p className="text-[var(--muted)] mt-1">Gestiona las órdenes generadas desde facturas. Cambia el estado según avance el trabajo.</p>

      {user.role === 'SUPER_ADMIN' && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Empresa</label>
          <select
            value={selectedCompanyId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              setSelectedCompanyId(id);
              try {
                if (id && typeof window !== 'undefined') localStorage.setItem(SUPERADMIN_COMPANY_STORAGE_KEY, id);
              } catch {}
            }}
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
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--muted)]">Nombres de productos en las tarjetas:</span>
            <button
              type="button"
              onClick={toggleShowProductNames}
              title={showProductNamesInPreview ? 'Ocultar nombres de productos' : 'Mostrar nombres de productos'}
              className="rounded-lg border border-[var(--border)] p-2 text-[var(--foreground)] hover:bg-[var(--card-hover)]"
              aria-label={showProductNamesInPreview ? 'Ocultar nombres de productos' : 'Mostrar nombres de productos'}
            >
              {showProductNamesInPreview ? (
                <IconEye className="w-5 h-5" />
              ) : (
                <IconEyeOff className="w-5 h-5" />
              )}
            </button>
          </div>

          {loading ? (
            <p className="mt-6 text-[var(--muted)]">Cargando órdenes...</p>
          ) : isMobile ? (
            <div className="mt-6 space-y-6">
              <p className="text-sm text-[var(--muted)]">Órdenes pendientes y en preparación. Usa el selector o toca la orden para ver el detalle.</p>

              <section>
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2 pb-2 border-b border-[var(--border)]">Pendiente</h3>
                <div className="space-y-3">
                  {ordersByStatus.pendiente.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No hay órdenes pendientes.</p>
                  ) : (
                    ordersByStatus.pendiente.map((order) => (
                      <div
                        key={order.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openOrderDetail(order.id)}
                        onKeyDown={(e) => e.key === 'Enter' && openOrderDetail(order.id)}
                        className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] flex flex-col gap-2 cursor-pointer hover:bg-[var(--card-hover)]"
                      >
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[var(--foreground)]">Factura {order.invoice?.correlative ?? '—'}</p>
                            <p className="text-sm text-[var(--muted)]">{order.invoice?.client?.name ?? '—'}</p>
                            <p className="text-xs text-[var(--muted)]">{order.invoice?.date ? new Date(order.invoice.date).toLocaleDateString() : ''}</p>
                            {showProductNamesInPreview && (order.invoice?.items?.length ?? 0) > 0 && (
                              <p className="text-xs text-[var(--muted)] mt-1 truncate" title={(order.invoice?.items ?? []).map((i) => i.product?.name).filter(Boolean).join(', ')}>
                                {(order.invoice?.items ?? []).map((i) => i.product?.name).filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                          <select
                            value={order.status}
                            onChange={(e) => { e.stopPropagation(); updateOrderStatus(order.id, e.target.value as OrderStatusValue); }}
                            onClick={(e) => e.stopPropagation()}
                            disabled={updatingId === order.id}
                            className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-2 py-1.5 text-sm"
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2 pb-2 border-b border-[var(--border)]">En preparación</h3>
                <div className="space-y-3">
                  {ordersByStatus.en_preparacion.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No hay órdenes en preparación.</p>
                  ) : (
                    ordersByStatus.en_preparacion.map((order) => (
                      <div
                        key={order.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openOrderDetail(order.id)}
                        onKeyDown={(e) => e.key === 'Enter' && openOrderDetail(order.id)}
                        className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] flex flex-col gap-2 cursor-pointer hover:bg-[var(--card-hover)]"
                      >
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[var(--foreground)]">Factura {order.invoice?.correlative ?? '—'}</p>
                            <p className="text-sm text-[var(--muted)]">{order.invoice?.client?.name ?? '—'}</p>
                            <p className="text-xs text-[var(--muted)]">{order.invoice?.date ? new Date(order.invoice.date).toLocaleDateString() : ''}</p>
                            {showProductNamesInPreview && (order.invoice?.items?.length ?? 0) > 0 && (
                              <p className="text-xs text-[var(--muted)] mt-1 truncate" title={(order.invoice?.items ?? []).map((i) => i.product?.name).filter(Boolean).join(', ')}>
                                {(order.invoice?.items ?? []).map((i) => i.product?.name).filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                          <select
                            value={order.status}
                            onChange={(e) => { e.stopPropagation(); updateOrderStatus(order.id, e.target.value as OrderStatusValue); }}
                            onClick={(e) => e.stopPropagation()}
                            disabled={updatingId === order.id}
                            className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-2 py-1.5 text-sm"
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {ORDER_STATUSES.map((status) => (
                <div
                  key={status.value}
                  onDragOver={(e) => handleDragOver(e, status.value)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, status.value)}
                  className={`rounded-xl border-2 min-h-[200px] p-3 transition-colors ${
                    dragOverColumn === status.value
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                      : 'border-[var(--border)] bg-[var(--card)]'
                  }`}
                >
                  <h3 className="font-semibold text-[var(--foreground)] mb-3 sticky top-0 bg-inherit py-1">
                    {status.label}
                    <span className="ml-2 text-sm font-normal text-[var(--muted)]">({ordersByStatus[status.value].length})</span>
                  </h3>
                  <div className="space-y-2">
                    {ordersByStatus[status.value].map((order) => (
                      <div
                        key={order.id}
                        role="button"
                        tabIndex={0}
                        draggable
                        onDragStart={(e) => handleDragStart(e, order.id, status.value)}
                        onDragEnd={handleDragEnd}
                        onClick={() => openOrderDetail(order.id)}
                        onKeyDown={(e) => e.key === 'Enter' && openOrderDetail(order.id)}
                        className={`p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] cursor-grab active:cursor-grabbing hover:border-[var(--primary)]/50 ${
                          draggedOrder?.id === order.id ? 'opacity-50' : ''
                        }`}
                      >
                        <p className="font-medium text-sm text-[var(--foreground)]">Factura {order.invoice?.correlative ?? '—'}</p>
                        <p className="text-xs text-[var(--muted)]">{order.invoice?.client?.name ?? '—'}</p>
                        <p className="text-xs text-[var(--muted)]">{order.invoice?.date ? new Date(order.invoice.date).toLocaleDateString() : ''}</p>
                        {showProductNamesInPreview && (order.invoice?.items?.length ?? 0) > 0 && (
                          <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">
                            {(order.invoice?.items ?? []).map((i) => i.product?.name).filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal detalle de la orden */}
      {(detailModal !== null || detailModalLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !detailModalLoading && setDetailModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Detalle de la orden"
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {detailModalLoading ? 'Cargando...' : `Orden — Factura ${detailModal?.invoice?.correlative ?? '—'}`}
              </h2>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            {detailModalLoading && (
              <div className="p-6 text-center text-[var(--muted)]">Cargando detalle...</div>
            )}
            {!detailModalLoading && detailModal && (
              <div className="p-4 overflow-y-auto flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <label className="text-sm font-medium text-[var(--foreground)]">Estado:</label>
                  <select
                    value={detailModal.status}
                    onChange={(e) => updateOrderStatus(detailModal.id, e.target.value as OrderStatusValue)}
                    disabled={updatingId === detailModal.id}
                    className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                  <p><span className="text-[var(--muted)]">Cliente:</span> {detailModal.invoice?.client?.name ?? '—'}</p>
                  <p><span className="text-[var(--muted)]">Fecha factura:</span> {detailModal.invoice?.date ? new Date(detailModal.invoice.date).toLocaleDateString() : '—'}</p>
                </div>
                <h3 className="font-medium text-[var(--foreground)] mb-2">Productos</h3>
                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[var(--background)]">
                      <tr>
                        <th className="p-2 font-medium text-[var(--foreground)]">Código</th>
                        <th className="p-2 font-medium text-[var(--foreground)]">Descripción</th>
                        <th className="p-2 font-medium text-[var(--foreground)] text-center">Cant.</th>
                        <th className="p-2 font-medium text-[var(--foreground)] text-right">P. unit.</th>
                        <th className="p-2 font-medium text-[var(--foreground)] text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailModal.invoice?.items ?? []).map((item: InvoiceItemDetail) => {
                        const qty = Number(item.quantity);
                        const unit = Number(item.unitPrice);
                        const total = qty * unit;
                        return (
                          <tr key={item.id} className="border-t border-[var(--border)]">
                            <td className="p-2 text-[var(--foreground)]">{item.product?.code ?? '—'}</td>
                            <td className="p-2 text-[var(--foreground)]">{item.product?.name ?? '—'}</td>
                            <td className="p-2 text-center text-[var(--foreground)]">{qty}</td>
                            <td className="p-2 text-right text-[var(--foreground)]">{unit.toFixed(2)}</td>
                            <td className="p-2 text-right text-[var(--foreground)]">{total.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(detailModal.invoice?.items?.length ?? 0) === 0 && (
                  <p className="text-sm text-[var(--muted)] py-4">No hay ítems en esta factura.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
