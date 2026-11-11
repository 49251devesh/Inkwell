import React, { useState } from 'react';

import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart2,
  BookOpen,
  Compass,
  Feather,
  FolderKanban,
  Moon,
  Sun,
  Users,
  Database,
  BookMarked,
} from 'lucide-react';
import { useThemeTransition } from '../../hooks/useThemeTransition';
import { DataArchiveDialog } from '../library/DataArchiveDialog';

const NAV_ITEMS = [
  { to: '/', label: 'Library', icon: BookOpen, end: true },
  { to: '/desk', label: 'The Desk', icon: Feather, end: false },
  { to: '/projects', label: 'Manuscripts', icon: FolderKanban, end: false },
  { to: '/characters', label: 'Characters', icon: Users, end: false },
  { to: '/world', label: 'World', icon: Compass, end: false },
  { to: '/analytics', label: 'Ledger', icon: BarChart2, end: false },
  { to: '/reading-room', label: 'Reading Room', icon: BookMarked, end: false },
];

export const StudioShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isMidnight, switchThemeWithInkSpread } = useThemeTransition();
  const location = useLocation();
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Keyboard Accessibility Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--accent-primary)] focus:text-[#F4EFE5] font-manuscript text-xs shadow-md border border-[var(--border-brass)]"
      >
        Skip to manuscript workspace
      </a>

      {/* Atmospheric Paper, Lamplight & Vignette Layers */}
      <div aria-hidden="true" className="atelier-lamplight" />
      <div aria-hidden="true" className="atelier-grain" />
      <div aria-hidden="true" className="atelier-vignette" />

      {/* Subtle Marginal Ink-Wash Blotches */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-24 -right-24 w-[420px] h-[420px] rounded-full blur-3xl z-0"
        style={{ background: 'var(--ink-blotch-b)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-12 -left-28 w-[360px] h-[360px] rounded-full blur-3xl z-0"
        style={{ background: 'var(--ink-blotch-a)' }}
      />

      {/* Top Navigation Bar — 3-Zone Contract */}
      <header
        className="relative z-20 border-b backdrop-blur-[2px]"
        style={{
          borderColor: 'var(--border-hairline)',
          backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 88%, transparent)',
        }}
      >
        <div className="max-w-[1260px] mx-auto px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <NavLink
            to="/"
            className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ color: 'var(--text-primary)' }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="w-5 h-5"
              style={{ color: 'var(--accent-primary)' }}
            >
              <path
                d="M12 2L17.5 11.5L14.5 19H9.5L6.5 11.5L12 2Z"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinejoin="round"
              />
              <path
                d="M12 2V11"
                stroke="var(--accent-brass)"
                strokeWidth="1.2"
              />
              <circle cx="12" cy="12.2" r="1.3" fill="var(--accent-brass)" />
              <path
                d="M8.5 21.5H15.5"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-display text-xl tracking-[0.14em] font-medium">
              INKWELL
            </span>
          </NavLink>

          {/* Zone 2: Clean Single-Line Typographic Navigation */}
          <nav
            aria-label="Primary studio navigation"
            className="hidden md:flex items-center gap-6 lg:gap-7"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className="relative py-1.5 text-[15px] font-manuscript tracking-wide whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
                  style={{
                    color: isActive
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                  }}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="atelier-nav-underline"
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute left-0 right-0 -bottom-[1px] h-[1.5px]"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Zone 3: Primary Actions — Archive Vault & Lamplight Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Global Archive Vault (Export & Import JSON) */}
            <button
              type="button"
              onClick={() => setIsArchiveOpen(true)}
              title="Archive Vault: Export or Import Library JSON"
              aria-label="Open library archive vault"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-manuscript border cursor-pointer whitespace-nowrap shrink-0 transition-colors hover:bg-[var(--burgundy-wash)] focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-secondary)',
              }}
            >
              <Database className="w-3.5 h-3.5 text-[var(--accent-brass)]" strokeWidth={1.4} />
              <span className="hidden sm:inline">Archive</span>
            </button>

            {/* Lamplight Theme Toggle with Ink-Spread */}
            <button
              type="button"
              onClick={switchThemeWithInkSpread}
              aria-label={
                isMidnight
                  ? 'Switch to Daylight Study theme'
                  : 'Switch to Midnight Library theme'
              }
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-manuscript border cursor-pointer whitespace-nowrap shrink-0 transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-brass)',
                color: 'var(--text-primary)',
              }}
            >
              {isMidnight ? (
                <Sun
                  className="w-3.5 h-3.5"
                  strokeWidth={1.5}
                  style={{ color: 'var(--accent-brass)' }}
                />
              ) : (
                <Moon
                  className="w-3.5 h-3.5"
                  strokeWidth={1.5}
                  style={{ color: 'var(--accent-primary)' }}
                />
              )}
              <span>{isMidnight ? 'Daylight Study' : 'Midnight Library'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`relative flex-1 focus:outline-none ${location.pathname.startsWith('/desk') ? 'pb-0' : 'pb-20 md:pb-16'}`}
      >
        {children}
      </main>

      {/* Quiet Editorial Colophon Footer (hidden on desk to yield to manuscript footer) */}
      {!location.pathname.startsWith('/desk') && (
        <footer
          className="relative z-10 hidden md:block border-t py-6"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <div
            className="max-w-[1260px] mx-auto px-8 lg:px-12 flex items-center justify-between text-xs font-manuscript italic"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>Inkwell Atelier · Stored locally in your browser’s study ledger</span>
            <span aria-hidden="true" style={{ color: 'var(--accent-brass)' }}>
              ❦
            </span>
            <span>Daylight Study &amp; Midnight Library Editions</span>
          </div>
        </footer>
      )}

      {/* Mobile Bottom Navigation Bar (<= 15% viewport height, >= 44px touch targets) */}
      {!location.pathname.startsWith('/desk') && (
        <nav
          aria-label="Mobile studio navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-md"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 94%, transparent)',
            borderColor: 'var(--border-brass)',
          }}
        >
          <div className="grid grid-cols-7 h-14">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className="flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-1 text-[11px] font-manuscript transition-colors"
                  style={{
                    color: isActive
                      ? 'var(--accent-primary)'
                      : 'var(--text-muted)',
                  }}
                >
                  <Icon className="w-4 h-4" strokeWidth={isActive ? 1.8 : 1.3} />
                  <span className="truncate max-w-full">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}

      {/* Global Archive Vault Dialog */}
      <DataArchiveDialog
        open={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
      />
    </div>
  );
};
