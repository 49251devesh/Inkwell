import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Chapter } from '../../types/inkwell';
import { useInkwell } from '../../store/inkwellStore';
import { useToast } from '../../hooks/useToast';
import { toRoman } from '../../lib/formatters';
import { CornerOrnament } from '../ornaments/Ornaments';

interface EditChapterDialogProps {
  chapter: Chapter | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (chapter: Chapter) => void;
}

export const EditChapterDialog: React.FC<EditChapterDialogProps> = ({
  chapter,
  open,
  onClose,
  onSaved,
}) => {
  const { updateChapter } = useInkwell();
  const { notify } = useToast();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title);
      setNotes(chapter.notes ?? '');
      setError(null);
    }
  }, [chapter, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!chapter) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Chapter requires a title.');
      return;
    }

    updateChapter(chapter.id, {
      title: title.trim(),
      notes: notes.trim(),
    });

    notify('Folio Retitled', `“${title.trim()}” folio details updated.`);
    onSaved?.({
      ...chapter,
      title: title.trim(),
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-chapter-heading"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
          />

          {/* Unfolding Paper Modal */}
          <motion.div
            initial={{ opacity: 0, scaleY: 0.85, rotateX: -14, y: -20 }}
            animate={{ opacity: 1, scaleY: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.88, rotateX: -10, y: -16 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            style={{
              transformOrigin: 'top center',
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-brass)',
              boxShadow: 'var(--shadow-stacked)',
            }}
            className="relative z-10 w-full max-w-lg border p-6 sm:p-8 my-auto"
          >
            <CornerOrnament position="tl" />
            <CornerOrnament position="tr" />
            <CornerOrnament position="bl" />
            <CornerOrnament position="br" />

            <div className="flex items-start justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
              <div>
                <p className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                  Folio {toRoman(chapter.order)} · Chapter Revision
                </p>
                <h3
                  id="edit-chapter-heading"
                  className="font-display text-2xl font-medium mt-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Edit Folio Inscription
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-1.5 transition-opacity hover:opacity-70 focus-visible:outline-2 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" strokeWidth={1.3} />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="ch-edit-title"
                  className="block small-caps-meta text-xs mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Chapter Title
                </label>
                <input
                  id="ch-edit-title"
                  type="text"
                  autoFocus
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full px-3.5 py-2 text-base font-manuscript border focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: error ? 'var(--accent-primary)' : 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
                {error && (
                  <p className="mt-1 text-xs italic" style={{ color: 'var(--accent-primary)' }}>
                    {error}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="ch-edit-notes"
                  className="block small-caps-meta text-xs mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Folio Notes or Scene Outline (Optional)
                </label>
                <textarea
                  id="ch-edit-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Plot notes, scene goals, or character motifs for this folio..."
                  className="w-full px-3.5 py-2 text-sm font-manuscript border resize-none focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--border-hairline)' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-manuscript italic cursor-pointer transition-opacity hover:opacity-75"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-manuscript tracking-wide cursor-pointer transition-colors whitespace-nowrap rounded-sm"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#F4EFE5',
                  }}
                >
                  Update Folio
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
