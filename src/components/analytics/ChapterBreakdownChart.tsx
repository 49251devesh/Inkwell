import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Layers, BookOpen, BarChart3, AlertCircle } from 'lucide-react';
import { Chapter, Project } from '../../types/inkwell';

interface ChapterBreakdownChartProps {
  chapters: Chapter[];
  project: Project | null;
  onSelectChapter?: (chapterId: string) => void;
}

export const ChapterBreakdownChart: React.FC<ChapterBreakdownChartProps> = ({
  chapters,
  project,
  onSelectChapter,
}) => {
  const [hoveredChapterId, setHoveredChapterId] = useState<string | null>(null);

  // Sort chapters by order
  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => a.order - b.order);
  }, [chapters]);

  // Aggregate word metrics
  const totalVolumeWords = useMemo(() => {
    return sortedChapters.reduce((acc, ch) => acc + ch.wordCount, 0);
  }, [sortedChapters]);

  const avgChapterWords = useMemo(() => {
    if (sortedChapters.length === 0) return 0;
    return Math.round(totalVolumeWords / sortedChapters.length);
  }, [totalVolumeWords, sortedChapters]);

  const maxChapterWords = useMemo(() => {
    return Math.max(1, ...sortedChapters.map((ch) => ch.wordCount));
  }, [sortedChapters]);

  // Total reading time (estimated at 225 words per minute)
  const totalReadingMinutes = useMemo(() => {
    return Math.ceil(totalVolumeWords / 225);
  }, [totalVolumeWords]);

  const readingTimeFormatted = useMemo(() => {
    const hours = Math.floor(totalReadingMinutes / 60);
    const mins = totalReadingMinutes % 60;
    if (hours === 0) return `${mins} min`;
    return `${hours} hr ${mins} min`;
  }, [totalReadingMinutes]);

  // Classical roman numeral generator
  const toRoman = (num: number): string => {
    const romanMap: Array<[number, string]> = [
      [10, 'X'],
      [9, 'IX'],
      [5, 'V'],
      [4, 'IV'],
      [1, 'I'],
    ];
    let res = '';
    let n = num;
    for (const [val, sym] of romanMap) {
      while (n >= val) {
        res += sym;
        n -= val;
      }
    }
    return res || 'I';
  };

  // Color & hatch palette array for chapters
  const chapterHues = [
    { bg: '#713D43', border: '#582D32' },
    { bg: '#8C683C', border: '#5B3E2B' },
    { bg: '#582D32', border: '#462025' },
    { bg: '#B18A5A', border: '#8C683C' },
    { bg: '#3D352E', border: '#24231F' },
    { bg: '#623238', border: '#462025' },
  ];

  return (
    <div
      className="paper-card p-6 sm:p-7 border space-y-6"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-hairline)',
      }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
        <div>
          <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
            Architectural Proportion Chart
          </span>
          <h3 className="font-display text-xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
            Chapter Rhythm &amp; Proportions
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs font-manuscript" style={{ color: 'var(--text-muted)' }}>
          <span>{sortedChapters.length} Chapters</span>
          <span aria-hidden="true">·</span>
          <span>Avg: {avgChapterWords.toLocaleString()} w</span>
          <span aria-hidden="true">·</span>
          <span>Reading: ~{readingTimeFormatted}</span>
        </div>
      </div>

      {/* 1. Engraved Segmented Manuscript Ribbon (Proportional Share) */}
      <div className="space-y-2 select-none">
        <div className="flex items-center justify-between text-xs font-manuscript" style={{ color: 'var(--text-muted)' }}>
          <span>Full Manuscript Ribbon:</span>
          <span>{totalVolumeWords.toLocaleString()} total words</span>
        </div>

        <div
          className="relative w-full h-9 rounded-xs border flex overflow-hidden p-0.5"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-brass)',
          }}
        >
          {sortedChapters.map((ch, idx) => {
            const ratio = totalVolumeWords > 0 ? (ch.wordCount / totalVolumeWords) * 100 : 100 / sortedChapters.length;
            const isHovered = hoveredChapterId === ch.id;
            const styleHue = chapterHues[idx % chapterHues.length];

            return (
              <div
                key={ch.id}
                onMouseEnter={() => setHoveredChapterId(ch.id)}
                onMouseLeave={() => setHoveredChapterId(null)}
                onClick={() => onSelectChapter?.(ch.id)}
                style={{
                  width: `${Math.max(ratio, 4)}%`,
                  backgroundColor: styleHue.bg,
                  borderColor: isHovered ? '#FAF6ED' : styleHue.border,
                }}
                className={`relative h-full border-r last:border-r-0 cursor-pointer transition-all duration-150 flex items-center justify-center overflow-hidden ${
                  isHovered ? 'brightness-125 z-10 ring-1 ring-[#FAF6ED]' : 'hover:opacity-95'
                }`}
                title={`Chapter ${ch.order}: ${ch.title} (${ch.wordCount.toLocaleString()} words, ${Math.round(ratio)}%)`}
              >
                {/* Diagonal hatch pattern overlay */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, #FAF6ED 3px, #FAF6ED 4px)',
                  }}
                />

                <span className="relative z-10 text-[10px] font-mono-tabular font-medium text-[#FAF6ED] drop-shadow-xs">
                  {toRoman(ch.order)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Individual Chapter Horizontal Bars & Cadence Ledger */}
      <div className="space-y-3 pt-2">
        <span className="small-caps-meta text-xs block" style={{ color: 'var(--accent-brass)' }}>
          Chapter Length Distribution
        </span>

        <div className="space-y-2.5">
          {sortedChapters.map((ch, idx) => {
            const isHovered = hoveredChapterId === ch.id;
            const percentOfMax = Math.round((ch.wordCount / maxChapterWords) * 100);
            const percentOfTotal = totalVolumeWords > 0 ? Math.round((ch.wordCount / totalVolumeWords) * 100) : 0;
            const readingMins = Math.ceil(ch.wordCount / 225);

            // Pacing rhythm label
            let pacingTag = 'Balanced Folio';
            if (ch.wordCount < 2000) pacingTag = 'Tight Scene / Interlude';
            else if (ch.wordCount > 4500) pacingTag = 'Expansive Sequence';

            return (
              <div
                key={ch.id}
                onMouseEnter={() => setHoveredChapterId(ch.id)}
                onMouseLeave={() => setHoveredChapterId(null)}
                onClick={() => onSelectChapter?.(ch.id)}
                className={`p-3 rounded-xs border transition-colors cursor-pointer text-xs font-manuscript ${
                  isHovered
                    ? 'border-[var(--accent-brass)] bg-[var(--burgundy-wash)]/40 shadow-xs'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:border-[var(--border-brass)]'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono-tabular font-semibold text-xs" style={{ color: 'var(--accent-brass)' }}>
                      {toRoman(ch.order)}.
                    </span>
                    <h5 className="font-display text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {ch.title}
                    </h5>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs font-mono-tabular" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {ch.wordCount.toLocaleString()} words
                    </span>
                    <span style={{ color: 'var(--border-hairline)' }}>·</span>
                    <span>{percentOfTotal}% share</span>
                    <span style={{ color: 'var(--border-hairline)' }}>·</span>
                    <span className="italic" style={{ color: 'var(--text-muted)' }}>
                      ~{readingMins} min read
                    </span>
                  </div>
                </div>

                {/* Engraved Horizontal Proportion Bar */}
                <div
                  className="w-full h-2 rounded-xs border overflow-hidden p-0.5"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-hairline)' }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentOfMax}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-xs"
                    style={{
                      background: isHovered
                        ? 'linear-gradient(90deg, var(--accent-brass), var(--accent-primary))'
                        : 'var(--accent-primary)',
                    }}
                  />
                </div>

                {/* Cadence descriptor */}
                <div className="flex items-center justify-between text-[11px] pt-1" style={{ color: 'var(--text-muted)' }}>
                  <span className="italic">{pacingTag}</span>
                  {ch.notes && <span className="truncate max-w-[280px]">Note: {ch.notes}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
