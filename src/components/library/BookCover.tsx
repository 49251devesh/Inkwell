import React from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import { Project } from '../../types/inkwell';
import { COVER_PALETTES, formatWordCount, toRoman } from '../../lib/formatters';

interface BookCoverProps {
  project: Project;
  volumeIndex: number;
  wordCount: number;
  chapterCount: number;
  isSelected?: boolean;
  onSelect: (project: Project) => void;
  onOpenDesk: (project: Project) => void;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  canDelete?: boolean;
}

export const BookCover: React.FC<BookCoverProps> = ({
  project,
  volumeIndex,
  wordCount,
  chapterCount,
  isSelected = false,
  onSelect,
  onOpenDesk,
  onEdit,
  onDelete,
  canDelete = false,
}) => {
  const palette =
    COVER_PALETTES[project.coverPalette] ?? COVER_PALETTES['burgundy-morocco'];
  const progressPct = Math.min(
    100,
    Math.round((wordCount / Math.max(1, project.wordGoal)) * 100)
  );

  // Organic slight variance so books on a shelf never look machine-cloned
  const subtleTilt = volumeIndex % 2 === 0 ? -0.7 : 0.6;

  return (
    <motion.article
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.55,
        delay: 0.08 * volumeIndex,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group relative flex flex-col items-center shrink-0"
      style={{ perspective: '950px' }}
    >
      {/* Interactive Hardcover Volume */}
      <button
        type="button"
        onClick={() => onSelect(project)}
        onDoubleClick={() => onOpenDesk(project)}
        aria-pressed={isSelected}
        aria-label={`Select volume ${project.title}, ${formatWordCount(wordCount)} words`}
        className="relative w-[176px] sm:w-[190px] h-[264px] sm:h-[282px] text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotate(${subtleTilt}deg)`,
        }}
      >
        {/* Sliding Brass/Silk Ribbon Bookmark tucked beneath bottom edge */}
        <span
          aria-hidden="true"
          className="absolute left-7 bottom-0 w-4 h-12 z-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] translate-y-1 group-hover:translate-y-7"
          style={{
            backgroundColor: palette.ribbonHex,
            clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          }}
        />

        {/* Cream / Gilt Page Edges (right side of closed book) */}
        <span
          aria-hidden="true"
          className="absolute top-[5px] bottom-[5px] right-[-7px] w-[9px] rounded-r-[2px] z-0 transition-transform duration-300 group-hover:translate-x-[2px]"
          style={{
            background:
              'repeating-linear-gradient(to right, #EFE6D5 0px, #EFE6D5 1.5px, #D9CCB4 1.5px, #D9CCB4 3px)',
            boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.2)',
          }}
        />

        {/* Book Board Cover */}
        <div
          className="relative z-10 w-full h-full rounded-r-[4px] rounded-l-[2px] overflow-hidden flex flex-col justify-between p-4 pl-6 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:[transform:rotateY(-11deg)_rotateX(2deg)]"
          style={{
            backgroundColor: palette.clothHex,
            boxShadow: isSelected
              ? `${'var(--shadow-book)'}, 0 0 0 1.5px var(--accent-brass)`
              : 'var(--shadow-book)',
            transformOrigin: 'left center',
          }}
        >
          {/* Left Ribbed Spine with Crease Groove */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-4"
            style={{
              background: `linear-gradient(90deg, ${palette.spineHex} 0%, ${palette.clothHex} 78%, rgba(0,0,0,0.28) 92%, rgba(255,255,255,0.08) 100%)`,
            }}
          >
            {/* Raised Spine Bands */}
            <span
              className="absolute top-6 inset-x-0 h-[2px] opacity-35"
              style={{ backgroundColor: palette.foilHex }}
            />
            <span
              className="absolute top-1/2 inset-x-0 h-[1px] opacity-25"
              style={{ backgroundColor: palette.foilHex }}
            />
            <span
              className="absolute bottom-6 inset-x-0 h-[2px] opacity-35"
              style={{ backgroundColor: palette.foilHex }}
            />
          </div>

          {/* Subtle Linen / Morocco Leather Weave Overlay */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay"
            style={{
              backgroundImage:
                'radial-gradient(rgba(255,255,255,0.2) 0.5px, transparent 0.5px)',
              backgroundSize: '4px 4px',
            }}
          />

          {/* Foil-Stamped Double Rule Border */}
          <div
            aria-hidden="true"
            className="absolute inset-2.5 left-5 pointer-events-none"
            style={{
              border: `1px solid ${palette.foilHex}55`,
              outline: `1px solid ${palette.foilHex}28`,
              outlineOffset: '-3px',
            }}
          />

          {/* Top Cover Foil Stamp: Volume Numeral & Genre */}
          <div className="relative z-10 flex items-center justify-between pt-1.5 px-1">
            <span
              className="font-mono-tabular text-[10px] tracking-[0.2em] uppercase"
              style={{ color: `${palette.foilHex}CC` }}
            >
              Vol. {toRoman(volumeIndex + 1)}
            </span>
            <span
              className="text-xs select-none"
              style={{ color: `${palette.foilHex}B3` }}
              aria-hidden="true"
            >
              ✦
            </span>
          </div>

          {/* Center Foil-Stamped Title Block */}
          <div className="relative z-10 px-1 my-auto">
            <h3
              className="font-display text-lg sm:text-[1.22rem] leading-[1.18] font-medium tracking-tight"
              style={{
                color: palette.foilHex,
                textShadow: '0 1px 1px rgba(0,0,0,0.45)',
              }}
            >
              {project.title}
            </h3>
            <div
              aria-hidden="true"
              className="w-8 h-px my-2.5"
              style={{ backgroundColor: `${palette.foilHex}66` }}
            />
            <p
              className="small-caps-meta text-[11px] leading-tight truncate"
              style={{ color: `${palette.foilHex}BF` }}
            >
              {project.genre}
            </p>
          </div>

          {/* Bottom Foil Colophon */}
          <div className="relative z-10 px-1 pb-1 flex items-center justify-between">
            <span
              className="text-[11px] font-manuscript italic truncate max-w-[100px]"
              style={{ color: `${palette.foilHex}B8` }}
            >
              {project.author}
            </span>
            <span
              className="font-mono-tabular text-[10px]"
              style={{ color: `${palette.foilHex}A6` }}
            >
              {progressPct}%
            </span>
          </div>
        </div>
      </button>

      {/* Quiet Bookplate Metadata Underneath on Shelf */}
      <div className="mt-4 w-[180px] text-center">
        <div
          className="flex items-center justify-center gap-1.5 text-xs font-mono-tabular"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>{formatWordCount(wordCount)} w</span>
          <span aria-hidden="true">·</span>
          <span>
            {chapterCount} {chapterCount === 1 ? 'ch' : 'chs'}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onOpenDesk(project)}
            className="text-xs font-manuscript italic underline underline-offset-4 transition-colors hover:opacity-80 whitespace-nowrap cursor-pointer"
            style={{
              color: isSelected ? 'var(--accent-primary)' : 'var(--accent-brass)',
            }}
          >
            {isSelected ? 'Open on Desk →' : 'Read Folio'}
          </button>

          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(project);
              }}
              title={`Revise ${project.title}`}
              aria-label={`Revise ${project.title}`}
              className="p-1 rounded transition-colors hover:bg-[var(--burgundy-wash)] opacity-60 hover:opacity-100 cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Pencil className="w-3 h-3" strokeWidth={1.4} />
            </button>
          )}

          {onDelete && canDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project);
              }}
              title={`Strike ${project.title} from shelf`}
              aria-label={`Strike ${project.title}`}
              className="p-1 rounded transition-colors hover:bg-rose-950/20 hover:text-rose-600 opacity-60 hover:opacity-100 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <Trash2 className="w-3 h-3" strokeWidth={1.4} />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
};
