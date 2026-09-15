import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    info: <Info className="w-4 h-4 text-cyan-400" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    error: <AlertCircle className="w-4 h-4 text-rose-400" />,
  };

  const borders = {
    info: 'border-cyan-500/30 bg-slate-900/95',
    success: 'border-emerald-500/30 bg-slate-900/95',
    warning: 'border-amber-500/30 bg-slate-900/95',
    error: 'border-rose-500/30 bg-slate-900/95',
  };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm text-slate-100 ${
        borders[toast.type]
      } backdrop-blur animate-slide-in`}
    >
      {icons[toast.type]}
      <span className="max-w-xs">{toast.text}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 text-slate-400 hover:text-white rounded transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
