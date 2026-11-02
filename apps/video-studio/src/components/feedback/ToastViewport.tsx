'use client';
import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useAppStore } from '@/store';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const tones = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300',
};

export function ToastViewport() {
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) => window.setTimeout(() => dismissToast(toast.id), 4200));
    return () => timers.forEach(window.clearTimeout);
  }, [dismissToast, toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-14 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = icons[toast.kind];
        return (
          <div key={toast.id} className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 shadow-lg backdrop-blur bg-[var(--app-bg)] ${tones[toast.kind]}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 text-xs leading-5 text-[var(--app-text)]">{toast.message}</div>
            <button type="button" onClick={() => dismissToast(toast.id)} className="rounded p-0.5 text-[var(--app-text-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-text)]" aria-label="关闭提示">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}