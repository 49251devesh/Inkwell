import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { Chapter, Project } from '../../types/inkwell';
import { COVER_PALETTES, formatWordCount, toRoman } from '../../lib/formatters';
import { CornerOrnament } from '../ornaments/Ornaments';
import { useInkwell } from '../../store/inkwellStore';
import { useToast } from '../../hooks/useToast';
import { EditProjectDialog } from '../library/EditProjectDialog';
import { EditChapterDialog } from './EditChapterDialog';
import { UnfoldingPaperDialog } from '../common/UnfoldingPaperDialog';

interface ChapterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  chapters: Chapter[];
  activeChapterId: string;
  onSelectChapter: (chapterId: string) => void;
  onCreateChapter: (title: string) => void;
  onDeleteChapter: (chapterId: string) => void;
  projects: Project[];
  onSwitchProject: (projectId: string) => void;
}

export const ChapterDrawer: React.FC<ChapterDrawerProps> = ({
  isOpen,
  onClose,
  project,
  chapters,
  activeChapterId,
  onSelectChapter,
  onCreateChapter,
  onDeleteChapter,
  projects,
  onSwitchProject,
}) => {
  const { reorderChapters } = useInkwell();
  const { notify } = useToast();

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // Modals for editing and striking
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [chapterToEdit, setChapterToEdit] = useState<Chapter | null>(null);
  const [chapterToDelete, setChapterToDelete] = useState<Chapter | null>(null);

  // Drag and drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const palette = COVER_PALETTES[project.coverPalette] ?? COVER_PALETTES['burgundy-morocco'];
  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
  const progressPct = Math.min(100, Math.round((totalWords / Math.max(1, project.wordGoal)) * 100));

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      onCreateChapter(newTitle.trim());
      setNewTitle('');
      setIsAdding(false);
    }
  };

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDragOverId(null);

    if (!sourceId || sourceId === targetId) return;

    const currentOrder = chapters.map((c) => c.id);
    const sourceIdx = currentOrder.indexOf(sourceId);
    const targetIdx = currentOrder.indexOf(targetId);

    if (sourceIdx === -1 || targetIdx === -1) return;

    const newOrder = [...currentOrder];
    newOrder.splice(sourceIdx, 1);
    newOrder.splice(targetIdx, 0, sourceId);

    reorderChapters(project.id, newOrder);
    notify('Folios Reordered', 'Manuscript binding order updated.');
  };

  const handleMoveChapter = (chapterId: string, direction: 'up' | 'down') => {
    const currentOrder = chapters.map((c) => c.id);
    const index = currentOrder.indexOf(chapterId);
    if (index === -1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIdx, 0, moved);

    reorderChapters(project.id, newOrder);
    notify('Folio Shifted', `Chapter moved ${direction === 'up' ? 'forward' : 'backward'}.`);
  };

  const handleConfirmStrikeChapter = () => {
    if (!chapterToDelete) return;
    onDeleteChapter(chapterToDelete.id);
    setChapterToDelete(null);
  };

  const [mounted, setMounted] = useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/55 backdrop-blur-[2px]"
              style={{ zIndex: 99990 }}
            />

            {/* Drawer Sidebar */}
            <motion.aside
              initial={{ x: '-100%', opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0.8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Table of Contents Drawer"
              className="fixed top-0 bottom-0 left-0 w-full sm:w-[420px] md:w-[450px] border-r flex flex-col shadow-2xl overflow-hidden"
              style={{
                zIndex: 99999,
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-brass)',
                boxShadow: 'var(--shadow-stacked)',
              }}
            >
              <CornerOrnament position="tl" />
              <CornerOrnament position="bl" />

              {/* Drawer Header */}
              <div
                className="p-5 sm:p-6 pb-4 border-b relative"
                style={{
                  borderColor: 'var(--border-hairline)',
                  backgroundColor: 'var(--bg-canvas)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Mini Book Cloth Spine Chip */}
                    <span
                      className="w-3.5 h-7 rounded-sm shrink-0 border border-white/20 shadow-sm"
                      style={{ backgroundColor: palette.clothHex }}
                      title={palette.name}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                        Table of Contents
                      </p>
                      <h2
                        className="font-display text-lg font-medium truncate leading-tight mt-0.5"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {project.title}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsEditProjectOpen(true)}
                      title="Revise Volume Details"
                      aria-label="Edit Volume"
                      className="p-1.5 rounded border transition-colors cursor-pointer hover:bg-[var(--burgundy-wash)]"
                      style={{
                        borderColor: 'var(--border-hairline)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Settings className="w-3.5 h-3.5" strokeWidth={1.4} />
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Close Table of Contents"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-manuscript rounded border transition-colors cursor-pointer hover:bg-[var(--burgundy-wash)] focus-visible:outline-2"
                      style={{
                        borderColor: 'var(--border-brass)',
                        backgroundColor: 'var(--bg-canvas)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span className="font-medium">Close</span>
                    </button>
                  </div>
                </div>

                {/* Volume Progress & Reading Cadence */}
                <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-hairline)' }}>
                  <div className="flex items-baseline justify-between text-xs font-mono-tabular">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {formatWordCount(totalWords)} / {formatWordCount(project.wordGoal)} words
                    </span>
                    <span style={{ color: 'var(--accent-brass)' }}>{progressPct}% complete</span>
                  </div>
                  <div className="mt-1.5 h-[3px] w-full bg-[var(--border-hairline)] overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${Math.max(2, progressPct)}%`,
                        backgroundColor: 'var(--accent-primary)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Quick Volume Switcher dropdown */}
              {projects.length > 1 && (
                <div
                  className="px-5 py-2.5 border-b flex items-center justify-between gap-2 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-recessed)',
                    borderColor: 'var(--border-hairline)',
                  }}
                >
                  <span className="small-caps-meta" style={{ color: 'var(--text-muted)' }}>
                    Active Volume:
                  </span>
                  <select
                    value={project.id}
                    onChange={(e) => onSwitchProject(e.target.value)}
                    aria-label="Switch volume"
                    className="bg-transparent font-manuscript text-xs cursor-pointer focus:outline-none border-b truncate max-w-[200px]"
                    style={{
                      borderColor: 'var(--border-brass)',
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
              )}

              {/* Chapter List with Drag & Drop Reordering */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-1.5">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="small-caps-meta text-xs" style={{ color: 'var(--text-muted)' }}>
                    Folios ({chapters.length})
                  </span>
                  <span className="text-xs font-manuscript italic" style={{ color: 'var(--text-muted)' }}>
                    Drag grip to reorder sequence
                  </span>
                </div>

                {chapters.map((ch, idx) => {
                  const isActive = ch.id === activeChapterId;
                  const isDragging = draggingId === ch.id;
                  const isDragOver = dragOverId === ch.id;

                  return (
                    <div
                      key={ch.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ch.id)}
                      onDragOver={(e) => handleDragOver(e, ch.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, ch.id)}
                      className={`group relative flex items-center justify-between rounded-sm transition-colors text-left border ${
                        isDragging
                          ? 'opacity-40 border-dashed border-amber-600'
                          : isDragOver
                          ? 'border-[var(--accent-primary)] bg-[var(--burgundy-wash)]'
                          : isActive
                          ? 'border-[var(--border-brass)] bg-[var(--burgundy-wash)]'
                          : 'border-transparent hover:bg-[var(--burgundy-wash)]/50'
                      }`}
                    >
                      {/* Active Ribbon Tab */}
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1 bottom-1 w-1 rounded-r-sm"
                          style={{ backgroundColor: 'var(--accent-primary)' }}
                        />
                      )}

                      {/* Drag Handle */}
                      <div
                        title="Drag folio to reorder"
                        className="pl-2 cursor-grab active:cursor-grabbing text-[var(--accent-brass)] opacity-40 group-hover:opacity-100 transition-opacity"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      {/* Chapter Button */}
                      <button
                        type="button"
                        onClick={() => onSelectChapter(ch.id)}
                        className="flex-1 py-2 pl-2 pr-1 flex items-baseline gap-2 min-w-0 cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-1"
                      >
                        <span
                          className="font-mono-tabular text-xs w-6 shrink-0"
                          style={{
                            color: isActive ? 'var(--accent-primary)' : 'var(--accent-brass)',
                          }}
                        >
                          {toRoman(ch.order)}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="font-manuscript text-[15px] font-medium leading-snug truncate"
                            style={{
                              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                            }}
                          >
                            {ch.title}
                          </p>
                          <p className="font-mono-tabular text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {formatWordCount(ch.wordCount)} words
                          </p>
                        </div>
                      </button>

                      {/* Actions: Move Up/Down, Edit, Strike */}
                      <div className="pr-2 flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        {/* Up/Down buttons */}
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveChapter(ch.id, 'up')}
                            title="Move up"
                            className="p-0.5 hover:text-[var(--accent-primary)] disabled:opacity-20 cursor-pointer disabled:pointer-events-none"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === chapters.length - 1}
                            onClick={() => handleMoveChapter(ch.id, 'down')}
                            title="Move down"
                            className="p-0.5 hover:text-[var(--accent-primary)] disabled:opacity-20 cursor-pointer disabled:pointer-events-none"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Edit chapter title & notes */}
                        <button
                          type="button"
                          onClick={() => setChapterToEdit(ch)}
                          title="Edit Folio Title & Notes"
                          aria-label={`Edit ${ch.title}`}
                          className="p-1 rounded hover:bg-[var(--burgundy-wash)] cursor-pointer"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <Pencil className="w-3 h-3" strokeWidth={1.4} />
                        </button>

                        {/* Delete Chapter (if more than 1) */}
                        {chapters.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setChapterToDelete(ch)}
                            title="Strike chapter from volume"
                            aria-label={`Delete ${ch.title}`}
                            className="p-1 rounded hover:text-rose-600 cursor-pointer"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Trash2 className="w-3 h-3" strokeWidth={1.4} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer / Add Chapter Section */}
              <div
                className="p-4 sm:p-5 border-t"
                style={{
                  borderColor: 'var(--border-hairline)',
                  backgroundColor: 'var(--bg-recessed)',
                }}
              >
                {isAdding ? (
                  <form onSubmit={handleAddSubmit} className="space-y-2.5">
                    <label htmlFor="drawer-new-ch" className="block small-caps-meta text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Title of Next Chapter
                    </label>
                    <input
                      id="drawer-new-ch"
                      type="text"
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder={`Chapter ${toRoman(chapters.length + 1)}`}
                      className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-brass)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAdding(false);
                          setNewTitle('');
                        }}
                        className="px-3 py-1 text-xs font-manuscript italic cursor-pointer hover:opacity-75"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newTitle.trim()}
                        className="px-3.5 py-1 text-xs font-manuscript rounded-sm cursor-pointer disabled:opacity-40 transition-colors"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: '#F4EFE5',
                        }}
                      >
                        Bind Chapter
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAdding(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-manuscript border rounded-sm cursor-pointer transition-colors hover:opacity-90"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-brass)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Bind Next Chapter</span>
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Edit Volume Dialog from Drawer */}
      <EditProjectDialog
        project={project}
        open={isEditProjectOpen}
        onClose={() => setIsEditProjectOpen(false)}
      />

      {/* Edit Chapter Dialog from Drawer */}
      <EditChapterDialog
        chapter={chapterToEdit}
        open={Boolean(chapterToEdit)}
        onClose={() => setChapterToEdit(null)}
      />

      {/* Unfolding Paper Confirmation Dialog for Striking Chapter */}
      <UnfoldingPaperDialog
        open={Boolean(chapterToDelete)}
        onClose={() => setChapterToDelete(null)}
        onConfirm={handleConfirmStrikeChapter}
        eyebrow="Folio Strike Decree"
        title={chapterToDelete ? `Strike “${chapterToDelete.title}” from Binding?` : ''}
        confirmLabel="Strike Folio"
        cancelLabel="Keep Bound"
        isDestructive={true}
        description={
          chapterToDelete && (
            <p>
              Are you sure you wish to strike{' '}
              <strong className="text-[var(--text-primary)] font-medium">“{chapterToDelete.title}”</strong> from
              this volume? Its {formatWordCount(chapterToDelete.wordCount)} words will be permanently removed.
            </p>
          )
        }
      />
    </>,
    document.body
  );
};
