import React from 'react';

/**
 * Empty Shelf Illustration — Wooden library bookcase with open space and resting ribbon
 */
export const EmptyShelfIllustration: React.FC<{ className?: string }> = ({
  className = 'w-40 h-28',
}) => {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 120"
      fill="none"
      className={className}
      style={{ color: 'var(--text-primary)' }}
    >
      {/* Heavy timber shelf planks */}
      <rect x="16" y="94" width="168" height="12" fill="var(--bg-recessed)" stroke="var(--border-brass)" strokeWidth="1.2" />
      <line x1="16" y1="98" x2="184" y2="98" stroke="var(--border-hairline)" strokeWidth="0.8" />

      {/* Book on left leaning slightly */}
      <rect x="36" y="38" width="16" height="56" rx="1.5" fill="#713D43" stroke="#582D32" strokeWidth="1" />
      <line x1="39" y1="44" x2="39" y2="88" stroke="#B18A5A" strokeWidth="0.8" />
      <rect x="54" y="32" width="18" height="62" rx="1.5" fill="#582D32" stroke="#462025" strokeWidth="1" />

      {/* Ribbon bookmark hanging down */}
      <path d="M63 94 C63 98 60 106 64 112 L67 108 L70 112 C69 105 67 98 67 94" fill="#B18A5A" />

      {/* Empty space in center with subtle dust motes */}
      <circle cx="100" cy="60" r="1.5" fill="var(--accent-brass)" opacity="0.6" />
      <circle cx="118" cy="52" r="1" fill="var(--accent-brass)" opacity="0.4" />
      <circle cx="132" cy="68" r="1.2" fill="var(--accent-brass)" opacity="0.5" />

      {/* Leaning book on right */}
      <g transform="rotate(12 148 94)">
        <rect x="144" y="40" width="15" height="54" rx="1.5" fill="#8C683C" stroke="#5B3E2B" strokeWidth="1" />
      </g>
    </svg>
  );
};

/**
 * Empty Cast Illustration — Monogrammed wax medallion with crossed dip quills
 */
export const EmptyCastIllustration: React.FC<{ className?: string }> = ({
  className = 'w-36 h-28',
}) => {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 120"
      fill="none"
      className={className}
      style={{ color: 'var(--text-primary)' }}
    >
      {/* Crossed Quill Feathers behind seal */}
      <path
        d="M32 96 C50 72 74 44 118 20 C116 26 104 42 78 64 C62 78 48 88 32 96 Z"
        fill="var(--bg-surface)"
        stroke="var(--border-brass)"
        strokeWidth="1.1"
      />
      <line x1="32" y1="96" x2="114" y2="24" stroke="var(--accent-brass)" strokeWidth="1" />

      <path
        d="M128 96 C110 72 86 44 42 20 C44 26 56 42 82 64 C98 78 112 88 128 96 Z"
        fill="var(--bg-surface)"
        stroke="var(--border-brass)"
        strokeWidth="1.1"
      />
      <line x1="128" y1="96" x2="46" y2="24" stroke="var(--accent-brass)" strokeWidth="1" />

      {/* Central Wax Seal */}
      <circle cx="80" cy="60" r="28" fill="#713D43" stroke="#582D32" strokeWidth="1.2" />
      <circle cx="80" cy="60" r="24" stroke="#FAF6ED" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.6" />
      <circle cx="80" cy="60" r="20" stroke="#8E4E56" strokeWidth="0.9" />

      {/* Intaglio Profile / Mask silhouette */}
      <path
        d="M74 52 C78 50 84 50 86 54 C88 58 84 62 82 64 C86 64 88 67 87 70 C85 73 78 74 74 74"
        stroke="#FAF6ED"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * Empty Atlas Illustration — Unrolled nautical chart with compass rose and drafting divider
 */
export const EmptyAtlasIllustration: React.FC<{ className?: string }> = ({
  className = 'w-40 h-28',
}) => {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 120"
      fill="none"
      className={className}
      style={{ color: 'var(--text-primary)' }}
    >
      {/* Unfurling parchment chart */}
      <path
        d="M24 24 C44 28 64 22 90 26 C116 30 136 24 156 28 L150 98 C130 94 110 100 84 96 C58 92 38 98 18 94 Z"
        fill="var(--bg-surface)"
        stroke="var(--border-brass)"
        strokeWidth="1.2"
      />

      {/* Faint cartographic grid lines */}
      <line x1="32" y1="42" x2="144" y2="46" stroke="var(--border-hairline)" strokeWidth="0.8" strokeDasharray="2 3" />
      <line x1="28" y1="62" x2="142" y2="66" stroke="var(--border-hairline)" strokeWidth="0.8" strokeDasharray="2 3" />
      <line x1="24" y1="82" x2="140" y2="84" stroke="var(--border-hairline)" strokeWidth="0.8" strokeDasharray="2 3" />

      <line x1="60" y1="26" x2="56" y2="94" stroke="var(--border-hairline)" strokeWidth="0.8" strokeDasharray="2 3" />
      <line x1="90" y1="26" x2="86" y2="96" stroke="var(--border-hairline)" strokeWidth="0.8" strokeDasharray="2 3" />
      <line x1="120" y1="28" x2="116" y2="96" stroke="var(--border-hairline)" strokeWidth="0.8" strokeDasharray="2 3" />

      {/* Compass Rose icon */}
      <g transform="translate(68, 50)">
        <circle cx="20" cy="20" r="16" stroke="var(--accent-brass)" strokeWidth="0.8" />
        <polygon points="20,8 23,18 20,16 17,18" fill="var(--accent-primary)" />
        <polygon points="20,32 23,22 20,24 17,22" fill="var(--accent-brass)" />
        <polygon points="32,20 22,23 24,20 22,17" fill="var(--accent-brass)" />
        <polygon points="8,20 18,23 16,20 18,17" fill="var(--accent-brass)" />
      </g>

      {/* Brass Drafting Calipers resting over chart */}
      <g stroke="var(--accent-brass)" strokeWidth="1.3" strokeLinecap="round">
        <line x1="134" y1="34" x2="116" y2="76" />
        <line x1="134" y1="34" x2="138" y2="78" />
        <circle cx="134" cy="34" r="2.5" fill="var(--accent-brass)" />
      </g>
    </svg>
  );
};

/**
 * Empty Chronicle Illustration — Open illuminated scroll with antique ribbon seal
 */
export const EmptyChronicleIllustration: React.FC<{ className?: string }> = ({
  className = 'w-36 h-28',
}) => {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 120"
      fill="none"
      className={className}
      style={{ color: 'var(--text-primary)' }}
    >
      {/* Rolled parchment cylinder top */}
      <ellipse cx="80" cy="24" rx="48" ry="8" fill="var(--bg-recessed)" stroke="var(--border-brass)" strokeWidth="1.2" />

      {/* Scroll leaf body */}
      <path
        d="M32 24 V90 C32 94 40 98 80 98 C120 98 128 94 128 90 V24"
        fill="var(--bg-surface)"
        stroke="var(--border-brass)"
        strokeWidth="1.2"
      />

      {/* Latin Drop-Cap Inscription Box */}
      <rect x="42" y="38" width="16" height="18" fill="var(--bg-canvas)" stroke="var(--border-hairline)" strokeWidth="0.9" />
      <text x="50" y="52" textAnchor="middle" fill="var(--accent-primary)" fontFamily="'Fraunces', serif" fontSize="13" fontWeight="bold">
        L
      </text>

      {/* Ruled Manuscript Lines */}
      <line x1="64" y1="42" x2="116" y2="42" stroke="var(--border-hairline)" strokeWidth="0.9" />
      <line x1="64" y1="52" x2="116" y2="52" stroke="var(--border-hairline)" strokeWidth="0.9" />
      <line x1="42" y1="64" x2="116" y2="64" stroke="var(--border-hairline)" strokeWidth="0.9" />
      <line x1="42" y1="74" x2="100" y2="74" stroke="var(--border-hairline)" strokeWidth="0.9" />

      {/* Wax Seal at bottom */}
      <circle cx="80" cy="98" r="9" fill="#713D43" stroke="#582D32" strokeWidth="1" />
      <path d="M77 106 L74 116 L80 113 L86 116 L83 106" fill="#B18A5A" />
    </svg>
  );
};
