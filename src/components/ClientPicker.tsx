'use client';

import { useState, useEffect, useRef } from 'react';
import { clientsApi } from '@/lib/api';

export type PickedClient = {
  id: string;
  name: string;
  address?: string;
  rifCedula: string;
  phone?: string | null;
  email?: string | null;
};

type ClientForm = {
  name: string;
  address: string;
  rifCedula: string;
  phone: string;
  email: string;
};

type Props = {
  companyId: string | null;
  label?: string;
  selectedClientId: string | null;
  clientForm: ClientForm;
  onSelect: (client: PickedClient) => void;
  onClear: () => void;
  onFormChange: (form: ClientForm) => void;
  /** Cuando la búsqueda por RIF no encuentra, se marca not-found y se muestra el form. */
  searchResult: PickedClient | null | 'loading' | 'not-found';
  onSearchResultChange: (v: PickedClient | null | 'loading' | 'not-found') => void;
};

export function ClientPicker({
  companyId,
  label = 'Cliente',
  selectedClientId,
  clientForm,
  onSelect,
  onClear,
  onFormChange,
  searchResult,
  onSearchResultChange,
}: Props) {
  const [clientRif, setClientRif] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalQuery, setModalQuery] = useState('');
  const [modalResults, setModalResults] = useState<PickedClient[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchResult && typeof searchResult === 'object' && searchResult.rifCedula) {
      setClientRif(searchResult.rifCedula);
    }
  }, [searchResult]);

  const applyClient = (client: PickedClient) => {
    setClientRif(client.rifCedula);
    onSearchResultChange(client);
    onSelect(client);
    onFormChange({
      name: client.name,
      address: client.address ?? '',
      rifCedula: client.rifCedula,
      phone: client.phone ?? '',
      email: client.email ?? '',
    });
  };

  const handleSearch = async () => {
    if (!companyId || !clientRif.trim()) return;
    onSearchResultChange('loading');
    try {
      const found = (await clientsApi.search(companyId, clientRif.trim())) as PickedClient | null;
      if (found) {
        applyClient(found);
      } else {
        onClear();
        onSearchResultChange('not-found');
        onFormChange({ name: '', address: '', rifCedula: clientRif.trim(), phone: '', email: '' });
      }
    } catch {
      onSearchResultChange(null);
    }
  };

  useEffect(() => {
    if (!modalOpen || !companyId) return;
    if (!modalQuery.trim()) {
      setModalResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setModalLoading(true);
      clientsApi
        .searchMany(companyId, modalQuery.trim())
        .then((list) => {
          setModalResults((list as PickedClient[]) || []);
          setHighlighted(0);
        })
        .catch(() => setModalResults([]))
        .finally(() => setModalLoading(false));
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [modalOpen, modalQuery, companyId]);

  const isNotFound = searchResult === 'not-found';
  const selected =
    searchResult && typeof searchResult === 'object' ? searchResult : null;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-[var(--muted)] mb-1">{label}</label>
        <div className="flex flex-wrap gap-2">
          <input
            value={clientRif}
            onChange={(e) => {
              setClientRif(e.target.value);
              if (selectedClientId || searchResult) {
                onClear();
                onSearchResultChange(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="RIF / Cédula"
            className="flex-1 min-w-[160px] rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={!companyId || !clientRif.trim() || searchResult === 'loading'}
            className="rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--card-hover)] disabled:opacity-50"
          >
            {searchResult === 'loading' ? 'Buscando...' : 'Buscar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setModalOpen(true);
              setModalQuery('');
              setModalResults([]);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            className="rounded-lg bg-[var(--primary)] text-white px-3 py-2 text-sm"
          >
            Buscar por nombre
          </button>
        </div>
      </div>

      {selected && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
          <p className="font-medium text-[var(--foreground)]">{selected.name}</p>
          <p className="text-[var(--muted)]">
            {selected.rifCedula}
            {selected.phone ? ` · ${selected.phone}` : ''}
          </p>
        </div>
      )}

      {isNotFound && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded-lg border border-dashed border-[var(--border)]">
          <p className="md:col-span-2 text-sm text-[var(--muted)]">
            No se encontró. Completa los datos para crearlo al guardar.
          </p>
          <input
            value={clientForm.name}
            onChange={(e) => onFormChange({ ...clientForm, name: e.target.value })}
            placeholder="Nombre *"
            className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
          />
          <input
            value={clientForm.rifCedula}
            readOnly
            className="rounded-lg bg-[var(--border)]/30 border border-[var(--border)] px-3 py-2 text-[var(--muted)]"
          />
          <input
            value={clientForm.address}
            onChange={(e) => onFormChange({ ...clientForm, address: e.target.value })}
            placeholder="Dirección"
            className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 md:col-span-2"
          />
          <input
            value={clientForm.phone}
            onChange={(e) => onFormChange({ ...clientForm, phone: e.target.value })}
            placeholder="Teléfono"
            className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
          />
          <input
            value={clientForm.email}
            onChange={(e) => onFormChange({ ...clientForm, email: e.target.value })}
            placeholder="Correo"
            className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
          />
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setModalOpen(false)}>
          <div
            className="w-full max-w-lg rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-[var(--foreground)] mb-3">Buscar {label.toLowerCase()}</h3>
            <input
              ref={inputRef}
              value={modalQuery}
              onChange={(e) => setModalQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setModalOpen(false);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlighted((i) => Math.min(i + 1, modalResults.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlighted((i) => Math.max(0, i - 1));
                } else if (e.key === 'Enter' && modalResults[highlighted]) {
                  e.preventDefault();
                  applyClient(modalResults[highlighted]);
                  setModalOpen(false);
                }
              }}
              placeholder="Nombre, RIF, dirección..."
              className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2 mb-3"
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {modalLoading && <p className="text-sm text-[var(--muted)] px-2">Buscando...</p>}
              {!modalLoading && modalQuery.trim() && modalResults.length === 0 && (
                <p className="text-sm text-[var(--muted)] px-2">Sin resultados</p>
              )}
              {modalResults.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    applyClient(c);
                    setModalOpen(false);
                  }}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
                    i === highlighted ? 'bg-[var(--primary)]/15' : 'hover:bg-[var(--card-hover)]'
                  }`}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-[var(--muted)]"> — {c.rifCedula}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function currencyCodeFromConfig(cfg: { currencySymbol?: string } | null): 'BS' | 'USD' | 'EUR' {
  const s = cfg?.currencySymbol;
  if (!s) return 'BS';
  if (s === 'Bs.' || s === 'BS' || s === 'Bs') return 'BS';
  if (s === '$' || s === 'USD') return 'USD';
  if (s === '€' || s === 'EUR') return 'EUR';
  return 'BS';
}

export function currencySymbolLabel(code: 'BS' | 'USD' | 'EUR') {
  return code === 'BS' ? 'Bs.' : code === 'USD' ? '$' : '€';
}
