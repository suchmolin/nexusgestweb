'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, companiesApi } from '@/lib/api';

export default function UsuariosPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      usersApi.listAdmins().then(setAdmins).catch(() => setAdmins([]));
      companiesApi.list().then(setCompanies).catch(() => []);
    }
  }, [user?.role]);

  if (!user) return null;
  if (user.role !== 'SUPER_ADMIN') {
    return (
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Gestión de usuarios</h1>
        <p className="text-[var(--muted)] mt-2">Solo el Super Admin puede acceder a este módulo.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Gestión de usuarios</h1>
      <p className="text-[var(--muted)] mt-1">Activar y desactivar módulos por perfil de cada empresa. Solo Super Admin.</p>

      <div className="mt-6 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] mb-6">
        <p className="text-sm text-[var(--muted)]">Aquí podrás definir qué módulos y visuales tiene cada perfil (Admin, Vendedor, Supervisor) por empresa. La configuración de roles y módulos por empresa se gestiona en el módulo <strong>Configuración</strong> de cada empresa.</p>
      </div>

      <h2 className="font-semibold text-[var(--foreground)] mb-3">Usuarios Admin por empresa</h2>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-left">
          <thead className="bg-[var(--card)]">
            <tr>
              <th className="p-3 font-medium">Usuario</th>
              <th className="p-3 font-medium">Empresa</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a: any) => (
              <tr key={a.id} className="border-t border-[var(--border)]">
                <td className="p-3">{a.username}</td>
                <td className="p-3">{a.company?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {admins.length === 0 && <p className="py-6 text-center text-[var(--muted)]">No hay usuarios admin aún.</p>}

      <h2 className="font-semibold text-[var(--foreground)] mt-8 mb-3">Empresas</h2>
      <ul className="space-y-2">
        {companies.map((c) => (
          <li key={c.id} className="p-3 rounded-lg bg-[var(--card)] border border-[var(--border)]">{c.name}</li>
        ))}
      </ul>
    </div>
  );
}
