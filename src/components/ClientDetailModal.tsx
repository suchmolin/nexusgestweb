'use client';

import { useEffect, useState } from 'react';
import { clientsApi } from '@/lib/api';

export type ClientDetail = {
  id: string;
  name: string;
  rifCedula: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
};

type Props = {
  open: boolean;
  companyId: string | null;
  clientId: string | null;
  /** Datos mínimos del listado mientras carga el detalle. */
  fallback?: Partial<ClientDetail> | null;
  onClose: () => void;
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)] mb-0.5">{label}</p>
      <p className="text-sm text-[var(--foreground)]">{value?.trim() ? value : '—'}</p>
    </div>
  );
}

export function ClientDetailModal({ open, companyId, clientId, fallback, onClose }: Props) {
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !companyId || !clientId) {
      setClient(null);
      setError('');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    if (fallback?.name) {
      setClient({
        id: clientId,
        name: fallback.name,
        rifCedula: fallback.rifCedula ?? '',
        address: fallback.address,
        phone: fallback.phone,
        email: fallback.email,
        description: fallback.description,
      });
    }
    clientsApi
      .get(clientId, companyId)
      .then((data) => {
        if (!cancelled) setClient(data as ClientDetail);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar el cliente');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, companyId, clientId, fallback?.name, fallback?.rifCedula, fallback?.address, fallback?.phone, fallback?.email, fallback?.description]);

  if (!open) return null;

  const display = client;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-detail-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="client-detail-modal-title" className="font-semibold text-[var(--foreground)] text-lg mb-1">
          Información del cliente
        </h2>
        {loading && !display && <p className="text-sm text-[var(--muted)] mt-3">Cargando...</p>}
        {error && !display && <p className="text-sm text-[var(--destructive)] mt-3">{error}</p>}
        {display && (
          <div className="mt-4 space-y-3">
            <Field label="Nombre" value={display.name} />
            <Field label="RIF / Cédula" value={display.rifCedula} />
            <Field label="Dirección" value={display.address} />
            <Field label="Teléfono" value={display.phone} />
            <Field label="Correo" value={display.email} />
            <Field label="Descripción" value={display.description} />
            {loading && <p className="text-xs text-[var(--muted)]">Actualizando datos...</p>}
            {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
