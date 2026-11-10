import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Archive, Feather, FolderOpen, Pencil, Settings, Trash2 } from 'lucide-react';
import { useInkwell } from '../store/inkwellStore';
import { useToast } from '../hooks/useToast';
import { getDailyEpigraph } from '../lib/seedData';
import {
  formatFolioDate,
  formatWordCount,
  getFirstParagraphExcerpt,
  getGreetingByHour,
  toRoman,
} from '../lib/formatters';
import { Project } from '../types/inkwell';
import { BookCover } from '../components/library/BookCover';
import { NewVolumeCard } from '../components/library/NewVolumeCard';
import { NewProjectDialog } from '../components/library/NewProjectDialog';
import { EditProjectDialog } from '../components/library/EditProjectDialog';
import { UnfoldingPaperDialog } from '../components/common/UnfoldingPaperDialog';
import { DataArchiveDialog } from '../components/library/DataArchiveDialog';
import {
  CornerOrnament,
  FleuronDivider,
  QuillIllustration,
  WaxSeal,
} from '../components/ornaments/Ornaments';
import { EmptyShelfIllustration } from '../components/common/EmptyStateIllustrations';


export const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    data,
    activeProject,
    selectActiveProject,
    getProjectChapters,
    getProjectWordCount,
    getTotalWords,
    getRecentChapters,
    deleteProject,
  } = useInkwell();
  const { notify } = useToast();

  const [isNewVolumeOpen, setIsNewVolumeOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const handleConfirmDeleteProject = () => {
    if (!projectToDelete) return;
    const title = projectToDelete.title;
    deleteProject(projectToDelete.id);
    notify('Volume Struck', `“${title}” removed from study library.`);
    setProjectToDelete(null);
  };

  const epigraph = useMemo(() => getDailyEpigraph(), []);
  const { salutation, dateLabel } = useMemo(() => getGreetingByHour(), []);

  const totalWords = getTotalWords();
  const recentChapters = useMemo(() => getRecentChapters(6), [getRecentChapters]);

  const featuredChapters = useMemo(
    () => (activeProject ? getProjectChapters(activeProject.id) : []),
    [activeProject, getProjectChapters]
  );

  const featuredChapter = useMemo(() => {
    if (!activeProject || featuredChapters.length === 0) return null;
    if (activeProject.lastOpenedChapterId) {
      const match = featuredChapters.find(
        (c) => c.id === activeProject.lastOpenedChapterId
      );
      if (match) return match;
    }
    return featuredChapters[featuredChapters.length - 1];
  }, [activeProject, featuredChapters]);

  const featuredWordCount = activeProject
    ? getProjectWordCount(activeProject.id)
    : 0;
  const featuredProgress = activeProject
    ? Math.min(
        100,
        Math.round(
          (featuredWordCount / Math.max(1, activeProject.wordGoal)) * 100
        )
      )
    : 0;

  const todayDateStr = new Date().toISOString().slice(0, 10);
  const todayWords = useMemo(
    () =>
      data.sessions
        .filter((s) => s.date === todayDateStr)
        .reduce((sum, s) => sum + s.wordsWritten, 0),
    [data.sessions, todayDateStr]
  );

  const handleOpenDesk = (projectId: string, chapterId?: string) => {
    if (chapterId) {
      navigate(`/desk/${projectId}?chapter=${chapterId}`);
    } else {
      navigate(`/desk/${projectId}`);
    }
  };

  return (
    <div className="max-w-[1260px] mx-auto px-5 sm:px-8 lg:px-12 pt-8 sm:pt-12 pb-16">
      {/* =====================================================================
          1. ATELIER MASTHEAD & DAILY LITERARY EPIGRAPH
         ===================================================================== */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end pb-9 border-b"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        <div className="lg:col-span-6 space-y-2.5">
          <p
            className="small-caps-meta text-xs"
            style={{ color: 'var(--accent-brass)' }}
          >
            {salutation} · {dateLabel}
          </p>
          <h1
            className="font-display text-4xl sm:text-5xl font-medium tracking-tight leading-[1.08] text-balance"
            style={{ color: 'var(--text-primary)' }}
          >
            The Library
          </h1>
          <div
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm pt-1"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="font-mono-tabular">
              {data.projects.length}{' '}
              {data.projects.length === 1 ? 'volume' : 'volumes'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {data.chapters.length} chapters
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {formatWordCount(totalWords)} words inked
            </span>
          </div>
        </div>

        {/* Daily Literary Quote */}
        <blockquote className="lg:col-span-6 lg:pl-8 lg:border-l" style={{ borderColor: 'var(--border-brass)' }}>
          <p
            className="font-display italic text-lg sm:text-xl leading-relaxed"
            style={{ color: 'var(--text-primary)' }}
          >
            “{epigraph.quote}”
          </p>
          <footer
            className="mt-2.5 flex items-center gap-2 text-xs small-caps-meta"
            style={{ color: 'var(--text-muted)' }}
          >
            <span aria-hidden="true" style={{ color: 'var(--accent-brass)' }}>
              ❦
            </span>
            <span>{epigraph.author}</span>
            <span aria-hidden="true">/</span>
            <span className="italic normal-case tracking-normal font-manuscript text-sm">
              {epigraph.work}
            </span>
          </footer>
        </blockquote>
      </motion.section>

      {/* =====================================================================
          2. ASYMMETRIC "CONTINUE WRITING" OPEN FOLIO & VOLUME COMPENDIUM
         ===================================================================== */}
      <section className="mt-10 sm:mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left 7 cols: Open Manuscript Sheet */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-7"
        >
          {activeProject ? (
            <div
              className="relative paper-folio p-6 sm:p-10 md:p-11 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:-rotate-[0.45deg] hover:rotate-0"
            >
              <CornerOrnament position="tl" />
              <CornerOrnament position="tr" />
              <CornerOrnament position="bl" />
              <CornerOrnament position="br" />

              {/* Faint Burgundy Margin Rule (classic writer's folio line) */}
              <div
                aria-hidden="true"
                className="hidden sm:block absolute top-8 bottom-8 left-11 w-px pointer-events-none"
                style={{ backgroundColor: 'var(--margin-rule)' }}
              />

              {/* Embossed Wax Seal */}
              <div className="hidden sm:block absolute -top-3 right-8">
                <WaxSeal
                  monogram={activeProject.title.charAt(0).toUpperCase()}
                  size={52}
                />
              </div>

              <div className="sm:pl-7">
                {/* Kicker */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className="small-caps-meta"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    Continue Writing
                  </span>
                  <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                    ·
                  </span>
                  <span
                    className="font-manuscript italic text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {activeProject.genre}
                  </span>
                  {featuredChapter && (
                    <>
                      <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                        ·
                      </span>
                      <span
                        className="font-mono-tabular text-[11px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {formatFolioDate(featuredChapter.updatedAt)}
                      </span>
                    </>
                  )}
                </div>

                {/* Volume & Chapter Title */}
                <h2
                  className="font-display text-2xl sm:text-3xl font-medium mt-2.5 leading-tight text-balance"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {activeProject.title}
                </h2>
                {featuredChapter && (
                  <p
                    className="font-display italic text-base sm:text-lg mt-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Chapter {toRoman(featuredChapter.order)} — {featuredChapter.title}
                  </p>
                )}

                <FleuronDivider symbol="✦" className="my-6" />

                {/* Manuscript Excerpt with Drop Cap */}
                <div className="manuscript-ruled py-1">
                  <p
                    className="drop-cap text-[18px] sm:text-[19px] leading-[1.78] max-w-[62ch]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {featuredChapter
                      ? getFirstParagraphExcerpt(featuredChapter.content, 360)
                      : activeProject.synopsis}
                  </p>
                </div>

                {/* Brass Hairline Progress Rule */}
                <div className="mt-7">
                  <div className="flex items-center justify-between text-xs font-mono-tabular mb-2">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {formatWordCount(featuredWordCount)} of{' '}
                      {formatWordCount(activeProject.wordGoal)} words
                    </span>
                    <span style={{ color: 'var(--accent-brass)' }}>
                      {featuredProgress}% complete
                    </span>
                  </div>
                  <div
                    className="h-[3px] w-full overflow-hidden"
                    style={{ backgroundColor: 'var(--border-hairline)' }}
                  >
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${Math.max(2, featuredProgress)}%`,
                        backgroundColor: 'var(--accent-primary)',
                      }}
                    />
                  </div>
                </div>

                {/* Folio Actions */}
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenDesk(activeProject.id, featuredChapter?.id)
                    }
                    className="inline-flex items-center gap-2.5 px-6 py-2.5 text-sm font-manuscript tracking-wide cursor-pointer transition-colors whitespace-nowrap hover:opacity-95"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: '#F4EFE5',
                    }}
                  >
                    <Feather className="w-4 h-4" strokeWidth={1.4} />
                    <span>Open on the Desk</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={1.4} />
                  </button>

                  <Link
                    to="/projects"
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-manuscript border transition-colors hover:bg-[var(--burgundy-wash)] whitespace-nowrap"
                    style={{
                      borderColor: 'var(--border-brass)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <FolderOpen className="w-4 h-4" strokeWidth={1.3} />
                    <span>Manage Chapters</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setProjectToEdit(activeProject)}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-manuscript border transition-colors hover:bg-[var(--burgundy-wash)] cursor-pointer whitespace-nowrap"
                    style={{
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" strokeWidth={1.4} />
                    <span>Revise Volume</span>
                  </button>

                  {data.projects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setProjectToDelete(activeProject)}
                      className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-manuscript border transition-colors hover:bg-rose-950/20 hover:text-rose-600 cursor-pointer whitespace-nowrap"
                      style={{
                        borderColor: 'var(--border-hairline)',
                        color: 'var(--text-muted)',
                      }}
                      title="Strike Volume from Study"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.4} />
                      <span className="hidden sm:inline">Strike</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Polished Empty State */
            <div className="paper-folio p-10 text-center">
              <QuillIllustration className="w-44 h-auto mx-auto mb-5" />
              <h2
                className="font-display text-2xl font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                Your Study Shelves Are Bare
              </h2>
              <p
                className="mt-2 max-w-md mx-auto text-base"
                style={{ color: 'var(--text-secondary)' }}
              >
                Bind your first manuscript volume to begin drafting chapters,
                sketching characters, and mapping your world.
              </p>
              <button
                type="button"
                onClick={() => setIsNewVolumeOpen(true)}
                className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 text-sm font-manuscript cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#F4EFE5',
                }}
              >
                <Feather className="w-4 h-4" strokeWidth={1.4} />
                <span>Bind First Volume</span>
              </button>
            </div>
          )}
        </motion.div>

        {/* Right 5 cols: Volume Synopsis, Chapter Index & Quill Vignette */}
        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 space-y-6"
        >
          {activeProject && (
            <div
              className="double-rule-box p-6 sm:p-7"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <div className="flex items-center justify-between gap-4">
                <span
                  className="small-caps-meta text-xs"
                  style={{ color: 'var(--accent-brass)' }}
                >
                  Selected Volume Notes
                </span>
                <span
                  className="text-xs font-manuscript italic"
                  style={{ color: 'var(--text-muted)' }}
                >
                  by {activeProject.author}
                </span>
              </div>

              {activeProject.subtitle && (
                <p
                  className="font-display italic text-base mt-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {activeProject.subtitle}
                </p>
              )}

              <p
                className="mt-2.5 text-[16px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {activeProject.synopsis}
              </p>

              {/* Chapters inside selected volume */}
              <div
                className="mt-5 pt-4 border-t"
                style={{ borderColor: 'var(--border-hairline)' }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="small-caps-meta text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Bound Chapters
                  </span>
                  <span
                    className="text-xs font-mono-tabular"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {featuredChapters.length} total
                  </span>
                </div>

                {featuredChapters.length > 0 ? (
                  <ul className="divide-y" style={{ borderColor: 'var(--border-hairline)' }}>
                    {featuredChapters.slice(0, 4).map((ch) => (
                      <li key={ch.id} style={{ borderColor: 'var(--border-hairline)' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDesk(activeProject.id, ch.id)}
                          className="w-full py-2.5 flex items-baseline justify-between gap-3 text-left cursor-pointer group transition-colors hover:opacity-80"
                        >
                          <span className="flex items-baseline gap-2.5 min-w-0">
                            <span
                              className="font-mono-tabular text-xs shrink-0 w-7"
                              style={{ color: 'var(--accent-brass)' }}
                            >
                              {toRoman(ch.order)}.
                            </span>
                            <span
                              className="text-base truncate group-hover:underline underline-offset-4"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {ch.title}
                            </span>
                          </span>
                          <span
                            className="font-mono-tabular text-xs shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {formatWordCount(ch.wordCount)} w
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p
                    className="text-sm italic py-2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    No chapters inked yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Engraved Quill & Today's Quota Card */}
          <div
            className="paper-card p-6 flex items-center justify-between gap-5"
            style={{ transform: 'rotate(0.5deg)' }}
          >
            <div className="space-y-1.5">
              <p
                className="small-caps-meta text-xs"
                style={{ color: 'var(--accent-brass)' }}
              >
                Today’s Candle
              </p>
              <p
                className="font-display text-2xl font-medium font-mono-tabular"
                style={{ color: 'var(--text-primary)' }}
              >
                {formatWordCount(todayWords)}{' '}
                <span
                  className="text-sm font-manuscript italic font-normal"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  / {formatWordCount(data.settings.dailyWordGoal)} words
                </span>
              </p>
              <p
                className="text-xs font-manuscript italic"
                style={{ color: 'var(--text-muted)' }}
              >
                Click any volume below to inspect its folio, or double-click to
                write.
              </p>
            </div>
            <QuillIllustration className="w-28 sm:w-32 h-auto shrink-0" />
          </div>
        </motion.aside>
      </section>

      {/* =====================================================================
          3. THE BOOKCASE SHELF ("VOLUMES ON THE SHELF")
         ===================================================================== */}
      <section className="mt-14 sm:mt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-7">
          <div>
            <p
              className="small-caps-meta text-xs"
              style={{ color: 'var(--accent-brass)' }}
            >
              Bookcase I
            </p>
            <h2
              className="font-display text-2xl sm:text-3xl font-medium mt-1"
              style={{ color: 'var(--text-primary)' }}
            >
              Volumes on the Shelf
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setIsNewVolumeOpen(true)}
            className="text-sm font-manuscript italic cursor-pointer underline underline-offset-4 transition-opacity hover:opacity-75 whitespace-nowrap"
            style={{ color: 'var(--accent-primary)' }}
          >
            + Commission New Volume
          </button>
        </div>

        {/* Bookcase Row with Wooden Plank & Brass Brackets */}
        <div className="relative">
          <div className="flex items-end gap-7 sm:gap-9 overflow-x-auto pt-4 pb-6 px-4 sm:px-8">
            {data.projects.map((project, idx) => (
              <BookCover
                key={project.id}
                project={project}
                volumeIndex={idx}
                wordCount={getProjectWordCount(project.id)}
                chapterCount={getProjectChapters(project.id).length}
                isSelected={activeProject?.id === project.id}
                onSelect={(p) => selectActiveProject(p.id)}
                onOpenDesk={(p) => handleOpenDesk(p.id, p.lastOpenedChapterId)}
                onEdit={(p) => setProjectToEdit(p)}
                onDelete={(p) => setProjectToDelete(p)}
                canDelete={data.projects.length > 1}
              />
            ))}

            <NewVolumeCard
              onClick={() => setIsNewVolumeOpen(true)}
              delayIndex={data.projects.length}
            />
          </div>

          {/* Handcrafted Wooden Shelf Plank */}
          <div aria-hidden="true" className="relative -mt-14 pt-14 pointer-events-none">
            <div
              className="h-3.5 w-full rounded-[2px] relative"
              style={{
                background:
                  'linear-gradient(180deg, var(--bg-shelf) 0%, var(--bg-shelf-edge) 100%)',
                boxShadow:
                  '0 10px 22px -4px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.12)',
              }}
            >
              {/* Subtle brass shelf brackets */}
              <span
                className="absolute left-6 top-full w-3 h-5 rounded-b-sm"
                style={{
                  backgroundColor: 'var(--accent-brass)',
                  opacity: 0.55,
                }}
              />
              <span
                className="absolute right-6 top-full w-3 h-5 rounded-b-sm"
                style={{
                  backgroundColor: 'var(--accent-brass)',
                  opacity: 0.55,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. LOWER ASYMMETRIC SPREAD — RECENT MANUSCRIPTS LEDGER & ARCHIVE
         ===================================================================== */}
      <section className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Recent Manuscripts Ledger (8 cols) */}
        <div className="lg:col-span-8 paper-card p-6 sm:p-8">
          <div
            className="flex items-baseline justify-between gap-4 pb-4 border-b"
            style={{ borderColor: 'var(--border-hairline)' }}
          >
            <div>
              <p
                className="small-caps-meta text-xs"
                style={{ color: 'var(--accent-brass)' }}
              >
                Accession Register
              </p>
              <h2
                className="font-display text-2xl font-medium mt-1"
                style={{ color: 'var(--text-primary)' }}
              >
                Recent Manuscripts
              </h2>
            </div>
            <span
              className="text-xs font-mono-tabular"
              style={{ color: 'var(--text-muted)' }}
            >
              Latest revisions
            </span>
          </div>

          {recentChapters.length > 0 ? (
            <div className="overflow-x-auto mt-2">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr
                    className="border-b text-xs small-caps-meta"
                    style={{
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <th className="py-3 pr-3 font-normal w-12">Ch.</th>
                    <th className="py-3 pr-4 font-normal">Folio Title</th>
                    <th className="py-3 pr-4 font-normal hidden sm:table-cell">
                      Volume
                    </th>
                    <th className="py-3 pr-4 font-normal text-right">Words</th>
                    <th className="py-3 font-normal text-right">Revised</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-hairline)' }}>
                  {recentChapters.map((ch) => (
                    <tr
                      key={ch.id}
                      onClick={() => handleOpenDesk(ch.projectId, ch.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenDesk(ch.projectId, ch.id);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)] focus-visible:outline-2"
                      style={{ borderColor: 'var(--border-hairline)' }}
                    >
                      <td
                        className="py-3.5 pr-3 font-mono-tabular text-xs"
                        style={{ color: 'var(--accent-brass)' }}
                      >
                        {toRoman(ch.order)}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span
                          className="font-manuscript text-base font-medium block"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {ch.title}
                        </span>
                        <span
                          className="sm:hidden text-xs italic"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {ch.projectTitle}
                        </span>
                      </td>
                      <td
                        className="py-3.5 pr-4 hidden sm:table-cell text-sm italic"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {ch.projectTitle}
                      </td>
                      <td
                        className="py-3.5 pr-4 text-right font-mono-tabular text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {formatWordCount(ch.wordCount)}
                      </td>
                      <td
                        className="py-3.5 text-right font-mono-tabular text-xs whitespace-nowrap"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {formatFolioDate(ch.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <EmptyShelfIllustration className="w-56 h-36" />
              <p
                className="mt-3 font-display italic text-base"
                style={{ color: 'var(--text-secondary)' }}
              >
                No folios have been recorded into this register yet.
              </p>
              <p
                className="mt-1 text-xs max-w-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                Commission a volume above or open the Desk to inscribe your inaugural manuscript pages.
              </p>
            </div>
          )}

        </div>

        {/* Studio Archive & JSON Ledger (4 cols) */}
        <div
          className="lg:col-span-4 double-rule-box p-6 sm:p-7 space-y-5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            transform: 'rotate(-0.5deg)',
          }}
        >
          <div>
            <p
              className="small-caps-meta text-xs"
              style={{ color: 'var(--accent-brass)' }}
            >
              Atelier Safekeeping
            </p>
            <h3
              className="font-display text-xl font-medium mt-1"
              style={{ color: 'var(--text-primary)' }}
            >
              Manuscript Vault
            </h3>
            <p
              className="mt-2 text-base leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              Keep portable archival copies of your novels, character dossiers,
              and worldbuilding notes in plain JSON.
            </p>
          </div>

          <FleuronDivider symbol="❦" />

          <dl className="space-y-2.5 text-sm">
            <div className="flex items-baseline justify-between">
              <dt style={{ color: 'var(--text-muted)' }}>Indexed Characters</dt>
              <dd
                className="font-mono-tabular"
                style={{ color: 'var(--text-primary)' }}
              >
                {data.characters.length}
              </dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt style={{ color: 'var(--text-muted)' }}>Atlas Locations</dt>
              <dd
                className="font-mono-tabular"
                style={{ color: 'var(--text-primary)' }}
              >
                {data.locations.length}
              </dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt style={{ color: 'var(--text-muted)' }}>Timeline Events</dt>
              <dd
                className="font-mono-tabular"
                style={{ color: 'var(--text-primary)' }}
              >
                {data.timeline.length}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => setIsArchiveOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-manuscript border cursor-pointer transition-colors hover:opacity-85"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-brass)',
              color: 'var(--text-primary)',
            }}
          >
            <Archive className="w-4 h-4" strokeWidth={1.4} />
            <span>Export or Import JSON</span>
          </button>
        </div>
      </section>

      {/* Dialogs */}
      <NewProjectDialog
        open={isNewVolumeOpen}
        onClose={() => setIsNewVolumeOpen(false)}
        onCreated={(created) => {
          selectActiveProject(created.id);
        }}
      />
      <EditProjectDialog
        project={projectToEdit}
        open={Boolean(projectToEdit)}
        onClose={() => setProjectToEdit(null)}
      />
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
      <DataArchiveDialog
        open={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
      />
    </div>
  );
};
