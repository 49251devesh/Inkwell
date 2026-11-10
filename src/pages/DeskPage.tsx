import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Eye,
  Feather,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';
import { useInkwell } from '../store/inkwellStore';
import { useToast } from '../hooks/useToast';
import { formatWordCount, toRoman } from '../lib/formatters';
import { InkDryingIndicator, InkSaveState } from '../components/desk/InkDryingIndicator';
import { DeskToolbar } from '../components/desk/DeskToolbar';
import { ChapterDrawer } from '../components/desk/ChapterDrawer';
import { AIMarginPanel } from '../components/desk/AIMarginPanel';
import { ManuscriptEditor, ManuscriptEditorHandle } from '../components/desk/ManuscriptEditor';

export const DeskPage: React.FC = () => {
  const { projectId } = useParams<{ projectId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const {
    data,
    activeProject,
    getProjectChapters,
    getProjectWordCount,
    updateChapter,
    createChapter,
    deleteChapter,
    selectActiveProject,
    recordWritingSession,
    resetToSampleLibrary,
  } = useInkwell();

  // If store is somehow empty, restore sample library so desk is never blank
  useEffect(() => {
    if (data.projects.length === 0) {
      resetToSampleLibrary();
    }
  }, [data.projects.length, resetToSampleLibrary]);

  // Determine current project
  const currentProject = useMemo(() => {
    if (projectId) {
      const found = data.projects.find((p) => p.id === projectId);
      if (found) return found;
    }
    if (activeProject) return activeProject;
    return data.projects[0] ?? null;
  }, [projectId, data.projects, activeProject]);

  // Project chapters
  const projectChapters = useMemo(() => {
    if (!currentProject) return [];
    return getProjectChapters(currentProject.id);
  }, [currentProject, getProjectChapters]);

  // Active chapter
  const chapterParamId = searchParams.get('chapter');
  const activeChapter = useMemo(() => {
    if (!currentProject) return null;
    if (projectChapters.length > 0) {
      if (chapterParamId) {
        const found = projectChapters.find((c) => c.id === chapterParamId);
        if (found) return found;
      }
      if (currentProject.lastOpenedChapterId) {
        const found = projectChapters.find((c) => c.id === currentProject.lastOpenedChapterId);
        if (found) return found;
      }
      return projectChapters[0];
    }
    // Fallback virtual chapter so the editor is never null
    return {
      id: `ch-opening-${currentProject.id}`,
      projectId: currentProject.id,
      order: 1,
      title: 'Opening Folio',
      content: '<p>The page lies unmarked beneath the brass lamp, awaiting its opening line.</p>',
      notes: '',
      wordCount: 14,
      updatedAt: new Date().toISOString(),
    };
  }, [projectChapters, chapterParamId, currentProject]);

  // Desk State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [dimParagraphs, setDimParagraphs] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [saveStatus, setSaveStatus] = useState<InkSaveState>('dried');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

  // Session words tracking
  const initialChapterWordsRef = useRef<number | null>(null);
  const [sessionWords, setSessionWords] = useState<number>(0);
  const editorRef = useRef<ManuscriptEditorHandle>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Initialize session words baseline when active chapter opens
  useEffect(() => {
    if (activeChapter) {
      initialChapterWordsRef.current = activeChapter.wordCount;
      setSessionWords(0);
      setSaveStatus('dried');
      setLastSavedTime(new Date(activeChapter.updatedAt));
    }
  }, [activeChapter?.id]);

  // Handle autosave debouncing
  const handleEditorContentChange = useCallback(
    (newHtml: string, newWordCount: number) => {
      if (!activeChapter || !currentProject) return;

      setSaveStatus('typing');

      // Update session words
      if (initialChapterWordsRef.current !== null) {
        const delta = Math.max(0, newWordCount - initialChapterWordsRef.current);
        setSessionWords(delta);
      }

      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      // Transition to drying after pause in typing
      saveTimeoutRef.current = window.setTimeout(() => {
        setSaveStatus('drying');

        // Persist to store
        updateChapter(activeChapter.id, {
          content: newHtml,
          wordCount: newWordCount,
        });

        // Record session word increment if words increased
        if (initialChapterWordsRef.current !== null && newWordCount > initialChapterWordsRef.current) {
          const delta = newWordCount - initialChapterWordsRef.current;
          recordWritingSession(currentProject.id, delta);
        }

        // Ink settles into dried state
        setTimeout(() => {
          setSaveStatus('dried');
          setLastSavedTime(new Date());
        }, 850);
      }, 600);
    },
    [activeChapter, currentProject, updateChapter, recordWritingSession]
  );

  // Chapter title change
  const handleChapterTitleChange = useCallback(
    (newTitle: string) => {
      if (!activeChapter) return;
      updateChapter(activeChapter.id, { title: newTitle });
    },
    [activeChapter, updateChapter]
  );

  // Chapter switching
  const handleSelectChapter = useCallback(
    (chapterId: string) => {
      setSearchParams({ chapter: chapterId });
      setIsDrawerOpen(false);
    },
    [setSearchParams]
  );

  // Create new chapter
  const handleCreateChapter = useCallback(
    (title: string) => {
      if (!currentProject) return;
      const created = createChapter(currentProject.id, title);
      setSearchParams({ chapter: created.id });
      setIsDrawerOpen(false);
      notify('New Folio Bound', `“${created.title}” opened on the desk.`);
    },
    [currentProject, createChapter, setSearchParams, notify]
  );

  // Delete chapter
  const handleDeleteChapter = useCallback(
    (chapterId: string) => {
      deleteChapter(chapterId);
      notify('Folio Struck', 'Chapter removed from manuscript binding.');
      if (activeChapter?.id === chapterId && projectChapters.length > 1) {
        const remaining = projectChapters.filter((c) => c.id !== chapterId);
        setSearchParams({ chapter: remaining[0].id });
      }
    },
    [deleteChapter, activeChapter, projectChapters, setSearchParams, notify]
  );

  // Switch project
  const handleSwitchProject = useCallback(
    (newProjectId: string) => {
      selectActiveProject(newProjectId);
      navigate(`/desk/${newProjectId}`);
      setIsDrawerOpen(false);
    },
    [selectActiveProject, navigate]
  );

  // AI insertion callbacks
  const handleInsertAIContent = useCallback((text: string) => {
    editorRef.current?.insertTextAtCursor(text);
  }, []);

  const handleReplaceAIContent = useCallback((replacement: string) => {
    editorRef.current?.replaceSelectedText(replacement);
  }, []);

  // Format execution
  const handleFormat = useCallback((command: string, value?: string) => {
    editorRef.current?.executeFormat(command, value);
  }, []);

  const handleInsertSceneBreak = useCallback(() => {
    editorRef.current?.insertSceneBreak();
  }, []);

  // Keyboard shortcut for focus mode (Cmd+Shift+F or Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode]);

  // Safety fallback if project still resolving
  if (!currentProject || !activeChapter) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-6 text-center">
        <Feather className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--accent-brass)' }} />
        <h2 className="font-display text-2xl font-medium" style={{ color: 'var(--text-primary)' }}>
          Preparing The Writing Desk…
        </h2>
        <p className="mt-2 text-base" style={{ color: 'var(--text-secondary)' }}>
          Setting out paper and fresh ink.
        </p>
      </div>
    );
  }

  const novelTotalWords = getProjectWordCount(currentProject.id);
  const novelProgressPct = Math.min(
    100,
    Math.round((novelTotalWords / Math.max(1, currentProject.wordGoal)) * 100)
  );
  const readingTimeMinutes = Math.max(1, Math.round(activeChapter.wordCount / 225));

  return (
    <div
      className={`relative min-h-[calc(100vh-4rem)] flex flex-col transition-colors duration-500 ${
        isFocusMode ? 'bg-[var(--bg-canvas)]' : ''
      }`}
    >
      {/* =====================================================================
          1. TOP ATELIER DESK BAR (LIBRARY LINK, TOC, AUTOSAVE, ACTIONS)
         ===================================================================== */}
      <div
        className={`sticky top-0 z-30 transition-all duration-300 border-b backdrop-blur-md ${
          isFocusMode ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100'
        }`}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 94%, transparent)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="max-w-[1260px] mx-auto px-3 sm:px-6 lg:px-10 h-14 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Previous Page Backlink & Table of Contents Drawer Trigger */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 text-xs font-manuscript rounded transition-colors hover:bg-[var(--burgundy-wash)] shrink-0 cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
              title="Return to previous page"
              aria-label="Go back to previous page"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.4} />
              <span className="hidden sm:inline">Back</span>
            </button>

            <span aria-hidden="true" className="select-none" style={{ color: 'var(--border-hairline)' }}>
              |
            </span>

            {/* Table of Contents Button */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-manuscript border rounded-sm transition-colors hover:bg-[var(--burgundy-wash)] cursor-pointer whitespace-nowrap shrink-0"
              style={{
                borderColor: 'var(--border-brass)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
              }}
              title="Open Chapter Index & Table of Contents"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} style={{ color: 'var(--accent-brass)' }} />
              <span className="font-medium">Contents</span>
              <span
                className="font-mono-tabular text-[11px] px-1.5 py-0.5 rounded leading-none shrink-0"
                style={{
                  backgroundColor: 'var(--burgundy-wash)',
                  color: 'var(--accent-primary)',
                }}
              >
                <span className="hidden sm:inline">Folio </span>
                {toRoman(activeChapter.order)}
                <span className="hidden md:inline text-[10px] opacity-75"> ({projectChapters.length})</span>
              </span>
            </button>
          </div>

          {/* Center: Novel & Chapter Name with guaranteed truncation and zero-collision isolation */}
          <div className="hidden md:flex items-center justify-center gap-2 min-w-0 flex-1 px-2 lg:px-4 overflow-hidden text-center">
            <span
              className="font-display font-medium text-xs sm:text-sm truncate min-w-0"
              style={{ color: 'var(--text-primary)' }}
              title={currentProject.title}
            >
              {currentProject.title}
            </span>
            <span aria-hidden="true" className="shrink-0 hidden lg:inline" style={{ color: 'var(--accent-brass)' }}>
              ·
            </span>
            <span
              className="font-manuscript italic text-xs truncate min-w-0 hidden lg:inline"
              style={{ color: 'var(--text-muted)' }}
              title={activeChapter.title}
            >
              {activeChapter.title}
            </span>
          </div>

          {/* Right: Autosave Indicator, Focus Mode & AI Notes Toggles */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Prominent Autosave Ink Drying Indicator */}
            <div
              className="px-2.5 py-1 rounded border hidden sm:flex items-center shrink-0"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              <InkDryingIndicator status={saveStatus} lastSavedAt={lastSavedTime} />
            </div>

            {/* AI Margin Notes Trigger Button */}
            <button
              type="button"
              onClick={() => setIsAIPanelOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-manuscript rounded-sm border transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              style={{
                borderColor: isAIPanelOpen ? 'var(--accent-primary)' : 'var(--border-brass)',
                backgroundColor: isAIPanelOpen ? 'var(--accent-primary)' : 'var(--bg-surface)',
                color: isAIPanelOpen ? '#F4EFE5' : 'var(--text-primary)',
              }}
              title="Open AI Margin Notes & Editorial Critique"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              <span className="hidden xl:inline">AI Margin Notes</span>
              <span className="hidden sm:inline xl:hidden">Margin Notes</span>
              <span className="sm:hidden">Notes</span>
            </button>

            {/* Focus Mode Trigger Button */}
            <button
              type="button"
              onClick={() => setIsFocusMode((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 text-xs font-manuscript rounded-sm border transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              style={{
                borderColor: isFocusMode ? 'var(--accent-primary)' : 'var(--border-hairline)',
                backgroundColor: isFocusMode ? 'var(--burgundy-wash)' : 'var(--bg-surface)',
                color: isFocusMode ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
              title="Enter Distraction-Free Focus Mode (Cmd+Shift+F)"
            >
              {isFocusMode ? <Minimize2 className="w-3.5 h-3.5 shrink-0" /> : <Maximize2 className="w-3.5 h-3.5 shrink-0" />}
              <span className="hidden md:inline">{isFocusMode ? 'Exit Focus' : 'Focus'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. FLOATING BRASS DRAFTING TOOLBAR (ALWAYS VISIBLE ABOVE THE MANUSCRIPT)
         ===================================================================== */}
      <div
        className={`sticky top-14 z-20 flex justify-center py-2 px-4 transition-all duration-300 ${
          isFocusMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'
        }`}
      >
        <DeskToolbar
          onFormat={handleFormat}
          onInsertSceneBreak={handleInsertSceneBreak}
          onToggleFocusMode={() => setIsFocusMode((prev) => !prev)}
          onToggleAIPanel={() => setIsAIPanelOpen((prev) => !prev)}
          isFocusMode={isFocusMode}
          isAIPanelOpen={isAIPanelOpen}
        />
      </div>

      {/* =====================================================================
          3. TACTILE FLOATING MARGIN TABS (CONTENTS & AI NOTES)
         ===================================================================== */}
      {/* Left Margin Tab: Table of Contents */}
      {!isFocusMode && !isDrawerOpen && (
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 hidden lg:flex items-center gap-1.5 py-3 px-2 rounded-r-md border-r border-y shadow-md text-xs font-manuscript select-none cursor-pointer transition-all hover:pl-3"
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg) translateY(50%)',
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-brass)',
            color: 'var(--text-primary)',
          }}
          title="Open Table of Contents (Chapters)"
        >
          <BookOpen className="w-3.5 h-3.5 rotate-90" style={{ color: 'var(--accent-brass)' }} />
          <span>Contents ({projectChapters.length})</span>
        </button>
      )}

      {/* Right Margin Tab: AI Margin Notes Bookmark */}
      {!isFocusMode && !isAIPanelOpen && (
        <button
          type="button"
          onClick={() => setIsAIPanelOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 hidden lg:flex items-center gap-1.5 py-3 px-2 rounded-l-md border-l border-y shadow-md text-xs font-manuscript select-none cursor-pointer transition-all hover:pr-3"
          style={{
            writingMode: 'vertical-rl',
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-brass)',
            color: 'var(--text-primary)',
          }}
          title="Open AI Margin Notes Panel"
        >
          <Sparkles className="w-3.5 h-3.5 rotate-90" style={{ color: 'var(--accent-primary)' }} />
          <span>❦ AI Margin Notes</span>
        </button>
      )}

      {/* =====================================================================
          4. CENTERED MANUSCRIPT STAGE
         ===================================================================== */}
      <div className="flex-1 flex flex-col justify-start items-center px-4 sm:px-6 md:px-8 py-6 sm:py-10 relative z-10 desk-workspace-stage">
        {/* Distraction-Free Exit Button Floating Banner */}
        {isFocusMode && (
          <div className="fixed top-4 right-6 z-40">
            <button
              type="button"
              onClick={() => setIsFocusMode(false)}
              className="px-3.5 py-1.5 text-xs font-manuscript rounded-sm border inline-flex items-center gap-2 cursor-pointer shadow-lg backdrop-blur-md"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-brass)',
                color: 'var(--text-primary)',
              }}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit Focus Mode (Esc)</span>
            </button>
          </div>
        )}

        {/* The Genuinely Editable Manuscript Paper Sheet */}
        <ManuscriptEditor
          key={activeChapter.id}
          chapterId={activeChapter.id}
          ref={editorRef}
          initialContent={activeChapter.content}
          chapterOrder={activeChapter.order}
          chapterTitle={activeChapter.title}
          onTitleChange={handleChapterTitleChange}
          onChange={handleEditorContentChange}
          onSelectionChange={setSelectedText}
          isFocusMode={isFocusMode}
          dimNonActiveParagraphs={dimParagraphs}
        />
      </div>

      {/* =====================================================================
          5. QUIET MANUSCRIPT FOOTER (LIVE WORD COUNT, SESSION & GOAL)
         ===================================================================== */}
      <footer
        className={`sticky bottom-0 z-20 border-t backdrop-blur-md transition-all duration-300 ${
          isFocusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 96%, transparent)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="max-w-[1260px] mx-auto px-5 sm:px-8 h-12 flex items-center justify-between gap-4 text-xs font-manuscript">
          {/* Chapter & Session Word Counts */}
          <div className="flex items-center gap-3 sm:gap-5 min-w-0 font-mono-tabular" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {formatWordCount(activeChapter.wordCount)} words
            </span>

            <span aria-hidden="true" style={{ color: 'var(--border-brass)' }}>
              ·
            </span>

            <span title="Words inked during this drafting session">
              {sessionWords > 0 ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  +{formatWordCount(sessionWords)} session
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>0 session</span>
              )}
            </span>

            <span aria-hidden="true" className="hidden sm:inline" style={{ color: 'var(--border-brass)' }}>
              ·
            </span>

            <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
              ≈ {readingTimeMinutes} min read
            </span>

            {/* Mobile autosave indicator */}
            <div className="sm:hidden flex items-center pl-1">
              <InkDryingIndicator status={saveStatus} lastSavedAt={lastSavedTime} />
            </div>
          </div>

          {/* Volume Goal Progress & Focus Options */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Paragraph Focus Dimming Toggle */}
            <button
              type="button"
              onClick={() => setDimParagraphs((prev) => !prev)}
              title={dimParagraphs ? 'Disable paragraph focus dimming' : 'Enable paragraph focus dimming'}
              className="hidden md:inline-flex items-center gap-1.5 text-xs transition-opacity cursor-pointer hover:opacity-80"
              style={{
                color: dimParagraphs ? 'var(--accent-primary)' : 'var(--text-muted)',
              }}
            >
              <Eye className="w-3.5 h-3.5" strokeWidth={1.4} />
              <span>Paragraph Focus</span>
            </button>

            <span aria-hidden="true" className="hidden md:inline" style={{ color: 'var(--border-brass)' }}>
              ·
            </span>

            {/* Novel Goal Bar */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline font-mono-tabular" style={{ color: 'var(--text-muted)' }}>
                {formatWordCount(novelTotalWords)} / {formatWordCount(currentProject.wordGoal)}
              </span>
              <span className="font-mono-tabular font-medium" style={{ color: 'var(--accent-brass)' }}>
                {novelProgressPct}%
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          6. SLIDING CHAPTER DRAWER & AI MARGIN PANEL
         ===================================================================== */}
      <ChapterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        project={currentProject}
        chapters={projectChapters}
        activeChapterId={activeChapter.id}
        onSelectChapter={handleSelectChapter}
        onCreateChapter={handleCreateChapter}
        onDeleteChapter={handleDeleteChapter}
        projects={data.projects}
        onSwitchProject={handleSwitchProject}
      />

      <AIMarginPanel
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        selectedText={selectedText}
        contextText={activeChapter.content}
        chapterTitle={activeChapter.title}
        projectTitle={currentProject.title}
        projectGenre={currentProject.genre}
        onInsertText={handleInsertAIContent}
        onReplaceText={handleReplaceAIContent}
      />
    </div>
  );
};
