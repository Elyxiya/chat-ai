import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'info' | 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const iconMap: Record<ToastType, string> = {
    info: 'ℹ',
    success: '✓',
    error: '✕',
    warning: '⚠',
  };

  const colorMap: Record<ToastType, { bg: string; border: string; text: string }> = {
    info:    { bg: '#1e293b', border: '#3b82f6', text: '#93c5fd' },
    success: { bg: '#1e293b', border: '#22c55e', text: '#86efac' },
    error:   { bg: '#1e293b', border: '#ef4444', text: '#fca5a5' },
    warning: { bg: '#1e293b', border: '#f59e0b', text: '#fcd34d' },
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => {
          const colors = colorMap[toast.type];
          return (
            <div
              key={toast.id}
              style={{
                background: colors.bg,
                borderLeft: `3px solid ${colors.border}`,
                borderRadius: 8,
                padding: '12px 16px',
                color: colors.text,
                fontSize: 14,
                fontFamily: 'system-ui, sans-serif',
                minWidth: 280,
                maxWidth: 380,
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                pointerEvents: 'auto',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                animation: 'toastSlideIn 0.2s ease-out',
              }}
              onClick={() => remove(toast.id)}
            >
              <span style={{ fontSize: 16, opacity: 0.9 }}>{iconMap[toast.type]}</span>
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
