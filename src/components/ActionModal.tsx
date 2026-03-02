'use client';

import React from 'react';
import { IconCheckCircle, IconAlertCircle, IconX } from '@/components/Icons';

export type ActionModalVariant = 'success' | 'error' | 'info';

type ActionModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: ActionModalVariant;
};

export function ActionModal({ open, onClose, title, message, variant = 'info' }: ActionModalProps) {
  if (!open) return null;

  const iconConfig = {
    success: { Icon: IconCheckCircle, bg: 'bg-green-500/10', iconClass: 'text-green-600 dark:text-green-400' },
    error: { Icon: IconX, bg: 'bg-[var(--destructive)]/10', iconClass: 'text-[var(--destructive)]' },
    info: { Icon: IconAlertCircle, bg: 'bg-[var(--primary)]/10', iconClass: 'text-[var(--primary)]' },
  };

  const { Icon, bg, iconClass } = iconConfig[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-modal-title"
    >
      <div
        className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center gap-4 ${bg} rounded-lg p-4`}>
          <Icon className={`w-10 h-10 flex-shrink-0 ${iconClass}`} />
          <div className="min-w-0 flex-1">
            <h2 id="action-modal-title" className="font-semibold text-[var(--foreground)] text-lg">
              {title}
            </h2>
            <p className="text-sm text-[var(--muted)] mt-0.5">{message}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--primary)] text-white px-4 py-2 font-medium hover:opacity-90"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
