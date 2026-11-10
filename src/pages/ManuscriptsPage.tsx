import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Feather,
  FolderPlus,
  GripVertical,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react';
import { useInkwell } from '../store/inkwellStore';
import { useToast } from '../hooks/useToast';
import { COVER_PALETTES, formatFolioDate, formatWordCount, toRoman } from '../lib/formatters';
import { Chapter, Project } from '../types/inkwell';
import { CornerOrnament, FleuronDivider, WaxSeal } from '../components/ornaments/Ornaments';
import { NewProjectDialog } from '../components/library/NewProjectDialog';
import { EditProjectDialog } from '../components/library/EditProjectDialog';
import { EditChapterDialog } from '../components/desk/EditChapterDialog';
import { UnfoldingPaperDialog } from '../components/common/UnfoldingPaperDialog';
import { EmptyShelfIllustration } from '../components/common/EmptyStateIllustrations';


export const ManuscriptsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    data,
    activeProject,
    selectActiveProject,
    getProjectChapters,
    getProjectWordCount,
    getTotalWords,
    createChapter,
    deleteChapter,
    reorderChapters,
    deleteProject,
  } = useInkwell();
  const { notify } = useToast();

  // Active volume selection
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return activeProject?.id ?? data.projects[0]?.id ?? '';
  });

  const selectedProject = useMemo(() => {
    return (
      data.projects.find((p) => p.id === selectedProjectId) ??
      activeProject ??
      data.projects[0] ??
      null
    );
  }, [selectedProjectId, data.projects, activeProject]);

  const chapters = useMemo(() => {
    if (!selectedProject) return [];
    return getProjectChapters(selectedProject.id);
  }, [selectedProject, getProjectChapters]);

  const totalWordsInLibrary = getTotalWords();
  const selectedProjectWords = selectedProject ? getProjectWordCount(selectedProject.id) : 0;
  const selectedProgressPct = selectedProject
    ? Math.min(100, Math.round((selectedProjectWords / Math.max(1, selectedProject.wordGoal)) * 100))
    : 0;

  // Dialog states
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const [chapterToEdit, setChapterToEdit] = useState<Chapter | null>(null);
  const [chapterToDelete, setChapterToDelete] = useState<Chapter | null>(null);

  // Quick inline chapter creation
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [isAddingChapter, setIsAddingChapter] = useState(false);

  // Drag and drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, chapterId: string) => {
    e.dataTransfer.setData('text/plain', chapterId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(chapterId);
  };

  const handleDragOver = (e: React.DragEvent, chapterId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== chapterId) {
      setDragOverId(chapterId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetChapterId: string) => {
    e.preventDefault();
    const sourceChapterId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDragOverId(null);

    if (!selectedProject || !sourceChapterId || sourceChapterId === targetChapterId) return;

    const currentOrder = chapters.map((c) => c.id);
    const sourceIndex = currentOrder.indexOf(sourceChapterId);
    const targetIndex = currentOrder.indexOf(targetChapterId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const newOrder = [...currentOrder];
    newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, sourceChapterId);

    reorderChapters(selectedProject.id, newOrder);
    notify('Folios Reordered', 'Manuscript binding order updated in ledger.');
  };

  // Accessible move up / move down
  const handleMoveChapter = (chapterId: string, direction: 'up' | 'down') => {
    if (!selectedProject) return;
    const currentOrder = chapters.map((c) => c.id);
    const index = currentOrder.indexOf(chapterId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    reorderChapters(selectedProject.id, newOrder);
    notify('Folio Shifted', `Chapter moved ${direction === 'up' ? 'forward' : 'backward'}.`);
  };

  const handleQuickAddChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    const title = newChapterTitle.trim() || undefined;
    const created = createChapter(selectedProject.id, title);
    setNewChapterTitle('');
    setIsAddingChapter(false);
    notify('New Folio Bound', `“${created.title}” bound into ${selectedProject.title}.`);
  };

  const handleConfirmDeleteProject = () => {
    if (!projectToDelete) return;
    const title = projectToDelete.title;
    deleteProject(projectToDelete.id);
    notify('Volume Struck', `“${title}” removed from study library.`);
    setProjectToDelete(null);
  };

  const handleConfirmDeleteChapter = () => {
    if (!chapterToDelete) return;
    const title = chapterToDelete.title;
    deleteChapter(chapterToDelete.id);
    notify('Folio Struck', `“${title}” struck from manuscript binding.`);
    setChapterToDelete(null);
  };

  const handleOpenDesk = (projectId: string, chapterId?: string) => {
    selectActiveProject(projectId);
    if (chapterId) {
      navigate(`/desk/${projectId}?chapter=${chapterId}`);
    } else {
      navigate(`/desk/${projectId}`);
    }
  };

  const palette = selectedProject
    ? COVER_PALETTES[selectedProject.coverPalette] ?? COVER_PALETTES['burgundy-morocco']
    : COVER_PALETTES['burgundy-morocco'];

  return (
    <div className="max-w-[1260px] mx-auto px-5 sm:px-8 lg:px-12 pt-8 sm:pt-12 pb-20">
      {/* =====================================================================
          1. MASTHEAD WITH ATELIER STATS & COMMISSION ACTION
         ===================================================================== */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-end justify-between gap-6 pb-8 border-b"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-manuscript rounded border transition-colors hover:bg-[var(--burgundy-wash)] cursor-pointer"
              style={{
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-secondary)',
              }}
              title="Return to previous page"
              aria-label="Go back to previous page"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.4} />
              <span>Back</span>
            </button>
            <span aria-hidden="true" style={{ color: 'var(--border-hairline)' }}>·</span>
            <p className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
              Folio III · Bindery &amp; Chapters
            </p>
          </div>
          <h1
            className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Manuscripts &amp; Chapters
          </h1>
          <div
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm pt-1"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="font-mono-tabular">
              {data.projects.length} {data.projects.length === 1 ? 'volume' : 'volumes'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{data.chapters.length} bound folios</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{formatWordCount(totalWordsInLibrary)} total words</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsNewProjectOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-manuscript cursor-pointer transition-opacity hover:opacity-95 whitespace-nowrap shadow-sm"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#F4EFE5',
          }}
        >
          <FolderPlus className="w-4 h-4" strokeWidth={1.4} />
          <span>Commission New Volume</span>
        </button>
      </motion.section>

      {/* =====================================================================
          2. TWO-COLUMN BINDERY STAGE
         ===================================================================== */}
      <section className="mt-10 sm:mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left Column (4 cols): Active Volumes Shelf & Selector */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
              Volumes on Shelf ({data.projects.length})
            </span>
            <span className="text-xs font-manuscript italic" style={{ color: 'var(--text-muted)' }}>
              Select to manage
            </span>
          </div>

          <div className="space-y-3">
            {data.projects.map((proj, idx) => {
              const isSelected = selectedProject?.id === proj.id;
              const projPal = COVER_PALETTES[proj.coverPalette] ?? COVER_PALETTES['burgundy-morocco'];
              const projWords = getProjectWordCount(proj.id);
              const projChapters = getProjectChapters(proj.id);
              const projPct = Math.min(
                100,
                Math.round((projWords / Math.max(1, proj.wordGoal)) * 100)
              );

              return (
                <div
                  key={proj.id}
                  onClick={() => {
                    setSelectedProjectId(proj.id);
                    selectActiveProject(proj.id);
                  }}
                  className={`group relative p-4 rounded-sm border text-left cursor-pointer transition-all duration-200 ${
                    isSelected ? 'shadow-md scale-[1.01]' : 'hover:bg-[var(--burgundy-wash)]'
                  }`}
                  style={{
                    backgroundColor: isSelected ? 'var(--bg-surface)' : 'var(--bg-canvas)',
                    borderColor: isSelected ? 'var(--accent-brass)' : 'var(--border-hairline)',
                  }}
                >
                  {/* Left Spine Color Stripe */}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 bottom-0 w-2 rounded-l-sm"
                    style={{ backgroundColor: projPal.clothHex }}
                  />

                  <div className="pl-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="small-caps-meta text-[11px]" style={{ color: 'var(--accent-brass)' }}>
                          Vol. {toRoman(idx + 1)} · {proj.genre}
                        </span>
                        <h3
                          className="font-display text-lg font-medium leading-snug truncate mt-0.5"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {proj.title}
                        </h3>
                      </div>

                      {/* Action buttons (Edit & Delete) */}
                      <div
                        className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setProjectToEdit(proj)}
                          title="Edit Volume Details"
                          aria-label={`Edit ${proj.title}`}
                          className="p-1.5 rounded hover:bg-[var(--burgundy-wash)] cursor-pointer"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <Pencil className="w-3.5 h-3.5" strokeWidth={1.4} />
                        </button>

                        {data.projects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setProjectToDelete(proj)}
                            title="Strike Volume from Shelf"
                            aria-label={`Delete ${proj.title}`}
                            className="p-1.5 rounded hover:bg-rose-950/20 hover:text-rose-600 cursor-pointer"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.4} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Word Counts */}
                    <div className="mt-3 pt-2.5 border-t" style={{ borderColor: 'var(--border-hairline)' }}>
                      <div className="flex items-baseline justify-between text-xs font-mono-tabular">
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {formatWordCount(projWords)} / {formatWordCount(proj.wordGoal)} w
                        </span>
                        <span style={{ color: 'var(--accent-brass)' }}>{projPct}%</span>
                      </div>
                      <div className="mt-1 h-1 w-full bg-[var(--border-hairline)] overflow-hidden rounded-full">
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${Math.max(2, projPct)}%`,
                            backgroundColor: 'var(--accent-primary)',
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-xs font-manuscript">
                      <span style={{ color: 'var(--text-muted)' }}>
                        {projChapters.length} {projChapters.length === 1 ? 'folio' : 'folios'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDesk(proj.id);
                        }}
                        className="inline-flex items-center gap-1 italic underline underline-offset-4 cursor-pointer hover:opacity-80"
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        <Feather className="w-3 h-3" strokeWidth={1.3} />
                        <span>Write</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsNewProjectOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-dashed rounded-sm text-sm font-manuscript cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)]"
            style={{
              borderColor: 'var(--border-brass)',
              color: 'var(--text-secondary)',
            }}
          >
            <Plus className="w-4 h-4" strokeWidth={1.4} />
            <span>Commission Another Volume</span>
          </button>
        </aside>

        {/* Right Column (8 cols): Selected Volume Bindery & Chapter Drag Reorder */}
        <main className="lg:col-span-8 space-y-6">
          {selectedProject ? (
            <>
              {/* Volume Master Foil Card */}
              <div
                className="relative paper-folio p-6 sm:p-8 md:p-9"
                style={{ transform: 'rotate(-0.25deg)' }}
              >
                <CornerOrnament position="tl" />
                <CornerOrnament position="tr" />
                <CornerOrnament position="bl" />
                <CornerOrnament position="br" />

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="w-2.5 h-5 rounded-xs shrink-0"
                        style={{ backgroundColor: palette.clothHex }}
                        title={palette.name}
                      />
                      <span className="small-caps-meta" style={{ color: 'var(--accent-brass)' }}>
                        {selectedProject.genre}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="italic" style={{ color: 'var(--text-muted)' }}>
                        by {selectedProject.author}
                      </span>
                    </div>

                    <h2
                      className="font-display text-2xl sm:text-3xl font-medium pt-1 text-balance"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {selectedProject.title}
                    </h2>
                    {selectedProject.subtitle && (
                      <p className="font-display italic text-base" style={{ color: 'var(--text-secondary)' }}>
                        {selectedProject.subtitle}
                      </p>
                    )}
                  </div>

                  <WaxSeal
                    monogram={selectedProject.title.charAt(0).toUpperCase()}
                    size={48}
                    className="shrink-0 hidden sm:block"
                  />
                </div>

                <p className="mt-3 text-[16px] leading-relaxed max-w-[65ch]" style={{ color: 'var(--text-secondary)' }}>
                  {selectedProject.synopsis}
                </p>

                {/* Progress bar */}
                <div className="mt-5 pt-3 border-t" style={{ borderColor: 'var(--border-hairline)' }}>
                  <div className="flex items-baseline justify-between text-xs font-mono-tabular">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Manuscript Progress: {formatWordCount(selectedProjectWords)} of{' '}
                      {formatWordCount(selectedProject.wordGoal)} target words
                    </span>
                    <span className="font-medium" style={{ color: 'var(--accent-brass)' }}>
                      {selectedProgressPct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-[var(--border-hairline)] overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${Math.max(2, selectedProgressPct)}%`,
                        backgroundColor: 'var(--accent-primary)',
                      }}
                    />
                  </div>
                </div>

                {/* Folio Controls */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpenDesk(selectedProject.id)}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-manuscript cursor-pointer transition-opacity hover:opacity-90 whitespace-nowrap"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: '#F4EFE5',
                    }}
                  >
                    <Feather className="w-4 h-4" strokeWidth={1.4} />
                    <span>Open on the Desk</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={1.4} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setProjectToEdit(selectedProject)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-manuscript border cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)] whitespace-nowrap"
                    style={{
                      borderColor: 'var(--border-brass)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Settings className="w-3.5 h-3.5" strokeWidth={1.4} />
                    <span>Revise Volume Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddingChapter((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-manuscript border cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)] whitespace-nowrap"
                    style={{
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.4} />
                    <span>Bind New Folio</span>
                  </button>
                </div>
              </div>

              {/* Quick Add Folio Form (expandable) */}
              <AnimatePresence>
                {isAddingChapter && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleQuickAddChapter}
                    className="paper-card p-4 sm:p-5 flex flex-wrap items-center gap-3 overflow-hidden"
                  >
                    <div className="flex-1 min-w-[220px]">
                      <label htmlFor="quick-add-ch" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                        Title for Next Folio ({toRoman(chapters.length + 1)})
                      </label>
                      <input
                        id="quick-add-ch"
                        type="text"
                        autoFocus
                        value={newChapterTitle}
                        onChange={(e) => setNewChapterTitle(e.target.value)}
                        placeholder={`Chapter ${toRoman(chapters.length + 1)}`}
                        className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none"
                        style={{
                          backgroundColor: 'var(--bg-canvas)',
                          borderColor: 'var(--border-brass)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsAddingChapter(false)}
                        className="px-3 py-1.5 text-xs font-manuscript italic cursor-pointer hover:opacity-75"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs font-manuscript rounded-sm cursor-pointer whitespace-nowrap"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: '#F4EFE5',
                        }}
                      >
                        Bind to Volume
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* =============================================================
                  3. CHAPTER BINDERY BOARD WITH DRAG & DROP REORDERING
                 ============================================================= */}
              <div className="paper-card p-6 sm:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
                  <div>
                    <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                      Chapter Bindery
                    </span>
                    <h3 className="font-display text-xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                      Folios &amp; Narrative Sequence
                    </h3>
                  </div>
                  <p className="text-xs font-manuscript italic" style={{ color: 'var(--text-muted)' }}>
                    Drag grip to rearrange sequence · Folio numerals adjust automatically
                  </p>
                </div>

                {chapters.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {chapters.map((ch, idx) => {
                      const isDragging = draggingId === ch.id;
                      const isDragOver = dragOverId === ch.id;
                      const estReadMins = Math.max(1, Math.round(ch.wordCount / 225));

                      return (
                        <div
                          key={ch.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, ch.id)}
                          onDragOver={(e) => handleDragOver(e, ch.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, ch.id)}
                          className={`group flex items-center justify-between p-3 sm:p-3.5 rounded-sm border transition-all select-none ${
                            isDragging
                              ? 'opacity-40 border-dashed border-amber-600 bg-amber-500/10'
                              : isDragOver
                              ? 'border-[var(--accent-primary)] bg-[var(--burgundy-wash)] ring-1 ring-[var(--accent-primary)]'
                              : 'hover:border-[var(--border-brass)] hover:bg-[var(--burgundy-wash)]/40'
                          }`}
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: isDragOver ? 'var(--accent-primary)' : 'var(--border-hairline)',
                          }}
                        >
                          {/* Drag Handle & Order */}
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                            {/* Grip handle */}
                            <div
                              title="Drag to reorder"
                              className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-[var(--burgundy-wash)] text-[var(--accent-brass)] opacity-60 group-hover:opacity-100 transition-opacity"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>

                            {/* Roman Numeral */}
                            <span
                              className="font-mono-tabular text-xs sm:text-sm font-medium w-9 sm:w-11 shrink-0"
                              style={{ color: 'var(--accent-brass)' }}
                            >
                              {toRoman(ch.order)}.
                            </span>

                            {/* Title & Notes */}
                            <div className="min-w-0 flex-1">
                              <p
                                className="font-manuscript text-base font-medium truncate cursor-pointer hover:underline"
                                style={{ color: 'var(--text-primary)' }}
                                onClick={() => handleOpenDesk(selectedProject.id, ch.id)}
                              >
                                {ch.title}
                              </p>
                              {ch.notes ? (
                                <p className="text-xs italic truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                  {ch.notes}
                                </p>
                              ) : (
                                <p className="text-xs font-mono-tabular mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                  {formatWordCount(ch.wordCount)} words · ≈ {estReadMins} min read · Revised {formatFolioDate(ch.updatedAt)}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Reorder and Action Tools */}
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0 pl-2">
                            {/* Move Up/Down arrows for accessibility */}
                            <div className="hidden sm:flex flex-col">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveChapter(ch.id, 'up')}
                                title="Move Folio Up"
                                aria-label={`Move ${ch.title} up`}
                                className="p-1 hover:text-[var(--accent-primary)] disabled:opacity-20 cursor-pointer disabled:pointer-events-none"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === chapters.length - 1}
                                onClick={() => handleMoveChapter(ch.id, 'down')}
                                title="Move Folio Down"
                                aria-label={`Move ${ch.title} down`}
                                className="p-1 hover:text-[var(--accent-primary)] disabled:opacity-20 cursor-pointer disabled:pointer-events-none"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Edit Folio Title & Notes */}
                            <button
                              type="button"
                              onClick={() => setChapterToEdit(ch)}
                              title="Edit Folio Inscription & Notes"
                              aria-label={`Edit ${ch.title}`}
                              className="p-1.5 rounded transition-colors hover:bg-[var(--burgundy-wash)] cursor-pointer"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              <Pencil className="w-3.5 h-3.5" strokeWidth={1.4} />
                            </button>

                            {/* Open in Desk */}
                            <button
                              type="button"
                              onClick={() => handleOpenDesk(selectedProject.id, ch.id)}
                              title="Open on the Writing Desk"
                              aria-label={`Write ${ch.title}`}
                              className="p-1.5 rounded transition-colors hover:bg-[var(--burgundy-wash)] cursor-pointer"
                              style={{ color: 'var(--accent-primary)' }}
                            >
                              <Feather className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </button>

                            {/* Delete Chapter (if more than 1) */}
                            {chapters.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setChapterToDelete(ch)}
                                title="Strike Folio from Manuscript"
                                aria-label={`Delete ${ch.title}`}
                                className="p-1.5 rounded transition-colors hover:bg-rose-900/20 hover:text-rose-600 cursor-pointer"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.4} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                    <EmptyShelfIllustration className="w-56 h-36" />
                    <p className="font-display italic text-lg" style={{ color: 'var(--text-secondary)' }}>
                      This volume has no bound folios yet.
                    </p>
                    <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                      Inscribe the opening chapter to begin laying the foundations of this manuscript.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddingChapter(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-manuscript cursor-pointer transition-opacity hover:opacity-90 mt-2"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: '#F4EFE5',
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Bind Opening Folio</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="paper-folio p-12 flex flex-col items-center justify-center text-center space-y-3">
              <EmptyShelfIllustration className="w-64 h-40" />
              <h3 className="font-display text-2xl font-medium" style={{ color: 'var(--text-primary)' }}>
                No Volume Selected
              </h3>
              <p className="text-base max-w-md" style={{ color: 'var(--text-secondary)' }}>
                Select a manuscript from your shelf register or commission a new work to arrange its chapters.
              </p>
              <button
                type="button"
                onClick={() => setIsNewProjectOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-manuscript cursor-pointer transition-opacity hover:opacity-90 mt-2"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#F4EFE5',
                }}
              >
                <Plus className="w-4 h-4" />
                <span>Commission New Volume</span>
              </button>
            </div>
          )}
        </main>
      </section>

      {/* =====================================================================
          4. UNIFYING MODALS & CONFIRMATION DECREES
         ===================================================================== */}
      {/* Commission New Project Dialog */}
      <NewProjectDialog
        open={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onCreated={(created) => {
          setSelectedProjectId(created.id);
          selectActiveProject(created.id);
        }}
      />

      {/* Edit Volume Details Dialog */}
      <EditProjectDialog
        project={projectToEdit}
        open={Boolean(projectToEdit)}
        onClose={() => setProjectToEdit(null)}
      />

      {/* Edit Folio Dialog */}
      <EditChapterDialog
        chapter={chapterToEdit}
        open={Boolean(chapterToEdit)}
        onClose={() => setChapterToEdit(null)}
      />

      {/* Unfolding Paper Confirmation: Delete Project */}
      <UnfoldingPaperDialog
        open={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDeleteProject}
        eyebrow="Atelier Decree · Striking Manuscript"
        title={projectToDelete ? `Strike “${projectToDelete.title}” from Shelf?` : ''}
        sealMonogram={projectToDelete?.title.charAt(0).toUpperCase() ?? '❦'}
        confirmLabel="Strike Volume from Registry"
        cancelLabel="Preserve Manuscript"
        isDestructive={true}
        description={
          projectToDelete && (
            <p>
              You are about to permanently strike the manuscript volume{' '}
              <strong className="text-[var(--text-primary)] font-medium">“{projectToDelete.title}”</strong> and
              all {getProjectChapters(projectToDelete.id).length} of its bound chapters from your study archive.
              All written words in this volume will be expunged.
            </p>
          )
        }
      />

      {/* Unfolding Paper Confirmation: Delete Chapter */}
      <UnfoldingPaperDialog
        open={Boolean(chapterToDelete)}
        onClose={() => setChapterToDelete(null)}
        onConfirm={handleConfirmDeleteChapter}
        eyebrow="Folio Strike Decree"
        title={chapterToDelete ? `Strike “${chapterToDelete.title}” from Binding?` : ''}
        confirmLabel="Strike Folio"
        cancelLabel="Keep Chapter Bound"
        isDestructive={true}
        description={
          chapterToDelete && (
            <p>
              Removing{' '}
              <strong className="text-[var(--text-primary)] font-medium">“{chapterToDelete.title}”</strong> will
              strike {formatWordCount(chapterToDelete.wordCount)} words from this volume’s manuscript. Remaining
              chapters will automatically be renumbered in sequence.
            </p>
          )
        }
      />
    </div>
  );
};
