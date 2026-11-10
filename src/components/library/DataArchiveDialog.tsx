import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, RotateCcw, Upload, X } from 'lucide-react';
import { useInkwell } from '../../store/inkwellStore';
import { useToast } from '../../hooks/useToast';
import { CornerOrnament } from '../ornaments/Ornaments';

interface DataArchiveDialogProps {
  open: boolean;
  onClose: () => void;
}

export const DataArchiveDialog: React.FC<DataArchiveDialogProps> = ({
  open,
  onClose,
}) => {
  const { exportLibraryJson, importLibraryJson, resetToSampleLibrary } =
    useInkwell();
  const { notify } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  useEffect(() => {
    if (!open) {
      setImportError(null);
      setConfirmRestore(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleDownloadJson = () => {
    const json = exportLibraryJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inkwell-archive-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify(
      'Archive Exported',
      'Your complete library and manuscripts have been saved as JSON.'
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const text = await file.text();
    const res = importLibraryJson(text);
    if (res.ok) {
      notify(
        'Archive Restored',
        `Loaded volumes from ${file.name} into The Library.`
      );
      onClose();
    } else {
      setImportError(res.error);
    }
    e.target.value = '';
  };

  const handleRestoreSample = () => {
    if (!confirmRestore) {
      setConfirmRestore(true);
      return;
    }
    resetToSampleLibrary();
    notify(
      'Sample Library Restored',
      'The three sample manuscripts and dossiers have been reshelved.'
    );
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-dialog-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, scaleY: 0.88, rotateX: -10, y: -12 }}
            animate={{ opacity: 1, scaleY: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.9, y: -8 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            style={{
              transformOrigin: 'top center',
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-brass)',
              boxShadow: 'var(--shadow-stacked)',
            }}
            className="relative z-10 w-full max-w-lg border p-6 sm:p-8"
          >
            <CornerOrnament position="tl" />
            <CornerOrnament position="tr" />
            <CornerOrnament position="bl" />
            <CornerOrnament position="br" />

            <div
              className="flex items-start justify-between pb-4 border-b"
              style={{ borderColor: 'var(--border-hairline)' }}
            >
              <div>
                <p
                  className="small-caps-meta text-xs"
                  style={{ color: 'var(--accent-brass)' }}
                >
                  Archival Vault
                </p>
                <h2
                  id="archive-dialog-title"
                  className="font-display text-2xl font-medium mt-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Export & Import Library
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close archive dialog"
                className="p-2 hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" strokeWidth={1.3} />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <p
                className="text-base leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                Every volume, chapter, character dossier, and world record lives
                locally in your browser’s study ledger. Export a dated JSON
                archive at any time or restore a previous folio.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-manuscript cursor-pointer transition-colors"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#F4EFE5',
                  }}
                >
                  <Download className="w-4 h-4" strokeWidth={1.4} />
                  <span>Export Archive (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-manuscript border cursor-pointer transition-colors hover:opacity-85"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-brass)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Upload className="w-4 h-4" strokeWidth={1.4} />
                  <span>Import Archive (.json)</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {importError && (
                <p
                  className="text-sm italic px-3 py-2 border"
                  style={{
                    color: 'var(--accent-primary)',
                    borderColor: 'var(--accent-primary)',
                    backgroundColor: 'var(--burgundy-wash)',
                  }}
                >
                  {importError}
                </p>
              )}

              <div
                className="pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ borderColor: 'var(--border-hairline)' }}
              >
                <span
                  className="text-xs font-manuscript italic"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {confirmRestore
                    ? 'Click again to replace current shelves with sample manuscripts.'
                    : 'Reset local storage to the three seeded sample novels.'}
                </span>
                <button
                  type="button"
                  onClick={handleRestoreSample}
                  className="inline-flex items-center gap-1.5 text-xs small-caps-meta cursor-pointer whitespace-nowrap shrink-0 underline underline-offset-4"
                  style={{
                    color: confirmRestore
                      ? 'var(--accent-primary)'
                      : 'var(--text-secondary)',
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.4} />
                  <span>
                    {confirmRestore ? 'Confirm Restore' : 'Restore Samples'}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
