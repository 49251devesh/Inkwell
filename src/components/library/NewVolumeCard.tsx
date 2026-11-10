import React from 'react';
import { motion } from 'framer-motion';
import { Feather } from 'lucide-react';

interface NewVolumeCardProps {
  onClick: () => void;
  delayIndex: number;
}

export const NewVolumeCard: React.FC<NewVolumeCardProps> = ({
  onClick,
  delayIndex,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.55,
        delay: 0.08 * delayIndex,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group flex flex-col items-center shrink-0"
    >
      <button
        type="button"
        onClick={onClick}
        className="relative w-[176px] sm:w-[190px] h-[264px] sm:h-[282px] text-left cursor-pointer rounded-r-[4px] rounded-l-[2px] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2 focus-visible:outline-2 focus-visible:outline-offset-4"
        style={{
          backgroundColor: 'var(--bg-recessed)',
          border: '1px dashed var(--border-brass)',
          boxShadow: 'var(--shadow-paper)',
          transform: 'rotate(0.8deg)',
        }}
      >
        {/* Stitched Leather Spine */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-3.5 rounded-l-[2px]"
          style={{
            backgroundColor: 'var(--border-hairline)',
            borderRight: '1px solid var(--border-brass)',
          }}
        />

        {/* Brass Fore-edge Clasp */}
        <span
          aria-hidden="true"
          className="absolute right-[-3px] top-1/2 -translate-y-1/2 w-2.5 h-8 rounded-r-sm transition-transform duration-300 group-hover:translate-x-0.5"
          style={{
            backgroundColor: 'var(--accent-brass)',
            opacity: 0.72,
          }}
        />

        {/* Blind-debossed inner frame */}
        <div
          aria-hidden="true"
          className="absolute inset-3 left-5 pointer-events-none"
          style={{
            border: '1px solid var(--border-hairline)',
          }}
        />

        <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 pl-8 text-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-105"
            style={{
              border: '1px solid var(--border-brass)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--accent-brass)',
            }}
          >
            <Feather className="w-4 h-4" strokeWidth={1.4} />
          </div>

          <span
            className="font-display text-base font-medium leading-snug"
            style={{ color: 'var(--text-primary)' }}
          >
            Bind a New Volume
          </span>

          <span
            className="text-xs font-manuscript italic mt-2 leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            Uncut leaves waiting for an opening chapter
          </span>
        </div>
      </button>

      <div className="mt-4 w-[180px] text-center">
        <span
          className="text-xs font-manuscript italic"
          style={{ color: 'var(--text-muted)' }}
        >
          Blank Ledger
        </span>
      </div>
    </motion.div>
  );
};
