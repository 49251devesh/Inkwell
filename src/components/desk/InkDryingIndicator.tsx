import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type InkSaveState = 'clean' | 'typing' | 'drying' | 'dried';

interface InkDryingIndicatorProps {
  status: InkSaveState;
  lastSavedAt?: Date | null;
  className?: string;
}

export const InkDryingIndicator: React.FC<InkDryingIndicatorProps> = ({
  status,
  lastSavedAt,
  className = '',
}) => {
  return (
    <div
      className={`inline-flex items-center gap-2 select-none font-manuscript text-xs ${className}`}
      aria-live="polite"
      aria-label={`Manuscript save state: ${status}`}
    >
      <AnimatePresence mode="wait">
        {status === 'drying' || status === 'typing' ? (
          <motion.div
            key="drying"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-1.5"
            style={{ color: 'var(--accent-primary)' }}
          >
            {/* Animated wet ink droplet pulsing */}
            <span className="relative flex h-2 w-2">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              />
            </span>
            <span className="italic tracking-wide text-xs">
              {status === 'typing' ? 'Fresh ink flowing…' : 'Ink drying…'}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="dried"
            initial={{ opacity: 0, y: 1 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -1 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            <span
              aria-hidden="true"
              className="text-[11px] leading-none"
              style={{ color: 'var(--accent-brass)' }}
            >
              ✦
            </span>
            <span className="small-caps-meta text-[11px] tracking-wider">
              Ink Dried
              {lastSavedAt && (
                <span className="font-mono-tabular font-normal normal-case ml-1 tracking-normal opacity-80">
                  · {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
