import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Target, TrendingUp, Trophy } from 'lucide-react';
import { WritingSession } from '../../types/inkwell';

interface InkBarDailyChartProps {
  sessions: WritingSession[];
  dailyGoal: number;
  timeRangeDays: 7 | 14 | 30;
  onTimeRangeChange: (days: 7 | 14 | 30) => void;
}

export const InkBarDailyChart: React.FC<InkBarDailyChartProps> = ({
  sessions,
  dailyGoal,
  timeRangeDays,
  onTimeRangeChange,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Generate date array for the selected time range ending today
  const dailyData = useMemo(() => {
    const list: Array<{
      dateStr: string;
      label: string;
      dayOfWeek: string;
      words: number;
      minutes: number;
    }> = [];

    const now = new Date();
    for (let i = timeRangeDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
      const label = `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;

      // Aggregate words written on this date
      const daySessions = sessions.filter((s) => s.date === dateStr);
      const words = daySessions.reduce((acc, s) => acc + s.wordsWritten, 0);
      const minutes = daySessions.reduce((acc, s) => acc + s.minutesSpent, 0);

      list.push({ dateStr, label, dayOfWeek, words, minutes });
    }
    return list;
  }, [sessions, timeRangeDays]);

  // Aggregate metrics
  const totalWords = useMemo(
    () => dailyData.reduce((acc, d) => acc + d.words, 0),
    [dailyData]
  );
  const avgWords = useMemo(
    () => Math.round(totalWords / dailyData.length),
    [totalWords, dailyData]
  );
  const peakDay = useMemo(() => {
    let max = dailyData[0] || { words: 0, label: '' };
    for (const d of dailyData) {
      if (d.words > max.words) max = d;
    }
    return max;
  }, [dailyData]);
  const daysGoalMet = useMemo(
    () => dailyData.filter((d) => d.words >= dailyGoal).length,
    [dailyData, dailyGoal]
  );

  // Chart dimensions & scaling
  const chartHeight = 220;
  const maxWords = Math.max(dailyGoal * 1.35, ...dailyData.map((d) => d.words), 1200);

  return (
    <div
      className="paper-card p-6 sm:p-7 border space-y-6"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-hairline)',
      }}
    >
      {/* Header & Range Filter */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
              Engraved Copperplate Chart
            </span>
            <span aria-hidden="true" style={{ color: 'var(--border-hairline)' }}>·</span>
            <span className="text-xs font-mono-tabular" style={{ color: 'var(--text-muted)' }}>
              Target: {dailyGoal.toLocaleString()} w/day
            </span>
          </div>
          <h3 className="font-display text-xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
            Daily Words Inscribed
          </h3>
        </div>

        {/* Time Window Switcher (7 / 14 / 30 Days) */}
        <div
          className="flex items-center gap-1 p-1 border rounded-sm"
          style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--bg-canvas)' }}
        >
          {([7, 14, 30] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onTimeRangeChange(days)}
              className={`px-2.5 py-1 text-xs font-manuscript rounded-xs transition-colors cursor-pointer ${
                timeRangeDays === days
                  ? 'bg-[var(--accent-primary)] text-[#F4EFE5] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--burgundy-wash)]'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stat Ledger Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-manuscript">
        <div className="p-3 border rounded-xs bg-[var(--bg-canvas)]" style={{ borderColor: 'var(--border-hairline)' }}>
          <span className="small-caps-meta text-[10px] block" style={{ color: 'var(--text-muted)' }}>
            Total Inscribed
          </span>
          <p className="font-display text-lg font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {totalWords.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">words</span>
          </p>
        </div>

        <div className="p-3 border rounded-xs bg-[var(--bg-canvas)]" style={{ borderColor: 'var(--border-hairline)' }}>
          <span className="small-caps-meta text-[10px] block" style={{ color: 'var(--text-muted)' }}>
            Daily Velocity
          </span>
          <p className="font-display text-lg font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {avgWords.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">w/day</span>
          </p>
        </div>

        <div className="p-3 border rounded-xs bg-[var(--bg-canvas)]" style={{ borderColor: 'var(--border-hairline)' }}>
          <span className="small-caps-meta text-[10px] block" style={{ color: 'var(--text-muted)' }}>
            Peak Record
          </span>
          <p className="font-display text-lg font-medium mt-0.5" style={{ color: 'var(--accent-primary)' }}>
            {peakDay.words.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">words</span>
          </p>
        </div>

        <div className="p-3 border rounded-xs bg-[var(--bg-canvas)]" style={{ borderColor: 'var(--border-hairline)' }}>
          <span className="small-caps-meta text-[10px] block" style={{ color: 'var(--text-muted)' }}>
            Goal Achieved
          </span>
          <p className="font-display text-lg font-medium mt-0.5" style={{ color: 'var(--accent-brass)' }}>
            {daysGoalMet} of {dailyData.length} <span className="text-xs font-normal text-[var(--text-muted)]">days</span>
          </p>
        </div>
      </div>

      {/* SVG Engraving Chart */}
      <div className="relative pt-4 select-none">
        <svg
          viewBox={`0 0 860 ${chartHeight + 40}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            {/* Fine Vertical Engraving Hatch Pattern */}
            <pattern
              id="ink-hatch-fine"
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.35" />
            </pattern>

            {/* Cross-hatch for days meeting or exceeding goal */}
            <pattern
              id="ink-hatch-cross"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="6" y2="6" stroke="#FAF6ED" strokeWidth="0.8" strokeOpacity="0.4" />
              <line x1="6" y1="0" x2="0" y2="6" stroke="#FAF6ED" strokeWidth="0.8" strokeOpacity="0.4" />
            </pattern>

            {/* Iron-gall ink gradient */}
            <linearGradient id="iron-gall-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#713D43" />
              <stop offset="100%" stopColor="#24231F" />
            </linearGradient>

            {/* Muted sepia gradient for below-goal bars */}
            <linearGradient id="sepia-wash-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8C683C" />
              <stop offset="100%" stopColor="#5B3E2B" />
            </linearGradient>
          </defs>

          {/* Background Engraving Grid Lines */}
          <g stroke="var(--border-hairline)" strokeWidth="0.8" opacity="0.7">
            {/* Horizontal baseline */}
            <line x1="40" y1={chartHeight} x2="840" y2={chartHeight} strokeWidth="1.2" stroke="var(--text-primary)" />
            {/* Midline 50% max */}
            <line x1="40" y1={chartHeight * 0.5} x2="840" y2={chartHeight * 0.5} strokeDasharray="3 4" />
            {/* Top boundary */}
            <line x1="40" y1="15" x2="840" y2="15" strokeDasharray="2 6" opacity="0.4" />
          </g>

          {/* Daily Goal Threshold Line (Antique Brass Dashed Rule) */}
          {(() => {
            const goalY = chartHeight - (dailyGoal / maxWords) * (chartHeight - 30);
            return (
              <g className="goal-threshold">
                <line
                  x1="40"
                  y1={goalY}
                  x2="840"
                  y2={goalY}
                  stroke="var(--accent-brass)"
                  strokeWidth="1.2"
                  strokeDasharray="5 3"
                />
                <rect
                  x="844"
                  y={goalY - 8}
                  width="54"
                  height="16"
                  rx="2"
                  fill="var(--bg-canvas)"
                  stroke="var(--accent-brass)"
                  strokeWidth="0.8"
                />
                <text
                  x="871"
                  y={goalY + 3.5}
                  textAnchor="middle"
                  fill="var(--accent-brass)"
                  fontFamily="'IBM Plex Mono', monospace"
                  fontSize="9.5"
                  fontWeight="500"
                >
                  Goal
                </text>
              </g>
            );
          })()}

          {/* Engraved Ink Bars */}
          {(() => {
            const chartWidth = 790;
            const barCount = dailyData.length;
            const slotWidth = chartWidth / barCount;
            const barWidth = Math.min(slotWidth * 0.65, 38);

            return dailyData.map((d, i) => {
              const isHovered = hoveredIndex === i;
              const barHeight = d.words > 0 ? Math.max(6, (d.words / maxWords) * (chartHeight - 30)) : 0;
              const x = 50 + i * slotWidth + (slotWidth - barWidth) / 2;
              const y = chartHeight - barHeight;
              const isGoalMet = d.words >= dailyGoal;

              return (
                <g
                  key={d.dateStr}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Invisible hit-area */}
                  <rect
                    x={50 + i * slotWidth}
                    y={10}
                    width={slotWidth}
                    height={chartHeight + 30}
                    fill="transparent"
                  />

                  {/* Empty day baseline notch if 0 words */}
                  {d.words === 0 && (
                    <circle
                      cx={x + barWidth / 2}
                      cy={chartHeight}
                      r="2"
                      fill="var(--border-brass)"
                      opacity="0.6"
                    />
                  )}

                  {/* Active Bar Body */}
                  {barHeight > 0 && (
                    <g>
                      {/* Bar Fill */}
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx="1.5"
                        fill={isGoalMet ? 'url(#iron-gall-grad)' : 'url(#sepia-wash-grad)'}
                        stroke={isHovered ? 'var(--accent-brass)' : isGoalMet ? '#582D32' : 'var(--border-brass)'}
                        strokeWidth={isHovered ? 1.8 : 0.9}
                      />

                      {/* Engraved Hatch Overlay */}
                      <rect
                        x={x + 1}
                        y={y + 1}
                        width={barWidth - 2}
                        height={barHeight - 2}
                        fill={isGoalMet ? 'url(#ink-hatch-cross)' : 'url(#ink-hatch-fine)'}
                        className="pointer-events-none"
                      />

                      {/* Highlighted Cap on Bar */}
                      <line
                        x1={x}
                        y1={y}
                        x2={x + barWidth}
                        y2={y}
                        stroke={isGoalMet ? '#FAF6ED' : 'var(--accent-brass)'}
                        strokeWidth="1.4"
                        opacity={isHovered ? 1 : 0.8}
                      />
                    </g>
                  )}

                  {/* Date label beneath baseline */}
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight + 16}
                    textAnchor="middle"
                    fill={isHovered ? 'var(--accent-primary)' : 'var(--text-muted)'}
                    fontFamily="'EB Garamond', serif"
                    fontSize="11"
                    fontWeight={isHovered ? '600' : '400'}
                  >
                    {timeRangeDays === 30 && i % 3 !== 0 ? '' : d.dayOfWeek}
                  </text>
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight + 28}
                    textAnchor="middle"
                    fill="var(--text-secondary)"
                    fontFamily="'IBM Plex Mono', monospace"
                    fontSize="9.5"
                    opacity={timeRangeDays === 30 && i % 3 !== 0 ? 0 : 0.85}
                  >
                    {d.dateStr.slice(8)}
                  </text>
                </g>
              );
            });
          })()}
        </svg>

        {/* Floating Callout Tooltip on Hover */}
        <AnimatePresence>
          {hoveredIndex !== null && dailyData[hoveredIndex] && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute top-1 left-1/2 -translate-x-1/2 px-4 py-2 paper-folio border shadow-md flex items-center gap-4 text-xs font-manuscript"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--accent-brass)',
              }}
            >
              <div>
                <span className="small-caps-meta text-[10px] block" style={{ color: 'var(--accent-brass)' }}>
                  {dailyData[hoveredIndex].dayOfWeek} · {dailyData[hoveredIndex].label}
                </span>
                <p className="font-display text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {dailyData[hoveredIndex].words.toLocaleString()} words inscribed
                </p>
              </div>

              <div className="h-6 w-px bg-[var(--border-hairline)]" />

              <div className="text-right">
                <span className="small-caps-meta text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                  Goal Quota
                </span>
                <span
                  className="font-mono-tabular font-medium text-xs"
                  style={{
                    color:
                      dailyData[hoveredIndex].words >= dailyGoal
                        ? 'var(--accent-primary)'
                        : 'var(--text-secondary)',
                  }}
                >
                  {Math.round((dailyData[hoveredIndex].words / dailyGoal) * 100)}% of goal
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
