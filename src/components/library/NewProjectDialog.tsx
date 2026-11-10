import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { CoverPaletteId, Project } from '../../types/inkwell';
import { COVER_PALETTES, formatWordCount } from '../../lib/formatters';
import { useInkwell } from '../../store/inkwellStore';
import { useToast } from '../../hooks/useToast';
import { CornerOrnament } from '../ornaments/Ornaments';

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (project: Project) => void;
}

interface FormErrors {
  title?: string;
  genre?: string;
  wordGoal?: string;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const { createProject, data } = useInkwell();
  const { notify } = useToast();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [genre, setGenre] = useState('Literary Fiction');
  const [synopsis, setSynopsis] = useState('');
  const [coverPalette, setCoverPalette] =
    useState<CoverPaletteId>('burgundy-morocco');
  const [wordGoal, setWordGoal] = useState('80000');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const resetForm = () => {
    setTitle('');
    setSubtitle('');
    setGenre('Literary Fiction');
    setSynopsis('');
    setCoverPalette('burgundy-morocco');
    setWordGoal('80000');
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: FormErrors = {};
    if (!title.trim()) {
      nextErrors.title = 'A manuscript requires a title before it can be bound.';
    } else if (title.trim().length < 2) {
      nextErrors.title = 'Please enter at least two characters for the title.';
    }
    if (!genre.trim()) {
      nextErrors.genre = 'Specify a literary genre or form.';
    }
    const parsedGoal = Number(wordGoal);
    if (!Number.isFinite(parsedGoal) || parsedGoal < 1000) {
      nextErrors.wordGoal = 'Target length must be at least 1,000 words.';
    } else if (parsedGoal > 500000) {
      nextErrors.wordGoal = 'Target length cannot exceed 500,000 words.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const created = createProject({
      title,
      subtitle,
      genre,
      synopsis:
        synopsis.trim() ||
        'A fresh manuscript volume resting on the study shelf, awaiting its opening scene.',
      coverPalette,
      wordGoal: Math.round(parsedGoal),
    });

    notify(
      'New Volume Bound',
      `“${created.title}” has been shelved in The Library.`
    );
    resetForm();
    onCreated?.(created);
    onClose();
  };

  const activePalette = COVER_PALETTES[coverPalette];

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-volume-heading"
        >
          {/* Dimmed Study Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-[2px]"
          />

          {/* Unfolding Paper Modal */}
          <motion.div
            initial={{ opacity: 0, scaleY: 0.86, rotateX: -12, y: -16 }}
            animate={{ opacity: 1, scaleY: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.9, rotateX: -8, y: -12 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            style={{
              transformOrigin: 'top center',
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-brass)',
              boxShadow: 'var(--shadow-stacked)',
            }}
            className="relative z-10 w-full max-w-2xl border p-6 sm:p-9 my-auto"
          >
            <CornerOrnament position="tl" />
            <CornerOrnament position="tr" />
            <CornerOrnament position="bl" />
            <CornerOrnament position="br" />

            <div className="flex items-start justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
              <div>
                <p className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                  Bindery Commission
                </p>
                <h2
                  id="new-volume-heading"
                  className="font-display text-2xl sm:text-3xl font-medium mt-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Bind a New Manuscript
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-2 transition-opacity hover:opacity-70 focus-visible:outline-2"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" strokeWidth={1.3} />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-6 grid grid-cols-1 md:grid-cols-[156px_1fr] gap-7">
              {/* Live Mini Cover Preview */}
              <div className="flex flex-col items-center">
                <div
                  className="relative w-[136px] h-[204px] rounded-r-[3px] rounded-l-[2px] p-3 pl-5 flex flex-col justify-between transition-colors duration-300"
                  style={{
                    backgroundColor: activePalette.clothHex,
                    boxShadow: 'var(--shadow-book)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-3"
                    style={{ backgroundColor: activePalette.spineHex }}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-2 left-4 pointer-events-none"
                    style={{ border: `1px solid ${activePalette.foilHex}55` }}
                  />
                  <span
                    className="font-mono-tabular text-[9px] tracking-[0.18em] uppercase"
                    style={{ color: `${activePalette.foilHex}BF` }}
                  >
                    Folio I
                  </span>
                  <div className="my-auto">
                    <p
                      className="font-display text-sm leading-tight font-medium break-words"
                      style={{ color: activePalette.foilHex }}
                    >
                      {title.trim() || 'Untitled Volume'}
                    </p>
                    <p
                      className="small-caps-meta text-[9px] mt-1.5 truncate"
                      style={{ color: `${activePalette.foilHex}B3` }}
                    >
                      {genre.trim() || 'Fiction'}
                    </p>
                  </div>
                  <span
                    className="text-[10px] italic truncate"
                    style={{ color: `${activePalette.foilHex}A6` }}
                  >
                    {data.settings.authorPenName}
                  </span>
                </div>
                <span
                  className="text-xs font-manuscript italic mt-3 text-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {activePalette.name}
                </span>
              </div>

              {/* Fields */}
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="vol-title"
                    className="block small-caps-meta text-xs mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Title of the Work
                  </label>
                  <input
                    id="vol-title"
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                    }}
                    placeholder="e.g., The Salt Clockmaker"
                    className="w-full px-3.5 py-2.5 text-base font-manuscript border transition-colors focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: errors.title ? 'var(--accent-primary)' : 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  {errors.title && (
                    <p className="mt-1 text-xs italic" style={{ color: 'var(--accent-primary)' }}>
                      {errors.title}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="vol-genre"
                      className="block small-caps-meta text-xs mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Genre or Form
                    </label>
                    <input
                      id="vol-genre"
                      type="text"
                      value={genre}
                      onChange={(e) => {
                        setGenre(e.target.value);
                        if (errors.genre) setErrors((prev) => ({ ...prev, genre: undefined }));
                      }}
                      placeholder="Literary Fiction"
                      className="w-full px-3.5 py-2 text-sm font-manuscript border focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: errors.genre ? 'var(--accent-primary)' : 'var(--border-hairline)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    {errors.genre && (
                      <p className="mt-1 text-xs italic" style={{ color: 'var(--accent-primary)' }}>
                        {errors.genre}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="vol-goal"
                      className="block small-caps-meta text-xs mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Word Goal
                    </label>
                    <input
                      id="vol-goal"
                      type="number"
                      min={1000}
                      max={500000}
                      step={1000}
                      value={wordGoal}
                      onChange={(e) => {
                        setWordGoal(e.target.value);
                        if (errors.wordGoal) setErrors((prev) => ({ ...prev, wordGoal: undefined }));
                      }}
                      className="w-full px-3.5 py-2 text-sm font-mono-tabular border focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: errors.wordGoal ? 'var(--accent-primary)' : 'var(--border-hairline)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    {errors.wordGoal ? (
                      <p className="mt-1 text-xs italic" style={{ color: 'var(--accent-primary)' }}>
                        {errors.wordGoal}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] font-mono-tabular" style={{ color: 'var(--text-muted)' }}>
                        ≈ {formatWordCount(Math.round((Number(wordGoal) || 0) / 250))} pages
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="vol-subtitle"
                    className="block small-caps-meta text-xs mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Subtitle (Optional)
                  </label>
                  <input
                    id="vol-subtitle"
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="A Chronicle in Three Winters"
                    className="w-full px-3.5 py-2 text-sm font-manuscript border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <span
                    className="block small-caps-meta text-xs mb-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Cloth & Leather Binding
                  </span>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {Object.values(COVER_PALETTES).map((pal) => {
                      const active = pal.id === coverPalette;
                      return (
                        <button
                          key={pal.id}
                          type="button"
                          onClick={() => setCoverPalette(pal.id)}
                          aria-label={`Select ${pal.name} binding`}
                          aria-pressed={active}
                          className="w-8 h-8 rounded-sm transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
                          style={{
                            backgroundColor: pal.clothHex,
                            boxShadow: active
                              ? '0 0 0 2px var(--bg-surface), 0 0 0 3.5px var(--accent-brass)'
                              : 'inset 0 0 0 1px rgba(255,255,255,0.2)',
                            transform: active ? 'scale(1.08)' : 'scale(1)',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="vol-synopsis"
                    className="block small-caps-meta text-xs mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Synopsis or Premise
                  </label>
                  <textarea
                    id="vol-synopsis"
                    rows={3}
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    placeholder="Briefly note the central tension, setting, or premise..."
                    className="w-full px-3.5 py-2 text-sm font-manuscript border resize-none focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-4 border-t" style={{ borderColor: 'var(--border-hairline)' }}>
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
                    className="px-6 py-2.5 text-sm font-manuscript tracking-wide cursor-pointer transition-colors whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: '#F4EFE5',
                    }}
                  >
                    Bind Volume
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
