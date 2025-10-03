// src/context/ToastContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
// Inline minimal Toast to remove dependency on deleted components
export type ToastType = {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'error';
  duration?: number;
};
const Toast: React.FC<ToastType> = ({ message, type = 'info' }) => (
  <div
    style={{
      marginTop: 10,
      padding: '10px 12px',
      borderRadius: 8,
      color: '#141414',
      background:
        type === 'success'
          ? '#C8F7C5'
          : type === 'error'
            ? '#FADBD8'
            : '#EAF2FD',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}
  >
    {message}
  </div>
);

interface ToastContextType {
  showToast: (toast: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  const showToast = (toast: ToastType) => {
    setToasts((prev) => {
      const next = [...prev, toast];
      return next.length > 5 ? next.slice(1) : next;
    });

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, toast.duration || 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          zIndex: 9999,
        }}
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
