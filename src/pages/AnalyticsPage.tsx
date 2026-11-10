import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle,
  Compass,
  Feather,
  Flame,
  Layers,
  Plus,
  Sliders,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { useInkwell } from '../store/inkwellStore';
import { useToast } from '../hooks/useToast';
import { InkBarDailyChart } from '../components/analytics/InkBarDailyChart';
import { InkDotStreakCalendar } from '../components/analytics/InkDotStreakCalendar';
import { InkwellGoalFill } from '../components/analytics/InkwellGoalFill';
import { ChapterBreakdownChart } from '../components/analytics/ChapterBreakdownChart';
import { LogSessionDialog } from '../components/analytics/LogSessionDialog';
import { CornerOrnament, FleuronDivider } from '../components/ornaments/Ornaments';

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    data,
    activeProject,
    recordWritingSession,
    updateSettings,
    getProjectChapters,
    getProjectWordCount,
  } = useInkwell();
  const { notify } = useToast();

  // Selected volume filter (defaults to active project or all)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    activeProject?.id ?? 'all'
  );

  // Time range for daily chart (7, 14, 30 days)
  const [dailyRange, setDailyRange] = useState<7 | 14 | 30>(14);

  // Log session dialog
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);

  // Selected project object
  const currentProject = useMemo(() => {
    if (selectedProjectId === 'all') return activeProject || data.projects[0] || null;
    return data.projects.find((p) => p.id === selectedProjectId) || activeProject || null;
  }, [selectedProjectId, activeProject, data.projects]);

  // Filtered chapters for current project
  const currentChapters = useMemo(() => {
    if (!currentProject) return [];
    return getProjectChapters(currentProject.id);
  }, [currentProject, getProjectChapters]);

  // Project word count
  const projectWordCount = useMemo(() => {
    if (!currentProject) return 0;
    return getProjectWordCount(currentProject.id);
  }, [currentProject, getProjectWordCount]);

  // Filtered writing sessions
  const filteredSessions = useMemo(() => {
    if (selectedProjectId === 'all') return data.sessions;
    return data.sessions.filter((s) => s.projectId === selectedProjectId);
  }, [data.sessions, selectedProjectId]);

  // Recent 7-day velocity
  const recent7DayVelocity = useMemo(() => {
    const now = new Date();
    const past7 = new Date();
    past7.setDate(now.getDate() - 7);
    const past7Str = past7.toISOString().slice(0, 10);

    const recentSessions = filteredSessions.filter((s) => s.date >= past7Str);
    const totalWordsPast7 = recentSessions.reduce((acc, s) => acc + s.wordsWritten, 0);
    return Math.round(totalWordsPast7 / 7);
  }, [filteredSessions]);

  // Handler for logging words
  const handleLogWords = (projectId: string, words: number) => {
    recordWritingSession(projectId, words);
    const proj = data.projects.find((p) => p.id === projectId);
    notify(
      'Session Inscribed',
      `+${words.toLocaleString()} words recorded in the ledger for “${proj?.title || 'Manuscript'}”.`
    );
  };

  // Adjust daily goal
  const handleSetDailyGoal = (newGoal: number) => {
    const clamped = Math.max(100, Math.min(10000, newGoal));
    updateSettings({ dailyWordGoal: clamped });
    notify('Daily Target Adjusted', `Daily goal calibrated to ${clamped.toLocaleString()} words/day.`);
  };

  return (
    <div className="max-w-[1260px] mx-auto px-5 sm:px-8 lg:px-12 pt-8 sm:pt-12 pb-24 space-y-10">
      {/* =====================================================================
          1. MASTHEAD & STUDY LEDGER HEADER
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
              Folio VI · Study Ledger
            </p>
          </div>

          <h1
            className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Writing Analytics
          </h1>

          <div
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm pt-1"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="font-mono-tabular">
              {data.sessions.reduce((acc, s) => acc + s.wordsWritten, 0).toLocaleString()} lifetime words logged
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{data.projects.length} volumes in atelier</span>
            <span aria-hidden="true">·</span>
            <span className="italic">Custom copperplate engraving charts</span>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={() => setIsLogDialogOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-manuscript cursor-pointer transition-opacity hover:opacity-95 whitespace-nowrap shadow-sm"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#F4EFE5',
          }}
        >
          <Feather className="w-4 h-4" strokeWidth={1.4} />
          <span>Inscribe Words into Ledger</span>
        </button>
      </motion.section>

      {/* =====================================================================
          2. VOLUME SELECTOR & TARGET SETTING BAR
         ===================================================================== */}
      <section className="flex flex-wrap items-center justify-between gap-4 p-4 paper-card border rounded-xs" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-hairline)' }}>
        {/* Volume Scope */}
        <div className="flex items-center gap-3">
          <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
            Manuscript Scope:
          </span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-1.5 text-xs font-manuscript border focus:outline-none cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-brass)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="all">All Atelier Volumes Combined</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.genre})
              </option>
            ))}
          </select>
        </div>

        {/* Daily Goal Calibration Stepper */}
        <div className="flex items-center gap-3 text-xs font-manuscript">
          <span className="small-caps-meta text-xs" style={{ color: 'var(--text-muted)' }}>
            Daily Goal:
          </span>
          <div
            className="flex items-center gap-1 p-0.5 border rounded-xs"
            style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--bg-canvas)' }}
          >
            {[500, 750, 1000, 1500, 2000].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => handleSetDailyGoal(g)}
                className={`px-2 py-0.5 text-xs font-mono-tabular rounded-xs cursor-pointer transition-colors ${
                  data.settings.dailyWordGoal === g
                    ? 'bg-[var(--accent-primary)] text-[#F4EFE5] font-medium'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--burgundy-wash)]'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <span className="text-[var(--text-muted)] text-[11px]">words/day</span>
        </div>
      </section>

      {/* =====================================================================
          3. CHART 1: INKWELL MANUSCRIPT GOAL FILL
         ===================================================================== */}
      <section>
        <InkwellGoalFill
          project={currentProject}
          totalWords={projectWordCount}
          recentDailyVelocity={recent7DayVelocity}
        />
      </section>

      {/* =====================================================================
          4. CHART 2: DAILY WORDS ENGRAVING BAR CHART
         ===================================================================== */}
      <section>
        <InkBarDailyChart
          sessions={filteredSessions}
          dailyGoal={data.settings.dailyWordGoal}
          timeRangeDays={dailyRange}
          onTimeRangeChange={setDailyRange}
        />
      </section>

      {/* =====================================================================
          5. CHART 3: INK-DOT STREAK MATRIX (ALMANAC CALENDAR)
         ===================================================================== */}
      <section>
        <InkDotStreakCalendar
          sessions={filteredSessions}
          dailyGoal={data.settings.dailyWordGoal}
        />
      </section>

      {/* =====================================================================
          6. CHART 4: CHAPTER RHYTHM & PROPORTION CHART
         ===================================================================== */}
      {currentChapters.length > 0 && (
        <section>
          <ChapterBreakdownChart
            chapters={currentChapters}
            project={currentProject}
            onSelectChapter={(chId) => navigate(`/desk?chapterId=${chId}`)}
          />
        </section>
      )}

      {/* Colophon Footnote */}
      <div className="pt-6 border-t flex flex-wrap items-center justify-between gap-4 text-xs font-manuscript text-[var(--text-muted)]" style={{ borderColor: 'var(--border-hairline)' }}>
        <span>Inkwell Literary Atelier · Study Ledger &amp; Writing Analytics</span>
        <span className="italic">Data preserved locally upon the author’s writing desk</span>
      </div>

      {/* Log Session Dialog */}
      <LogSessionDialog
        open={isLogDialogOpen}
        onClose={() => setIsLogDialogOpen(false)}
        projects={data.projects}
        activeProjectId={selectedProjectId !== 'all' ? selectedProjectId : (activeProject?.id ?? '')}
        onLogWords={handleLogWords}
      />
    </div>
  );
};
