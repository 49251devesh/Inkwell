import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Award, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { WritingSession } from '../../types/inkwell';

interface InkDotStreakCalendarProps {
  sessions: WritingSession[];
  dailyGoal: number;
}

export const InkDotStreakCalendar: React.FC<InkDotStreakCalendarProps> = ({
  sessions,
  dailyGoal,
}) => {
  const [hoveredDate, setHoveredDate] = useState<{
    dateStr: string;
    words: number;
    dayOfWeek: string;
  } | null>(null);

  // Group all sessions by date string YYYY-MM-DD
  const wordsByDate = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach((s) => {
      map.set(s.date, (map.get(s.date) || 0) + s.wordsWritten);
    });
    return map;
  }, [sessions]);

  // Compute 14 weeks of calendar days (98 days)
  const calendarWeeks = useMemo(() => {
    const weeks: Array<
      Array<{
        dateStr: string;
        date: Date;
        words: number;
        isToday: boolean;
        isFuture: boolean;
      }>
    > = [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // End on upcoming Saturday or today
    const currentDayOfWeek = now.getDay(); // 0 is Sunday
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + (6 - currentDayOfWeek));

    // 14 weeks = 14 * 7 = 98 days
    const totalDays = 14 * 7;
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - totalDays + 1);

    let currentWeek: Array<{
      dateStr: string;
      date: Date;
      words: number;
      isToday: boolean;
      isFuture: boolean;
    }> = [];

    const iter = new Date(startDate);
    while (iter <= endDate) {
      const dateStr = iter.toISOString().slice(0, 10);
      const isToday = iter.getTime() === now.getTime();
      const isFuture = iter.getTime() > now.getTime();
      const words = isFuture ? 0 : wordsByDate.get(dateStr) || 0;

      currentWeek.push({
        dateStr,
        date: new Date(iter),
        words,
        isToday,
        isFuture,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      iter.setDate(iter.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [wordsByDate]);

  // Streak calculations
  const streakStats = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Check consecutive days starting today or yesterday
    let currentStreak = 0;
    const checkDate = new Date(now);

    const todayStr = checkDate.toISOString().slice(0, 10);
    const hasToday = (wordsByDate.get(todayStr) || 0) > 0;
    if (!hasToday) {
      // Check yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dStr = checkDate.toISOString().slice(0, 10);
      const words = wordsByDate.get(dStr) || 0;
      if (words > 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Longest streak in past 120 days
    let longestStreak = 0;
    let tempStreak = 0;
    const testDate = new Date(now);
    testDate.setDate(now.getDate() - 120);

    while (testDate <= now) {
      const dStr = testDate.toISOString().slice(0, 10);
      const words = wordsByDate.get(dStr) || 0;
      if (words > 0) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
      testDate.setDate(testDate.getDate() + 1);
    }

    // Total active writing days
    let totalActiveDays = 0;
    wordsByDate.forEach((w) => {
      if (w > 0) totalActiveDays++;
    });

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      totalActiveDays,
      consistency: Math.min(100, Math.round((totalActiveDays / 70) * 100)),
    };
  }, [wordsByDate]);

  const daysLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
            Chronicle Almanac
          </span>
          <h3 className="font-display text-xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
            Ink-Dot Streak Matrix
          </h3>
        </div>
        <p className="text-xs font-manuscript italic" style={{ color: 'var(--text-muted)' }}>
          Each ink drop commemorates a day of quill upon parchment.
        </p>
      </div>

      {/* Streak Tally Badges (Classical Engraving) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-manuscript">
        <div className="p-3 border rounded-xs bg-[var(--bg-canvas)]" style={{ borderColor: 'var(--border-hairline)' }}>
          <div className="flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
            <Flame className="w-3.5 h-3.5" />
            <span className="small-caps-meta text-[10px]">Current Streak</span>
          </div>
          <p className="font-display text-lg font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
            {streakStats.currentStreak} <span className="text-xs font-normal text-[var(--text-muted)]">days unbroken</span>
          </p>
        </div>

        <div className="p-3 border rounded-xs bg-[var(--bg-canvas)]" style={{ borderColor: 'var(--border-hairline)' }}>
          <div className="flex items-center gap-1.5" style={{ color: 'var(--accent-brass)' }}>
            <Award className="w-3.5 h-3.5" />
            <span className="small-caps-meta text-[10px]">Longest Streak</span>
          </div>
          <p className="font-display text-lg font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
            {streakStats.longestStreak} <span className="text-xs font-normal text-[var(--text-muted)]">days record</span>
          </p>
        </div>

        <div className="p-3 border rounded-xs bg-[var(--bg-canvas)]" style={{ borderColor: 'var(--border-hairline)' }}>
          <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <CalendarCheck className="w-3.5 h-3.5" />
            <span className="small-caps-meta text-[10px]">Active Inscriptions</span>
          </div>
          <p className="font-display text-lg font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
            {streakStats.totalActiveDays} <span className="text-xs font-normal text-[var(--text-muted)]">days recorded</span>
          </p>
        </div>

        <div className="p-3 border rounded-xs bg-[var(--bg-canvas)]" style={{ borderColor: 'var(--border-hairline)' }}>
          <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="small-caps-meta text-[10px]">Consistency</span>
          </div>
          <p className="font-display text-lg font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
            {streakStats.consistency}% <span className="text-xs font-normal text-[var(--text-muted)]">habit index</span>
          </p>
        </div>
      </div>

      {/* Almanac Matrix SVG */}
      <div className="relative pt-2 select-none overflow-x-auto">
        <div className="min-w-[620px]">
          <svg viewBox="0 0 760 160" className="w-full h-auto overflow-visible">
            {/* Day of Week Row Labels (Left Column) */}
            <g fontFamily="'EB Garamond', serif" fontSize="10" fill="var(--text-muted)">
              {daysLabels.map((day, dIdx) => (
                <text key={dIdx} x="12" y={28 + dIdx * 18} textAnchor="middle">
                  {dIdx % 2 === 1 ? day : ''}
                </text>
              ))}
            </g>

            {/* Matrix of Ink Dots */}
            <g transform="translate(32, 14)">
              {calendarWeeks.map((week, wIdx) => {
                const x = wIdx * 50;

                // Month header label if first week of month
                const firstDayOfWeek = week[0]?.date;
                const isNewMonth = firstDayOfWeek && (firstDayOfWeek.getDate() <= 7 || wIdx === 0);
                const monthName = firstDayOfWeek?.toLocaleDateString('en-US', { month: 'short' });

                return (
                  <g key={wIdx}>
                    {/* Month Label */}
                    {isNewMonth && (
                      <text
                        x={x + 14}
                        y="-4"
                        fill="var(--accent-brass)"
                        fontFamily="'IBM Plex Mono', monospace"
                        fontSize="9.5"
                        fontWeight="500"
                        letterSpacing="0.05em"
                      >
                        {monthName}
                      </text>
                    )}

                    {/* 7 Days in Week Column */}
                    {week.map((day, dIdx) => {
                      const y = dIdx * 18 + 8;
                      const isHovered = hoveredDate?.dateStr === day.dateStr;

                      if (day.isFuture) {
                        return (
                          <circle
                            key={day.dateStr}
                            cx={x + 14}
                            cy={y}
                            r="3"
                            fill="none"
                            stroke="var(--border-hairline)"
                            strokeWidth="0.6"
                            strokeDasharray="1.5 1.5"
                            opacity="0.3"
                          />
                        );
                      }

                      // Determine visual ink stamp type based on word volume
                      const isExceedingGoal = day.words >= dailyGoal;
                      const isMidWords = day.words >= 500;
                      const isLightWords = day.words > 0 && day.words < 500;
                      const isZeroWords = day.words === 0;

                      return (
                        <g
                          key={day.dateStr}
                          className="cursor-pointer"
                          onMouseEnter={() =>
                            setHoveredDate({
                              dateStr: day.dateStr,
                              words: day.words,
                              dayOfWeek: day.date.toLocaleDateString('en-US', { weekday: 'long' }),
                            })
                          }
                          onMouseLeave={() => setHoveredDate(null)}
                        >
                          {/* Hit Area */}
                          <rect
                            x={x + 4}
                            y={y - 8}
                            width="20"
                            height="16"
                            fill="transparent"
                          />

                          {/* Today Pulsing Indicator */}
                          {day.isToday && (
                            <circle
                              cx={x + 14}
                              cy={y}
                              r="8.5"
                              fill="none"
                              stroke="var(--accent-brass)"
                              strokeWidth="0.8"
                              strokeDasharray="2 2"
                            />
                          )}

                          {/* Zero Words: Hollow Paper Punch */}
                          {isZeroWords && (
                            <circle
                              cx={x + 14}
                              cy={y}
                              r="3.5"
                              fill="var(--bg-canvas)"
                              stroke={isHovered ? 'var(--text-secondary)' : 'var(--border-hairline)'}
                              strokeWidth={isHovered ? 1.2 : 0.8}
                            />
                          )}

                          {/* Light Words: Sepia Ink Wash */}
                          {isLightWords && (
                            <circle
                              cx={x + 14}
                              cy={y}
                              r="4.5"
                              fill="#B18A5A"
                              fillOpacity="0.45"
                              stroke="var(--border-brass)"
                              strokeWidth="0.9"
                            />
                          )}

                          {/* Mid Words: Walnut Ink Drop */}
                          {isMidWords && !isExceedingGoal && (
                            <g>
                              <circle
                                cx={x + 14}
                                cy={y}
                                r="5.5"
                                fill="#582D32"
                                stroke="#713D43"
                                strokeWidth="1"
                              />
                              <circle
                                cx={x + 13}
                                cy={y - 1}
                                r="1.5"
                                fill="#FAF6ED"
                                fillOpacity="0.35"
                              />
                            </g>
                          )}

                          {/* Exceeding Daily Goal: Deep Burgundy Wax Seal Medallion */}
                          {isExceedingGoal && (
                            <g>
                              <circle
                                cx={x + 14}
                                cy={y}
                                r="7"
                                fill="#713D43"
                                stroke="#8C683C"
                                strokeWidth="1.2"
                              />
                              {/* Inner brass pip */}
                              <circle
                                cx={x + 14}
                                cy={y}
                                r="2.2"
                                fill="#FAF6ED"
                              />
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Hover Tooltip */}
        <AnimatePresence>
          {hoveredDate && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2 }}
              transition={{ duration: 0.15 }}
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 paper-folio border shadow-md text-xs font-manuscript flex items-center gap-2"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-brass)',
              }}
            >
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {hoveredDate.dayOfWeek}, {hoveredDate.dateStr}:
              </span>
              <span className="italic" style={{ color: hoveredDate.words > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                {hoveredDate.words > 0
                  ? `${hoveredDate.words.toLocaleString()} words inscribed`
                  : 'No ink inscribed on this day'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Engraved Legend Key */}
      <div
        className="pt-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs font-manuscript"
        style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)]" />
            <span>Parchment Rest (0 w)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B18A5A]/50 border border-[var(--border-brass)]" />
            <span>Sepia Wash (1–499 w)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#582D32]" />
            <span>Walnut Ink (500–999 w)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#713D43] border border-[#8C683C] flex items-center justify-center text-[7px] text-[#FAF6ED]">
              ✦
            </span>
            <span className="font-medium text-[var(--accent-primary)]">Goal Seal ({dailyGoal.toLocaleString()}+ w)</span>
          </div>
        </div>

        <span className="italic hidden sm:inline">14-week archival ledger</span>
      </div>
    </div>
  );
};
