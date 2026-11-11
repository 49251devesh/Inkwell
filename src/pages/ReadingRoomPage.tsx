/**
 * ReadingRoomPage.tsx
 * Phase A — The Reading Room folio for Inkwell Atelier.
 *
 * Provides:
 *  • Search bar → Gutendex / Project Gutenberg proxy (/api/library/search)
 *  • Book shelf (spine + cover cards)
 *  • Favorites shelf (IndexedDB via Dexie)
 *  • Book detail dialog
 *  • Inline reader view (chapter nav, font size, line width, scroll position memory)
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  BookMarked,
  BookOpen,
  Heart,
  HeartOff,
  X,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Loader2,
  AlertCircle,
  BookText,
  Library,
} from 'lucide-react';
import { readingRoomDb, type FavoriteBook, type ReaderSettings } from '../lib/readingRoomDb';
import { useLiveQuery } from 'dexie-react-hooks';

// ---------------------------------------------------------------------------
// Types for Gutendex API (as returned by /api/library/*)
// ---------------------------------------------------------------------------

export interface LibraryBook {
  id: number;
  title: string;
  authors: string[];
  subjects: string[];
  coverUrl: string;
  language: string[];
  textUrl: string;
}

export interface BookChapter {
  title: string;
  content: string;
}

export interface BookText {
  title: string;
  chapters: BookChapter[];
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Deterministic pastel colour from a book id — for spine fallback
function spineColor(id: number): string {
  const palette = [
    '#5C3D2E', // dark mahogany
    '#3D3523', // aged leather
    '#2C3E50', // navy binding
    '#4A3728', // walnut
    '#3B2F2F', // dark sienna
    '#2E4057', // slate blue
    '#4A3933', // terracotta umber
    '#2D4739', // bottle green
    '#5B3A5A', // port wine
    '#3D2B1F', // espresso
  ];
  return palette[id % palette.length];
}

// ---------------------------------------------------------------------------
// Spine Card (compact, rotated title for shelf view)
// ---------------------------------------------------------------------------

const SpineCard: React.FC<{
  book: LibraryBook;
  isFavorite: boolean;
  onClick: () => void;
}> = ({ book, isFavorite, onClick }) => {
  const bg = spineColor(book.id);
  const shortTitle = book.title.length > 32 ? book.title.slice(0, 32) + '…' : book.title;
  const shortAuthor = book.authors[0] ?? '';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -6, boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}
      whileTap={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      aria-label={`Open ${book.title}`}
      className="relative flex-shrink-0 w-14 sm:w-16 rounded-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 group"
      style={{
        height: '180px',
        background: `linear-gradient(160deg, ${bg}ee, ${bg}99)`,
        boxShadow: '2px 4px 12px rgba(0,0,0,0.28)',
      }}
    >
      {/* Spine ridge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-sm"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      />
      {/* Rotated title */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden px-2"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        <span
          className="font-heading text-[11px] leading-tight font-semibold tracking-wide text-center"
          style={{ color: 'rgba(255,255,255,0.90)' }}
        >
          {shortTitle}
        </span>
      </div>
      {/* Author at bottom of spine */}
      <div
        className="absolute bottom-1 left-0 right-0 flex justify-center"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        <span
          className="font-manuscript text-[9px] italic truncate"
          style={{ color: 'rgba(255,255,255,0.55)', maxWidth: '70px' }}
        >
          {shortAuthor}
        </span>
      </div>
      {/* Favourite badge */}
      {isFavorite && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: 'var(--accent-primary)' }}>
          <Heart className="w-2.5 h-2.5 fill-current text-white" />
        </div>
      )}
    </motion.button>
  );
};

// ---------------------------------------------------------------------------
// Cover Card (wider, with image for search results grid)
// ---------------------------------------------------------------------------

const CoverCard: React.FC<{
  book: LibraryBook;
  isFavorite: boolean;
  onClick: () => void;
}> = ({ book, isFavorite, onClick }) => {
  const [imgErr, setImgErr] = useState(false);
  const bg = spineColor(book.id);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4, boxShadow: '0 16px 36px rgba(0,0,0,0.3)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      aria-label={`Open ${book.title}`}
      className="relative flex flex-col cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 text-left group"
      style={{
        width: '120px',
        boxShadow: '2px 4px 14px rgba(0,0,0,0.22)',
      }}
    >
      {/* Cover image or fallback */}
      <div
        className="rounded-t-sm overflow-hidden"
        style={{ height: '160px', background: bg }}
      >
        {book.coverUrl && !imgErr ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            onError={() => setImgErr(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
            <BookText className="w-8 h-8 opacity-50 text-white" />
            <span
              className="font-heading text-[10px] text-center leading-tight font-semibold"
              style={{ color: 'rgba(255,255,255,0.80)' }}
            >
              {book.title.length > 28 ? book.title.slice(0, 28) + '…' : book.title}
            </span>
          </div>
        )}
      </div>
      {/* Metadata strip */}
      <div
        className="rounded-b-sm px-2 py-1.5 border border-t-0"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <p
          className="font-heading text-[11px] font-semibold leading-tight line-clamp-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {book.title}
        </p>
        <p
          className="font-manuscript text-[10px] italic mt-0.5 truncate"
          style={{ color: 'var(--text-muted)' }}
        >
          {book.authors[0] ?? 'Unknown'}
        </p>
      </div>
      {isFavorite && (
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow"
          style={{ background: 'var(--accent-primary)' }}>
          <Heart className="w-3 h-3 fill-current text-white" />
        </div>
      )}
    </motion.button>
  );
};

// ---------------------------------------------------------------------------
// Book Detail Dialog
// ---------------------------------------------------------------------------

const BookDetailDialog: React.FC<{
  book: LibraryBook;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (book: LibraryBook) => void;
  onRead: (book: LibraryBook) => void;
}> = ({ book, isFavorite, onClose, onToggleFavorite, onRead }) => {
  const [imgErr, setImgErr] = useState(false);

  // Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${book.title}`}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 cursor-pointer"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />
      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border shadow-2xl"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-brass)',
        }}
      >
        <div className="flex gap-5 p-5 sm:p-6">
          {/* Cover */}
          <div
            className="flex-shrink-0 rounded-sm overflow-hidden shadow-md"
            style={{ width: '100px', height: '140px', background: spineColor(book.id) }}
          >
            {book.coverUrl && !imgErr ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                onError={() => setImgErr(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookText className="w-8 h-8 opacity-40 text-white" />
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-xl font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {book.title}
            </h2>
            <p className="font-manuscript italic mt-1" style={{ color: 'var(--text-secondary)' }}>
              {book.authors.join(', ')}
            </p>
            {book.language.length > 0 && (
              <p className="font-manuscript text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Language: {book.language.join(', ').toUpperCase()}
              </p>
            )}
            {book.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {book.subjects.slice(0, 5).map((s) => (
                  <span
                    key={s}
                    className="inline-block font-manuscript text-[10px] px-2 py-0.5 rounded-full border"
                    style={{
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-canvas)',
                    }}
                  >
                    {s.length > 30 ? s.slice(0, 30) + '…' : s}
                  </span>
                ))}
              </div>
            )}
            {/* Public domain notice */}
            <p className="font-manuscript text-[11px] italic mt-4" style={{ color: 'var(--accent-brass)' }}>
              ❦ Public-domain text via Project Gutenberg
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div
          className="flex flex-col sm:flex-row gap-2.5 px-5 sm:px-6 pb-5 sm:pb-6 border-t pt-4"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <button
            type="button"
            onClick={() => onRead(book)}
            disabled={!book.textUrl}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-5 font-manuscript text-sm border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{
              background: 'var(--accent-primary)',
              borderColor: 'var(--accent-primary)',
              color: '#F4EFE5',
            }}
          >
            <BookOpen className="w-4 h-4" />
            {book.textUrl ? 'Read this volume' : 'No plain-text available'}
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(book)}
            className="flex items-center justify-center gap-2 py-2.5 px-5 font-manuscript text-sm border cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)]"
            style={{
              background: 'var(--bg-canvas)',
              borderColor: 'var(--border-brass)',
              color: isFavorite ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}
          >
            {isFavorite ? (
              <><HeartOff className="w-4 h-4" /> Unfavorite</>
            ) : (
              <><Heart className="w-4 h-4" /> Add to Favourites</>
            )}
          </button>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close book detail"
          className="absolute top-3 right-3 p-1.5 rounded-full transition-colors hover:bg-[var(--burgundy-wash)] cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Reader View
// ---------------------------------------------------------------------------

const lineWidthClasses: Record<ReaderSettings['lineWidth'], string> = {
  narrow: 'max-w-[52ch]',
  medium: 'max-w-[72ch]',
  wide: 'max-w-[90ch]',
};

const ReaderView: React.FC<{
  book: LibraryBook;
  onClose: () => void;
}> = ({ book, onClose }) => {
  const [bookText, setBookText] = useState<BookText | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [fontSize, setFontSize] = useState(18);
  const [lineWidth, setLineWidth] = useState<ReaderSettings['lineWidth']>('medium');
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load saved settings & progress
  useEffect(() => {
    (async () => {
      const settings = await readingRoomDb.readerSettings.get('default');
      if (settings) {
        setFontSize(settings.fontSize);
        setLineWidth(settings.lineWidth);
      }
      const progress = await readingRoomDb.readingProgress.get(book.id);
      if (progress) {
        setChapterIndex(progress.chapterIndex);
        // scroll restore happens after content loads
      }
    })();
  }, [book.id]);

  // Fetch book text
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/library/text/${book.id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json() as Promise<BookText>;
      })
      .then((data) => {
        setBookText(data);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not load text.');
        setLoading(false);
      });
  }, [book.id]);

  // Restore scroll position when chapter changes (after content renders)
  useEffect(() => {
    if (!scrollRef.current) return;
    readingRoomDb.readingProgress.get(book.id).then((progress) => {
      if (progress && progress.chapterIndex === chapterIndex && scrollRef.current) {
        scrollRef.current.scrollTop = progress.scrollPosition;
      } else if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    });
  }, [book.id, chapterIndex, bookText]);

  // Save scroll position (debounced 600ms)
  const handleScroll = useCallback(() => {
    clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      if (!scrollRef.current) return;
      readingRoomDb.readingProgress.put({
        bookId: book.id,
        chapterIndex,
        scrollPosition: scrollRef.current.scrollTop,
        updatedAt: Date.now(),
      });
    }, 600);
  }, [book.id, chapterIndex]);

  // Save settings to Dexie
  const updateFontSize = (size: number) => {
    const clamped = clamp(size, 14, 24);
    setFontSize(clamped);
    readingRoomDb.readerSettings.put({ id: 'default', fontSize: clamped, lineWidth });
  };

  const updateLineWidth = (lw: ReaderSettings['lineWidth']) => {
    setLineWidth(lw);
    readingRoomDb.readerSettings.put({ id: 'default', fontSize, lineWidth: lw });
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (!bookText) return;
      if (e.key === 'ArrowLeft') {
        setChapterIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight') {
        setChapterIndex((i) => Math.min(bookText.chapters.length - 1, i + 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, bookText]);

  const totalChapters = bookText?.chapters.length ?? 0;
  const chapter = bookText?.chapters[chapterIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Reading: ${book.title}`}
      style={{ background: 'var(--bg-canvas)' }}
    >
      {/* Reader top bar */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-6 h-12 border-b"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close reader"
          className="inline-flex items-center gap-1.5 font-manuscript text-sm cursor-pointer transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronLeft className="w-4 h-4" /> Close
        </button>
        <div className="flex-1 min-w-0 text-center">
          <span
            className="font-heading text-sm font-semibold truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {book.title}
          </span>
          {totalChapters > 0 && (
            <span className="font-manuscript text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
              — Ch. {chapterIndex + 1} / {totalChapters}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Reader settings"
          aria-expanded={showSettings}
          className="p-1.5 rounded cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 overflow-hidden border-b"
            style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-surface)' }}
          >
            <div className="flex flex-wrap items-center gap-5 px-5 py-3">
              {/* Font size */}
              <div className="flex items-center gap-2">
                <span className="font-manuscript text-xs" style={{ color: 'var(--text-muted)' }}>
                  Font size
                </span>
                <button
                  type="button"
                  onClick={() => updateFontSize(fontSize - 1)}
                  aria-label="Decrease font size"
                  className="w-6 h-6 flex items-center justify-center border rounded cursor-pointer hover:bg-[var(--burgundy-wash)]"
                  style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
                >
                  −
                </button>
                <span className="font-manuscript text-sm w-7 text-center" style={{ color: 'var(--text-primary)' }}>
                  {fontSize}
                </span>
                <button
                  type="button"
                  onClick={() => updateFontSize(fontSize + 1)}
                  aria-label="Increase font size"
                  className="w-6 h-6 flex items-center justify-center border rounded cursor-pointer hover:bg-[var(--burgundy-wash)]"
                  style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
                >
                  +
                </button>
              </div>
              {/* Line width */}
              <div className="flex items-center gap-2">
                <span className="font-manuscript text-xs" style={{ color: 'var(--text-muted)' }}>
                  Line width
                </span>
                {(['narrow', 'medium', 'wide'] as const).map((lw) => (
                  <button
                    key={lw}
                    type="button"
                    onClick={() => updateLineWidth(lw)}
                    aria-pressed={lineWidth === lw}
                    className="font-manuscript text-xs px-2.5 py-1 border rounded cursor-pointer transition-colors capitalize"
                    style={{
                      borderColor: lineWidth === lw ? 'var(--accent-primary)' : 'var(--border-hairline)',
                      background: lineWidth === lw ? 'var(--burgundy-wash)' : 'transparent',
                      color: lineWidth === lw ? 'var(--accent-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {lw}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chapter navigation bar */}
      {totalChapters > 1 && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-4 sm:px-6 py-2 border-b text-sm"
          style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-surface)' }}
        >
          <button
            type="button"
            onClick={() => setChapterIndex((i) => Math.max(0, i - 1))}
            disabled={chapterIndex === 0}
            aria-label="Previous chapter"
            className="flex items-center gap-1 font-manuscript text-xs px-2 py-1 border rounded cursor-pointer disabled:opacity-40 hover:bg-[var(--burgundy-wash)] transition-colors"
            style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          <select
            value={chapterIndex}
            onChange={(e) => setChapterIndex(Number(e.target.value))}
            aria-label="Jump to chapter"
            className="flex-1 font-manuscript text-xs px-2 py-1 border rounded bg-transparent cursor-pointer"
            style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-primary)' }}
          >
            {bookText?.chapters.map((ch, i) => (
              <option key={i} value={i}>
                {ch.title || `Chapter ${i + 1}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setChapterIndex((i) => Math.min(totalChapters - 1, i + 1))}
            disabled={chapterIndex === totalChapters - 1}
            aria-label="Next chapter"
            className="flex items-center gap-1 font-manuscript text-xs px-2 py-1 border rounded cursor-pointer disabled:opacity-40 hover:bg-[var(--burgundy-wash)] transition-colors"
            style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Content area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 sm:px-10 py-8"
      >
        <div className={`mx-auto ${lineWidthClasses[lineWidth]}`}>
          {loading && (
            <div className="flex flex-col items-center gap-4 py-20">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-brass)' }} />
              <p className="font-manuscript italic" style={{ color: 'var(--text-muted)' }}>
                Fetching the volume from the archive…
              </p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-3 py-20">
              <AlertCircle className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
              <p className="font-manuscript text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
            </div>
          )}
          {!loading && !error && chapter && (
            <article>
              {chapter.title && (
                <h2
                  className="font-heading text-2xl sm:text-3xl font-semibold mb-8 pb-3 border-b text-center"
                  style={{ color: 'var(--text-primary)', borderColor: 'var(--border-hairline)' }}
                >
                  {chapter.title}
                </h2>
              )}
              <div
                className="font-manuscript leading-relaxed whitespace-pre-wrap"
                style={{ fontSize: `${fontSize}px`, color: 'var(--text-primary)' }}
              >
                {chapter.content}
              </div>
            </article>
          )}
          {!loading && !error && bookText && bookText.chapters.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-20">
              <BookOpen className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
              <p className="font-manuscript italic" style={{ color: 'var(--text-muted)' }}>
                Could not parse chapters from this volume.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard hint */}
      <div
        className="flex-shrink-0 hidden sm:flex items-center justify-center py-2 border-t gap-6"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        {totalChapters > 1 && (
          <span className="font-manuscript text-[11px]" style={{ color: 'var(--text-muted)' }}>
            ← → navigate chapters
          </span>
        )}
        <span className="font-manuscript text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Esc to close
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export const ReadingRoomPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 480);
  const [results, setResults] = useState<LibraryBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [readerBook, setReaderBook] = useState<LibraryBook | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Live favorites from Dexie (auto-reactive via useLiveQuery)
  const favorites = useLiveQuery(
    () => readingRoomDb.favorites.orderBy('addedAt').reverse().toArray(),
    [],
    [] as FavoriteBook[]
  );
  const favoriteIds = useMemo(
    () => new Set((favorites ?? []).map((f) => f.id)),
    [favorites]
  );

  // Search on debounced query change
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    fetch(`/api/library/search?q=${encodeURIComponent(debouncedQuery.trim())}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json() as Promise<LibraryBook[]>;
      })
      .then((data) => {
        setResults(data);
        setSearching(false);
      })
      .catch((e: unknown) => {
        setSearchError(e instanceof Error ? e.message : 'Search failed.');
        setSearching(false);
      });
  }, [debouncedQuery]);

  const toggleFavorite = useCallback(async (book: LibraryBook) => {
    if (favoriteIds.has(book.id)) {
      await readingRoomDb.favorites.delete(book.id);
    } else {
      await readingRoomDb.favorites.put({
        id: book.id,
        title: book.title,
        authors: book.authors,
        subjects: book.subjects,
        coverUrl: book.coverUrl,
        language: book.language,
        textUrl: book.textUrl,
        addedAt: Date.now(),
      });
    }
  }, [favoriteIds]);

  const openReader = useCallback((book: LibraryBook) => {
    setSelectedBook(null);
    setReaderBook(book);
  }, []);

  return (
    <>
      {/* Reader overlay */}
      <AnimatePresence>
        {readerBook && (
          <motion.div
            key="reader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <ReaderView book={readerBook} onClose={() => setReaderBook(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Book detail dialog */}
      <AnimatePresence>
        {selectedBook && !readerBook && (
          <BookDetailDialog
            key={selectedBook.id}
            book={selectedBook}
            isFavorite={favoriteIds.has(selectedBook.id)}
            onClose={() => setSelectedBook(null)}
            onToggleFavorite={toggleFavorite}
            onRead={openReader}
          />
        )}
      </AnimatePresence>

      {/* Page */}
      <div
        className="max-w-[1260px] mx-auto px-5 sm:px-8 lg:px-12 py-10"
        style={{ color: 'var(--text-primary)' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-8">
          <BookMarked
            className="w-7 h-7 mt-0.5 flex-shrink-0"
            style={{ color: 'var(--accent-brass)' }}
            strokeWidth={1.4}
          />
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              The Reading Room
            </h1>
            <p className="font-manuscript italic mt-1" style={{ color: 'var(--text-secondary)' }}>
              Public-domain books only, via Project Gutenberg
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-10">
          <label htmlFor="reading-room-search" className="sr-only">
            Search public-domain books
          </label>
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            {searching && (
              <Loader2
                className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin"
                style={{ color: 'var(--accent-brass)' }}
              />
            )}
            <input
              id="reading-room-search"
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or author — e.g. Jane Austen, Moby Dick…"
              className="w-full pl-10 pr-10 py-3 font-manuscript text-sm border rounded-sm bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border-brass)',
                color: 'var(--text-primary)',
              }}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="reading-room-hint"
            />
          </div>
          <p
            id="reading-room-hint"
            className="font-manuscript text-xs mt-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            Searching thousands of public-domain classics — results update as you type.
          </p>
        </div>

        {/* Search error */}
        {searchError && (
          <div
            className="flex items-center gap-2 mb-6 px-4 py-3 border rounded-sm"
            style={{ borderColor: 'var(--accent-primary)', background: 'var(--burgundy-wash)', color: 'var(--accent-primary)' }}
            role="alert"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-manuscript text-sm">{searchError}</span>
          </div>
        )}

        {/* Favorites shelf */}
        {favorites && favorites.length > 0 && (
          <section aria-labelledby="favorites-heading" className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Heart
                className="w-4 h-4 fill-current"
                style={{ color: 'var(--accent-primary)' }}
              />
              <h2
                id="favorites-heading"
                className="font-heading text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Your Favourites
              </h2>
              <span className="font-manuscript text-xs" style={{ color: 'var(--text-muted)' }}>
                ({favorites.length})
              </span>
            </div>
            {/* Shelf background */}
            <div
              className="relative rounded-sm p-4 pb-6 overflow-x-auto"
              style={{
                background: 'color-mix(in srgb, var(--bg-surface) 70%, transparent)',
                borderBottom: '4px solid var(--border-brass)',
                boxShadow: 'inset 0 -4px 12px rgba(0,0,0,0.12)',
              }}
            >
              <div className="flex gap-3 items-end min-w-min" role="list" aria-label="Favourite books">
                {favorites.map((fav) => (
                  <div key={fav.id} role="listitem">
                    <SpineCard
                      book={fav}
                      isFavorite={true}
                      onClick={() => setSelectedBook(fav)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Search results */}
        {results.length > 0 && (
          <section aria-labelledby="results-heading">
            <div className="flex items-center gap-2 mb-4">
              <Library className="w-4 h-4" style={{ color: 'var(--accent-brass)' }} />
              <h2
                id="results-heading"
                className="font-heading text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Search Results
              </h2>
              <span className="font-manuscript text-xs" style={{ color: 'var(--text-muted)' }}>
                ({results.length} books found)
              </span>
            </div>
            <div
              className="flex flex-wrap gap-4"
              role="list"
              aria-label="Search results"
            >
              {results.map((book) => (
                <div key={book.id} role="listitem">
                  <CoverCard
                    book={book}
                    isFavorite={favoriteIds.has(book.id)}
                    onClick={() => setSelectedBook(book)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state — no query, no favorites */}
        {!query && (!favorites || favorites.length === 0) && (
          <div className="flex flex-col items-center gap-5 py-20 text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}
            >
              <BookMarked className="w-9 h-9" style={{ color: 'var(--accent-brass)' }} strokeWidth={1.2} />
            </div>
            <div>
              <p className="font-heading text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Your reading room awaits
              </p>
              <p className="font-manuscript italic mt-2" style={{ color: 'var(--text-secondary)' }}>
                Search for a classic — Austen, Dickens, Tolstoy, Poe — and settle in.
              </p>
            </div>
          </div>
        )}

        {/* Empty search results */}
        {query && !searching && results.length === 0 && !searchError && debouncedQuery === query && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <BookOpen className="w-10 h-10" style={{ color: 'var(--text-muted)' }} strokeWidth={1.2} />
            <p className="font-manuscript italic" style={{ color: 'var(--text-secondary)' }}>
              No volumes matched "{query}" in the Gutenberg archive.
            </p>
            <p className="font-manuscript text-xs" style={{ color: 'var(--text-muted)' }}>
              Try a different title or author name.
            </p>
          </div>
        )}
      </div>
    </>
  );
};

