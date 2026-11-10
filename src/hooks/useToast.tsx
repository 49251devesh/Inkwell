import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export type ToastTone = 'note' | 'warning';

interface ToastItem {
  id: string;
  title: string;
  detail?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (title: string, detail?: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (title: string, detail?: string, tone: ToastTone = 'note') => {
      const id = `slip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { id, title, detail, tone }]);
      window.setTimeout(() => {
        dismiss(id);
      }, 4200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Atelier notifications"
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[70] flex flex-col gap-3 pointer-events-none max-w-sm w-[calc(100vw-2rem)]"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast, idx) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 22, rotate: idx % 2 === 0 ? -1.8 : 1.8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, rotate: idx % 2 === 0 ? -0.8 : 0.8, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.94, transition: { duration: 0.2 } }}
              transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto relative px-4 py-3.5 shadow-xl border overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor:
                  toast.tone === 'warning'
                    ? 'var(--accent-primary)'
                    : 'var(--border-brass)',
                boxShadow: 'var(--shadow-stacked)',
              }}
            >
              {/* Antique Brass Fastener / Paper Pin in corner */}
              <div
                aria-hidden="true"
                className="absolute top-0 left-5 w-4 h-1.5 rounded-b-xs border-b border-x"
                style={{
                  backgroundColor: 'var(--accent-brass)',
                  borderColor: 'var(--brass-readable)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }}
              />

              {/* Faint watermark border line */}
              <div
                aria-hidden="true"
                className="absolute inset-1 border pointer-events-none opacity-40"
                style={{ borderColor: 'var(--border-hairline)' }}
              />

              {/* Slip Header & Content */}
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    aria-hidden="true"
                    className="text-sm leading-none mt-1 select-none shrink-0"
                    style={{
                      color:
                        toast.tone === 'warning'
                          ? 'var(--accent-primary)'
                          : 'var(--accent-brass)',
                    }}
                  >
                    ❦
                  </span>
                  <div className="min-w-0">
                    <span className="small-caps-meta text-[10px] block opacity-75" style={{ color: 'var(--accent-brass)' }}>
                      Atelier Despatch · Slip
                    </span>
                    <p
                      className="font-display text-sm font-semibold leading-snug"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {toast.title}
                    </p>
                    {toast.detail && (
                      <p
                        className="text-xs font-manuscript leading-relaxed mt-0.5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {toast.detail}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss slip"
                  className="p-1 -mr-1 -mt-1 rounded transition-colors hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.4} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
