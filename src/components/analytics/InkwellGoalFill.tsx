import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Compass, Feather, Flag, Sparkles, TrendingUp } from 'lucide-react';
import { Project } from '../../types/inkwell';
import { FleuronDivider } from '../ornaments/Ornaments';

interface InkwellGoalFillProps {
  project: Project | null;
  totalWords: number;
  recentDailyVelocity: number;
  onEditGoal?: () => void;
}

export const InkwellGoalFill: React.FC<InkwellGoalFillProps> = ({
  project,
  totalWords,
  recentDailyVelocity,
  onEditGoal,
}) => {
  const goalWords = project?.wordGoal || 80000;
  const progressRatio = Math.min(1, Math.max(0, totalWords / goalWords));
  const progressPercent = Math.min(100, Math.round(progressRatio * 1000) / 10);
  const wordsRemaining = Math.max(0, goalWords - totalWords);

  // Projected completion days
  const projectedDays = useMemo(() => {
    if (wordsRemaining === 0) return 0;
    const velocity = recentDailyVelocity > 0 ? recentDailyVelocity : 650;
    return Math.ceil(wordsRemaining / velocity);
  }, [wordsRemaining, recentDailyVelocity]);

  const projectedDate = useMemo(() => {
    if (wordsRemaining === 0) return 'Complete';
    const d = new Date();
    d.setDate(d.getDate() + projectedDays);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [projectedDays, wordsRemaining]);

  // Ink fill level inside SVG inkwell:
  // Inkwell liquid chamber Y spans from y=95 (bottom) to y=32 (top full).
  // Total height = 63 units.
  const chamberBottom = 100;
  const chamberTop = 36;
  const chamberHeight = chamberBottom - chamberTop;
  const inkLevelY = chamberBottom - progressRatio * chamberHeight;

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
            Manuscript Completion Quota
          </span>
          <h3 className="font-display text-xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
            The Filling Inkwell
          </h3>
        </div>
        <span className="text-xs font-manuscript italic" style={{ color: 'var(--text-muted)' }}>
          Volume: {project?.title ?? 'Active Manuscript'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        {/* Left Column (5 cols): Handcrafted Faceted Crystal Inkwell SVG */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-4">
          <div className="relative w-48 sm:w-56 aspect-[4/5] select-none">
            <svg
              viewBox="0 0 160 140"
              className="w-full h-full overflow-visible drop-shadow-sm"
              fill="none"
            >
              <defs>
                {/* Iron-gall liquid ink fill gradient */}
                <linearGradient id="liquid-ink-depth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#713D43" />
                  <stop offset="35%" stopColor="#582D32" />
                  <stop offset="100%" stopColor="#24231F" />
                </linearGradient>

                {/* Glass reflection gradient */}
                <linearGradient id="glass-specular" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
                  <stop offset="18%" stopColor="#FFFFFF" stopOpacity="0.05" />
                  <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
                  <stop offset="82%" stopColor="#FFFFFF" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.3" />
                </linearGradient>

                {/* Crystal Bevel Hatching */}
                <pattern
                  id="glass-facet-hatch"
                  width="3"
                  height="3"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line x1="0" y1="0" x2="0" y2="3" stroke="#8C683C" strokeWidth="0.5" strokeOpacity="0.25" />
                </pattern>
              </defs>

              {/* Resting Blotter / Wooden Study Desk Line */}
              <line
                x1="12"
                y1="112"
                x2="148"
                y2="112"
                stroke="var(--border-brass)"
                strokeWidth="1.2"
              />
              <line
                x1="24"
                y1="114"
                x2="136"
                y2="114"
                stroke="var(--border-hairline)"
                strokeWidth="0.8"
              />

              {/* Heavy Faceted Glass Base Silhouette */}
              <polygon
                points="34,42 126,42 136,78 126,110 34,110 24,78"
                fill="var(--bg-recessed)"
                stroke="var(--border-brass)"
                strokeWidth="1.4"
              />

              {/* Crystal Facet Lines (Engraved geometry) */}
              <line x1="56" y1="42" x2="52" y2="110" stroke="var(--border-brass)" strokeWidth="0.9" strokeOpacity="0.6" />
              <line x1="104" y1="42" x2="108" y2="110" stroke="var(--border-brass)" strokeWidth="0.9" strokeOpacity="0.6" />
              <line x1="24" y1="78" x2="54" y2="78" stroke="var(--border-brass)" strokeWidth="0.8" strokeDasharray="2 2" strokeOpacity="0.4" />
              <line x1="106" y1="78" x2="136" y2="78" stroke="var(--border-brass)" strokeWidth="0.8" strokeDasharray="2 2" strokeOpacity="0.4" />

              {/* Liquid Ink Inside the Glass Chamber (Clips within bottle interior) */}
              <g>
                <clipPath id="inkwell-chamber-clip">
                  <polygon points="36,44 124,44 133,78 124,108 36,108 27,78" />
                </clipPath>

                {/* Animated Rising Liquid Ink */}
                <g clipPath="url(#inkwell-chamber-clip)">
                  <motion.rect
                    initial={{ y: chamberBottom, height: 0 }}
                    animate={{
                      y: inkLevelY,
                      height: chamberBottom - inkLevelY + 12,
                    }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                    x="20"
                    width="120"
                    fill="url(#liquid-ink-depth)"
                  />

                  {/* Surface Meniscus Line & Ink Surface Reflection */}
                  <motion.ellipse
                    initial={{ cy: chamberBottom }}
                    animate={{ cy: inkLevelY }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                    cx="80"
                    rx="46"
                    ry="3.5"
                    fill="#8E4E56"
                    fillOpacity="0.55"
                    stroke="#FAF6ED"
                    strokeWidth="0.8"
                    strokeOpacity="0.45"
                  />
                </g>
              </g>

              {/* Etched Glass Measurement Milestones on side */}
              <g fontFamily="'IBM Plex Mono', monospace" fontSize="6.5" fill="var(--accent-brass)" opacity="0.85">
                {/* 25% Tick */}
                <line x1="126" y1="91" x2="132" y2="91" stroke="var(--accent-brass)" strokeWidth="1" />
                <text x="135" y="93">25%</text>

                {/* 50% Tick */}
                <line x1="129" y1="73" x2="136" y2="73" stroke="var(--accent-brass)" strokeWidth="1" />
                <text x="139" y="75">50%</text>

                {/* 75% Tick */}
                <line x1="126" y1="54" x2="133" y2="54" stroke="var(--accent-brass)" strokeWidth="1" />
                <text x="136" y="56">75%</text>

                {/* 100% Goal */}
                <line x1="124" y1="36" x2="132" y2="36" stroke="var(--accent-primary)" strokeWidth="1.2" />
                <text x="135" y="38" fill="var(--accent-primary)" fontWeight="bold">GOAL</text>
              </g>

              {/* Glass Specular Reflection Overlay */}
              <polygon
                points="34,42 126,42 136,78 126,110 34,110 24,78"
                fill="url(#glass-specular)"
                className="pointer-events-none"
              />

              {/* Antique Threaded Brass Collar */}
              <rect
                x="60"
                y="31"
                width="40"
                height="12"
                rx="1.5"
                fill="#B18A5A"
                fillOpacity="0.35"
                stroke="#8C683C"
                strokeWidth="1.2"
              />
              <line x1="62" y1="35" x2="98" y2="35" stroke="#FAF6ED" strokeWidth="0.8" strokeOpacity="0.6" />
              <line x1="62" y1="39" x2="98" y2="39" stroke="#8C683C" strokeWidth="0.8" />

              {/* Bottle Neck Opening Rim */}
              <ellipse cx="80" cy="31" rx="20" ry="4" fill="var(--bg-canvas)" stroke="#8C683C" strokeWidth="1.2" />
              <ellipse cx="80" cy="31" rx="14" ry="2.6" fill="#24231F" />

              {/* Dipped Quill Angled into Inkwell */}
              <g className="dipped-quill pointer-events-none">
                {/* Quill Shaft entering bottle */}
                <line x1="80" y1="35" x2="108" y2="92" stroke="#FAF6ED" strokeWidth="1.2" opacity="0.3" />
                {/* Feathery vane extending out */}
                <path
                  d="M78 30 C74 18 64 6 42 2 C38 4 39 8 44 14 C52 24 65 32 76 34 Z"
                  fill="var(--bg-surface)"
                  stroke="var(--text-primary)"
                  strokeWidth="1"
                  strokeOpacity="0.75"
                />
                {/* Central rachis of feather */}
                <path d="M78 31 C68 22 55 12 40 2" stroke="var(--accent-brass)" strokeWidth="1.2" />
              </g>
            </svg>

            {/* Percentage Badge */}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-xs border text-xs font-mono-tabular font-medium shadow-sm"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--accent-brass)',
                color: 'var(--accent-primary)',
              }}
            >
              {progressPercent}% Full
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Numerical Breakdown & Projection Ledger */}
        <div className="md:col-span-7 space-y-5">
          <div>
            <span className="small-caps-meta text-xs" style={{ color: 'var(--text-muted)' }}>
              Current Manuscript Volume
            </span>
            <h4 className="font-display text-2xl sm:text-3xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {totalWords.toLocaleString()} <span className="text-base sm:text-lg font-normal text-[var(--text-muted)]">/ {goalWords.toLocaleString()} words</span>
            </h4>
          </div>

          {/* Engraved Progress Bar */}
          <div className="space-y-1.5">
            <div
              className="w-full h-3 rounded-xs border overflow-hidden p-0.5"
              style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-hairline)' }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-xs"
                style={{
                  background: 'linear-gradient(90deg, var(--accent-brass), var(--accent-primary))',
                }}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-manuscript" style={{ color: 'var(--text-muted)' }}>
              <span>Opening Inscription (0 w)</span>
              <span className="font-mono-tabular font-medium" style={{ color: 'var(--accent-primary)' }}>
                {wordsRemaining.toLocaleString()} words remaining
              </span>
              <span>Binding Goal ({goalWords.toLocaleString()} w)</span>
            </div>
          </div>

          <FleuronDivider symbol="✦" />

          {/* Projection Cards */}
          <div className="grid grid-cols-2 gap-3 text-xs font-manuscript">
            <div className="p-3 border rounded-xs bg-[var(--bg-canvas)]" style={{ borderColor: 'var(--border-hairline)' }}>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--accent-brass)' }}>
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="small-caps-meta text-[10px]">Estimated Finish</span>
              </div>
              <p className="font-display text-base font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
                {projectedDate}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                ~{projectedDays} writing days at current pace
              </p>
            </div>

            <div className="p-3 border rounded-xs bg-[var(--bg-canvas)]" style={{ borderColor: 'var(--border-hairline)' }}>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
                <Flag className="w-3.5 h-3.5" />
                <span className="small-caps-meta text-[10px]">Manuscript Pace</span>
              </div>
              <p className="font-display text-base font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
                {recentDailyVelocity.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">words/day</span>
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Based on 7-day atelier ledger
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
