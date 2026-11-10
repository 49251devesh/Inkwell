import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { CornerOrnament, WaxSeal } from '../ornaments/Ornaments';

interface UnfoldingPaperDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  eyebrow?: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  sealMonogram?: string;
}

export const UnfoldingPaperDialog: React.FC<UnfoldingPaperDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  eyebrow = 'Atelier Registry · Written Decree',
  description,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Preserve Record',
  isDestructive = true,
  sealMonogram = '❦',
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unfold-dialog-title"
        >
          {/* Dimmed Study Candlelight Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
          />

          {/* 3D Unfolding Paper Sheet */}
          <motion.div
            initial={{ opacity: 0, rotateX: -65, scaleY: 0.25, y: -28 }}
            animate={{ opacity: 1, rotateX: 0, scaleY: 1, y: 0 }}
            exit={{ opacity: 0, rotateX: -55, scaleY: 0.35, y: -20 }}
            transition={{
              duration: 0.38,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{
              transformOrigin: 'top center',
              perspective: '1200px',
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-brass)',
              boxShadow: 'var(--shadow-stacked)',
            }}
            className="relative z-10 w-full max-w-lg border p-6 sm:p-8 my-auto overflow-hidden"
          >
            {/* Brass Corner Ornaments */}
            <CornerOrnament position="tl" />
            <CornerOrnament position="tr" />
            <CornerOrnament position="bl" />
            <CornerOrnament position="br" />

            {/* Faint Horizontal Paper Crease Lines (Unfolded Document) */}
            <div
              aria-hidden="true"
              className="absolute left-6 right-6 top-1/3 h-px pointer-events-none opacity-40"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, var(--border-hairline) 15%, var(--border-brass) 50%, var(--border-hairline) 85%, transparent 100%)',
              }}
            />
            <div
              aria-hidden="true"
              className="absolute left-6 right-6 top-2/3 h-px pointer-events-none opacity-40"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, var(--border-hairline) 15%, var(--border-brass) 50%, var(--border-hairline) 85%, transparent 100%)',
              }}
            />

            {/* Header: Eyebrow + Wax Seal & Close */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b relative z-10" style={{ borderColor: 'var(--border-hairline)' }}>
              <div>
                <p className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                  {eyebrow}
                </p>
                <h3
                  id="unfold-dialog-title"
                  className="font-display text-xl sm:text-2xl font-medium mt-1 leading-snug"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {title}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <WaxSeal monogram={sealMonogram} size={42} className="hidden sm:block" />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close decree"
                  className="p-1.5 transition-opacity hover:opacity-70 focus-visible:outline-2 cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-5 h-5" strokeWidth={1.4} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="py-5 text-sm sm:text-base leading-relaxed relative z-10 space-y-3" style={{ color: 'var(--text-secondary)' }}>
              {isDestructive && (
                <div
                  className="flex items-start gap-2.5 p-3 rounded-sm border text-xs"
                  style={{
                    backgroundColor: 'var(--burgundy-wash)',
                    borderColor: 'var(--border-brass)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span>This revision cannot be undone once struck from your ledger.</span>
                </div>
              )}
              <div>{description}</div>
            </div>

            {/* Actions: Cancel (Preserve) vs Confirm (Strike) */}
            <div
              className="pt-4 border-t flex flex-wrap items-center justify-end gap-3 relative z-10"
              style={{ borderColor: 'var(--border-hairline)' }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-manuscript italic cursor-pointer transition-opacity hover:opacity-75"
                style={{ color: 'var(--text-secondary)' }}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="px-5 py-2.5 text-sm font-manuscript tracking-wide cursor-pointer transition-colors whitespace-nowrap rounded-sm"
                style={{
                  backgroundColor: isDestructive ? 'var(--accent-primary)' : 'var(--text-primary)',
                  color: '#F4EFE5',
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
