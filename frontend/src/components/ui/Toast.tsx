import { useContext } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { ToastContext } from '../../hooks/useToast';

export function Toaster() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  const { toasts, dismiss } = ctx;

  return (
    <Toast.Provider duration={5000} swipeDirection="right">
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          className={`toast toast-${t.type}`}
          onOpenChange={(open) => { if (!open) dismiss(t.id); }}
        >
          <div className="toast-body">
            <Toast.Description className="toast-message">{t.message}</Toast.Description>
            {t.action && (
              <Toast.Action asChild altText={t.action.label}>
                <button className="toast-action" onClick={t.action.onClick}>
                  {t.action.label}
                </button>
              </Toast.Action>
            )}
          </div>
          <Toast.Close className="toast-close" aria-label="Cerrar">×</Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="toast-viewport" />
    </Toast.Provider>
  );
}
