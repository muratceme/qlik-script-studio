import { create } from 'zustand';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = 'success') => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, tone: Toast['tone'] = 'success'): void {
  useToasts.getState().push(message, tone);
}

export function ToastViewport() {
  const { toasts, dismiss } = useToasts();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm shadow-lg"
        >
          {t.tone === 'success' ? (
            <CheckCircle2 className="size-4 text-success" />
          ) : (
            <AlertTriangle className="size-4 text-danger" />
          )}
          <span>{t.message}</span>
          <button
            type="button"
            className="ml-1 text-fg-subtle hover:text-fg"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
