import { createContext, useContext, useState, useCallback, createElement, type ReactNode } from 'react';

export interface ToastOptions {
  type: 'success' | 'warning' | 'danger';
  message: string;
  action?: { label: string; onClick: () => void };
}

export interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (options: ToastOptions) => void;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((options: ToastOptions) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { ...options, id }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return createElement(ToastContext.Provider, { value: { toasts, toast, dismiss } }, children);
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return { toast: ctx.toast };
}
