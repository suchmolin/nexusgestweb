'use client';

import { useState } from 'react';
import { authApi } from '@/lib/api';
import { ActionModal, type ActionModalVariant } from '@/components/ActionModal';

export default function CambiarContrasenaPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionModal, setActionModal] = useState<{ open: boolean; title: string; message: string; variant: ActionModalVariant }>({
    open: false,
    title: '',
    message: '',
    variant: 'info',
  });

  const showActionModal = (title: string, message: string, variant: ActionModalVariant = 'info') =>
    setActionModal({ open: true, title, message, variant });
  const closeActionModal = () => setActionModal((p) => ({ ...p, open: false }));

  const handleSave = async () => {
    if (!currentPassword) {
      showActionModal('Datos incompletos', 'Introduce tu contraseña actual.', 'error');
      return;
    }
    if (!newPassword) {
      showActionModal('Datos incompletos', 'Introduce la nueva contraseña.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showActionModal('Contraseña inválida', 'La nueva contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showActionModal('Confirmación incorrecta', 'La nueva contraseña y la confirmación no coinciden.', 'error');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showActionModal('Contraseña actualizada', 'Tu contraseña se ha cambiado correctamente.', 'success');
    } catch (e) {
      showActionModal('Error al cambiar contraseña', e instanceof Error ? e.message : 'No se pudo cambiar la contraseña', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="max-w-xl space-y-6">
        <section className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)] mb-1">Cambiar contraseña</h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Introduce tu contraseña actual y define una nueva. La nueva contraseña debe tener al menos 6 caracteres.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Contraseña actual *</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Nueva contraseña *</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Mín. 6 caracteres"
                className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Confirmar nueva contraseña *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Repetir contraseña"
                className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-4 rounded-lg bg-[var(--primary)] text-white px-4 py-2 font-medium disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </section>
      </div>
      <ActionModal
        open={actionModal.open}
        onClose={closeActionModal}
        title={actionModal.title}
        message={actionModal.message}
        variant={actionModal.variant}
      />
    </>
  );
}
