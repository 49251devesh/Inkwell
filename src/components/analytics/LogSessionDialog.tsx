import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Feather, X } from 'lucide-react';
import { Project } from '../../types/inkwell';
import { CornerOrnament, WaxSeal } from '../ornaments/Ornaments';

interface LogSessionDialogProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  activeProjectId: string;
  onLogWords: (projectId: string, words: number) => void;
}

export const LogSessionDialog: React.FC<LogSessionDialogProps> = ({
  open,
  onClose,
  projects,
  activeProjectId,
  onLogWords,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || projects[0]?.id || '');
  const [wordsInput, setWordsInput] = useState('750');
  const [minutesInput, setMinutesInput] = useState('45');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(wordsInput, 10);
    if (isNaN(count) || count <= 0) {
      setError('Please enter a positive word count.');
      return;
    }

    onLogWords(selectedProjectId, count);
    onClose();
  };

  const handleQuickAdd = (amount: number) => {
    const current = parseInt(wordsInput, 10) || 0;
    setWordsInput(String(current + amount));
    setError(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, scaleY: 0.88, rotateX: -12 }}
            animate={{ opacity: 1, scaleY: 1, rotateX: 0 }}
            exit={{ opacity: 0, scaleY: 0.9, rotateX: -8 }}
            transition={{ duration: 0.3 }}
            style={{
              transformOrigin: 'top center',
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-brass)',
            }}
            className="relative z-10 w-full max-w-md border p-6 space-y-4 shadow-2xl"
          >
            <CornerOrnament position="tl" />
            <CornerOrnament position="tr" />
            <CornerOrnament position="bl" />
            <CornerOrnament position="br" />

            <div className="flex items-start justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
              <div className="flex items-center gap-2.5">
                <WaxSeal monogram="🖋" size={36} />
                <div>
                  <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                    Study Ledger · Inscription
                  </span>
                  <h3 className="font-display text-xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    Log Writing Session
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-[var(--text-muted)] hover:opacity-70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-manuscript">
              <div>
                <label className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Manuscript Volume
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-manuscript border focus:outline-none cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="text-black">
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Words Inscribed Today
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  autoFocus
                  required
                  value={wordsInput}
                  onChange={(e) => {
                    setWordsInput(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3 py-2 text-base font-mono-tabular border focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: error ? 'var(--accent-primary)' : 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
                {error && <p className="mt-1 text-xs italic text-[var(--accent-primary)]">{error}</p>}

                {/* Quick Add Buttons */}
                <div className="flex items-center gap-1.5 mt-2">
                  {[250, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAdd(amt)}
                      className="px-2 py-1 text-[11px] rounded-xs border hover:bg-[var(--burgundy-wash)] cursor-pointer"
                      style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
                    >
                      +{amt} w
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Minutes Spent at the Desk (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={minutesInput}
                  onChange={(e) => setMinutesInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm font-mono-tabular border focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2.5" style={{ borderColor: 'var(--border-hairline)' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-manuscript italic cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-manuscript rounded-xs cursor-pointer transition-opacity hover:opacity-90 shadow-xs"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#F4EFE5',
                  }}
                >
                  Inscribe in Ledger
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
