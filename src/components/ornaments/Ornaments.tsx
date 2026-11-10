import React from 'react';

export const CornerOrnament: React.FC<{
  position: 'tl' | 'tr' | 'bl' | 'br';
  className?: string;
}> = ({ position, className = '' }) => {
  const rotation =
    position === 'tl'
      ? 'rotate(0deg)'
      : position === 'tr'
      ? 'rotate(90deg)'
      : position === 'br'
      ? 'rotate(180deg)'
      : 'rotate(270deg)';

  const posClasses =
    position === 'tl'
      ? 'top-2 left-2'
      : position === 'tr'
      ? 'top-2 right-2'
      : position === 'br'
      ? 'bottom-2 right-2'
      : 'bottom-2 left-2';

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      fill="none"
      className={`pointer-events-none absolute w-6 h-6 ${posClasses} ${className}`}
      style={{ transform: rotation, color: 'var(--accent-brass)' }}
    >
      <path
        d="M2 22V4C2 2.89543 2.89543 2 4 2H22"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeOpacity="0.7"
      />
      <path
        d="M6 15V6H15"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeOpacity="0.45"
      />
      <circle cx="6" cy="6" r="1.4" fill="currentColor" fillOpacity="0.65" />
    </svg>
  );
};

export const WaxSeal: React.FC<{
  monogram?: string;
  size?: number;
  className?: string;
}> = ({ monogram = 'I', size = 54, className = '' }) => {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={`select-none ${className}`}
    >
      {/* Organic melted wax edge */}
      <path
        d="M32 4C37.5 3.6 42.2 6.5 46.8 8.4C51.4 10.3 56.6 13.5 58.2 18.4C59.8 23.3 58.3 28.1 59.1 33C59.9 37.9 58.1 44.3 54.4 48.6C50.7 52.9 45.9 55.6 40.7 57.6C35.5 59.6 29.3 60.4 24.1 58.4C18.9 56.4 13.8 53.8 10.3 49.4C6.8 45 4.8 39.2 5.3 33.6C5.8 28 4.4 21.8 7.1 16.9C9.8 12 15.1 9.1 20.1 6.7C25.1 4.3 26.5 4.4 32 4Z"
        fill="#713D43"
      />
      {/* Highlight rim */}
      <path
        d="M32 7C36.8 6.7 41 9.2 44.8 10.9C48.7 12.6 53 15.2 54.3 19.3C55.6 23.4 54.4 27.6 55.1 31.8C55.8 36 54.2 41.4 51.1 45C48 48.6 43.9 51 39.5 52.7C35.1 54.4 29.8 55 25.4 53.3C21 51.6 16.7 49.4 13.7 45.7C10.7 42 9.1 37.1 9.5 32.3C9.9 27.5 8.8 22.2 11.1 18.1C13.4 14 17.8 11.5 22 9.4C26.2 7.3 27.2 7.3 32 7Z"
        fill="#623238"
        stroke="#8E4E56"
        strokeWidth="0.9"
      />
      {/* Inner stamped ring */}
      <circle
        cx="32"
        cy="31.5"
        r="16.5"
        stroke="#462025"
        strokeWidth="1.2"
        fill="#713D43"
      />
      <circle
        cx="32"
        cy="31.5"
        r="14.2"
        stroke="#9D6068"
        strokeOpacity="0.45"
        strokeWidth="0.7"
      />
      <text
        x="32"
        y="37"
        textAnchor="middle"
        fill="#E9D6B6"
        fontFamily="Fraunces, Georgia, serif"
        fontSize="18"
        fontStyle="italic"
        fontWeight="500"
      >
        {monogram}
      </text>
    </svg>
  );
};

export const FleuronDivider: React.FC<{
  symbol?: '❦' | '✦';
  className?: string;
}> = ({ symbol = '❦', className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center gap-4 select-none ${className}`}
    >
      <div
        className="h-px flex-1"
        style={{ backgroundColor: 'var(--border-hairline)' }}
      />
      <span
        className="text-sm leading-none"
        style={{ color: 'var(--accent-brass)' }}
      >
        {symbol}
      </span>
      <div
        className="h-px flex-1"
        style={{ backgroundColor: 'var(--border-hairline)' }}
      />
    </div>
  );
};

export const QuillIllustration: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 120"
      fill="none"
      className={className}
      style={{ color: 'var(--text-primary)' }}
    >
      {/* Resting brass blotter line */}
      <line
        x1="18"
        y1="104"
        x2="162"
        y2="104"
        stroke="var(--border-brass)"
        strokeWidth="1"
      />
      {/* Faceted glass inkwell */}
      <path
        d="M44 74H78L84 86V104H38V86L44 74Z"
        fill="var(--bg-recessed)"
        stroke="currentColor"
        strokeOpacity="0.65"
        strokeWidth="1.2"
      />
      {/* Ink level inside bottle */}
      <path
        d="M40 91H82V103H40V91Z"
        fill="var(--accent-primary)"
        fillOpacity="0.28"
      />
      {/* Brass collar & neck */}
      <rect
        x="51"
        y="65"
        width="20"
        height="9"
        rx="1"
        fill="var(--accent-brass)"
        fillOpacity="0.3"
        stroke="var(--accent-brass)"
        strokeWidth="1.1"
      />
      <path
        d="M54 65L55 59H67L68 65"
        stroke="currentColor"
        strokeOpacity="0.65"
        strokeWidth="1.1"
      />
      {/* Hand-drawn dip quill angled into inkwell */}
      <path
        d="M61 63C68 48 86 24 128 11C133 9.5 138 11 136 15C130 28 111 49 81 58C72 60.5 65 62 61 63Z"
        fill="var(--bg-surface)"
        stroke="currentColor"
        strokeOpacity="0.78"
        strokeWidth="1.15"
      />
      {/* Central feather rachis */}
      <path
        d="M58 68C74 52 103 27 134 12"
        stroke="var(--accent-brass)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Subtle feather barbs */}
      <path
        d="M92 38L84 29M102 31L95 22M112 24L107 17M84 46L95 49M96 39L107 41M108 31L118 32"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      {/* Small ink drop & nib detail */}
      <circle
        cx="108"
        cy="96"
        r="2"
        fill="var(--accent-primary)"
        fillOpacity="0.6"
      />
      <circle
        cx="116"
        cy="98"
        r="1.1"
        fill="var(--accent-primary)"
        fillOpacity="0.45"
      />
    </svg>
  );
};
