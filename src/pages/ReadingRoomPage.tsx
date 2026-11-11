/**
 * ReadingRoomPage.tsx
 * Phase A & Rich EPUB Reader — The Reading Room folio for Inkwell Atelier.
 *
 * Provides:
 *  • Search bar → Gutendex / Project Gutenberg proxy (/api/library/search)
 *  • Book shelf (spine + cover cards)
 *  • Favorites shelf (IndexedDB via Dexie)
 *  • Book detail dialog with high-res cover
 *  • Rich EPUB / HTML Reader:
 *      - Full Table of Contents (nested levels, chapter progress)
 *      - Scoped Gutenberg typography with Inkwell themes
 *      - Real illustrations, figures, and click-to-zoom image lightbox
 *      - Poetry verse, blockquotes, drop caps
 *      - Lazy chapter loading & next-chapter prefetching
 *      - Reading position memory (chapter & scroll offset)
 *      - Offline caching of manifests & chapters in IndexedDB (Dexie)
 *      - Loading skeletons & "Read as plain text" fallback
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
  ListOrdered,
  ZoomIn,
  RotateCcw,
} from 'lucide-react';
import {
  readingRoomDb,
  type FavoriteBook,
  type ReaderSettings,
} from '../lib/readingRoomDb';
import { useLiveQuery } from 'dexie-react-hooks';

// ---------------------------------------------------------------------------
// Types
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

export interface TocItem {
  id: string;
  title: string;
  level: number;
  href: string;
  chapterId?: string;
}

export interface ChapterItem {
  id: string;
  title: string;
  order: number;
  wordCount: number;
  href: string;
}

export interface BookManifest {
  id: number;
  title: string;
  authors: string[];
  cover: string | null;
  toc: TocItem[];
  chapters: ChapterItem[];
  source: 'epub' | 'html' | 'text';
}

export interface ChapterData {
  title: string;
  html: string;
  nextChapterId: string | null;
  prevChapterId: string | null;
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
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-sm"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      />
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
      {isFavorite && (
        <div
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: 'var(--accent-primary)' }}
        >
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
        <div
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow"
          style={{ background: 'var(--accent-primary)' }}
        >
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 cursor-pointer"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />
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
        <div className="flex flex-col sm:flex-row gap-5 p-5 sm:p-6">
          <div
            className="flex-shrink-0 mx-auto sm:mx-0 rounded-sm overflow-hidden shadow-lg border border-[var(--border-brass)]"
            style={{ width: '120px', height: '170px', background: spineColor(book.id) }}
          >
            {book.coverUrl && !imgErr ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                onError={() => setImgErr(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                <BookText className="w-8 h-8 opacity-40 text-white mb-2" />
                <span className="font-heading text-xs text-white/80 line-clamp-3">
                  {book.title}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2
              className="font-heading text-xl sm:text-2xl font-semibold leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {book.title}
            </h2>
            <p className="font-manuscript text-base italic mt-1" style={{ color: 'var(--text-secondary)' }}>
              {book.authors.join(', ')}
            </p>
            {book.language.length > 0 && (
              <p className="font-manuscript text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Language: {book.language.join(', ').toUpperCase()} · Complete Edition
              </p>
            )}
            {book.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {book.subjects.slice(0, 6).map((s) => (
                  <span
                    key={s}
                    className="inline-block font-manuscript text-[11px] px-2.5 py-0.5 rounded-full border"
                    style={{
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-canvas)',
                    }}
                  >
                    {s.length > 32 ? s.slice(0, 32) + '…' : s}
                  </span>
                ))}
              </div>
            )}
            <p className="font-manuscript text-xs italic mt-4" style={{ color: 'var(--accent-brass)' }}>
              ❦ Public-domain edition via Project Gutenberg — Illustrated EPUB format
            </p>
          </div>
        </div>

        <div
          className="flex flex-col sm:flex-row gap-2.5 px-5 sm:px-6 pb-5 sm:pb-6 border-t pt-4"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <button
            type="button"
            onClick={() => onRead(book)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-5 font-manuscript text-sm border cursor-pointer transition-colors shadow-sm hover:opacity-95"
            style={{
              background: 'var(--accent-primary)',
              borderColor: 'var(--accent-primary)',
              color: '#F4EFE5',
            }}
          >
            <BookOpen className="w-4 h-4" />
            Read this volume
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
// Image Lightbox Modal (Click to zoom on illustrations)
// ---------------------------------------------------------------------------

const ImageLightbox: React.FC<{
  src: string;
  alt?: string;
  onClose: () => void;
}> = ({ src, alt, onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-zoom-out"
      style={{ background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[92vh] flex flex-col items-center">
        <img
          src={src}
          alt={alt || 'Enlarged Illustration'}
          className="max-w-full max-h-[82vh] object-contain rounded border shadow-2xl p-2"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-brass)' }}
          onClick={(e) => e.stopPropagation()}
        />
        {alt && (
          <p
            className="font-manuscript italic text-xs mt-3 text-center px-4 max-w-xl text-neutral-300"
            onClick={(e) => e.stopPropagation()}
          >
            {alt}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image zoom"
          className="absolute -top-3 -right-3 p-2 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-brass)] rounded-full shadow-lg cursor-pointer hover:bg-[var(--burgundy-wash)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Table of Contents Drawer
// ---------------------------------------------------------------------------

const TocDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  manifest: BookManifest | null;
  activeChapterId: string;
  onSelectChapter: (chapterId: string, anchor?: string) => void;
}> = ({ isOpen, onClose, manifest, activeChapterId, onSelectChapter }) => {
  const [filterText, setFilterText] = useState('');

  const filteredToc = useMemo(() => {
    if (!manifest?.toc) return [];
    if (!filterText.trim()) return manifest.toc;
    const q = filterText.toLowerCase();
    return manifest.toc.filter((t) => t.title.toLowerCase().includes(q));
  }, [manifest?.toc, filterText]);

  const activeIndex = useMemo(() => {
    if (!manifest?.chapters) return 0;
    const idx = manifest.chapters.findIndex((c) => c.id === activeChapterId);
    return idx >= 0 ? idx : 0;
  }, [manifest?.chapters, activeChapterId]);

  const totalChapters = manifest?.chapters.length || 1;
  const progressPercent = Math.round(((activeIndex + 1) / totalChapters) * 100);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Table of Contents">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full sm:max-w-md h-full flex flex-col border-r shadow-2xl"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-brass)',
              color: 'var(--text-primary)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b shrink-0"
              style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-canvas)' }}
            >
              <div>
                <h3 className="font-heading text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Table of Contents
                </h3>
                <p className="font-manuscript text-xs italic mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Chapter {activeIndex + 1} of {totalChapters} · {progressPercent}% read
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close table of contents"
                className="p-1.5 rounded cursor-pointer hover:bg-[var(--burgundy-wash)] transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter */}
            {manifest && manifest.toc.length > 8 && (
              <div className="px-4 py-2 border-b shrink-0" style={{ borderColor: 'var(--border-hairline)' }}>
                <input
                  type="search"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter chapters…"
                  className="w-full font-manuscript text-xs px-3 py-1.5 border rounded outline-none bg-transparent"
                  style={{
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-canvas)',
                  }}
                />
              </div>
            )}

            {/* TOC list */}
            <div className="flex-1 overflow-y-auto py-2">
              {filteredToc.length > 0 ? (
                <ul className="space-y-0.5">
                  {filteredToc.map((t) => {
                    const isCurrent = t.chapterId === activeChapterId;
                    const paddingLeft = `${Math.min(t.level - 1, 3) * 16 + 16}px`;

                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (t.chapterId) {
                              const hash = t.href.includes('#') ? t.href.split('#')[1] : undefined;
                              onSelectChapter(t.chapterId, hash);
                              onClose();
                            }
                          }}
                          className="w-full text-left font-manuscript text-sm py-2 pr-4 transition-colors flex items-center justify-between cursor-pointer"
                          style={{
                            paddingLeft,
                            background: isCurrent ? 'var(--burgundy-wash)' : 'transparent',
                            color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                            fontWeight: isCurrent ? 600 : t.level === 1 ? 500 : 400,
                          }}
                        >
                          <span className="truncate pr-2">{t.title}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent-primary)] shrink-0">
                              Reading
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : manifest?.chapters ? (
                /* Fallback to chapters list if TOC items are missing */
                <ul className="space-y-0.5">
                  {manifest.chapters.map((ch) => {
                    const isCurrent = ch.id === activeChapterId;
                    return (
                      <li key={ch.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectChapter(ch.id);
                            onClose();
                          }}
                          className="w-full text-left font-manuscript text-sm px-4 py-2 transition-colors flex items-center justify-between cursor-pointer"
                          style={{
                            background: isCurrent ? 'var(--burgundy-wash)' : 'transparent',
                            color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                            fontWeight: isCurrent ? 600 : 400,
                          }}
                        >
                          <span className="truncate pr-2">{ch.title}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent-primary)] shrink-0">
                              Reading
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="py-12 text-center text-xs font-manuscript italic" style={{ color: 'var(--text-muted)' }}>
                  No chapters found.
                </div>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

// ---------------------------------------------------------------------------
// Main Rich Reader View
// ---------------------------------------------------------------------------

const lineWidthClasses: Record<ReaderSettings['lineWidth'], string> = {
  narrow: 'max-w-[54ch]',
  medium: 'max-w-[72ch]',
  wide: 'max-w-[90ch]',
};

const ReaderView: React.FC<{
  book: LibraryBook;
  onClose: () => void;
}> = ({ book, onClose }) => {
  const [manifest, setManifest] = useState<BookManifest | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string>('');
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(true);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usePlainTextFallback, setUsePlainTextFallback] = useState(false);

  // Reader UI settings
  const [fontSize, setFontSize] = useState(18);
  const [lineWidth, setLineWidth] = useState<ReaderSettings['lineWidth']>('medium');
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt?: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingAnchorRef = useRef<string | null>(null);

  // 1. Load reader settings & initial progress from Dexie
  useEffect(() => {
    (async () => {
      const settings = await readingRoomDb.readerSettings.get('default');
      if (settings) {
        setFontSize(settings.fontSize);
        setLineWidth(settings.lineWidth);
      }
    })();
  }, []);

  // 2. Load Book Manifest (Check Dexie cache first, then fetch)
  const loadManifest = useCallback(async () => {
    setLoadingManifest(true);
    setError(null);

    // Try Dexie cache
    try {
      const cached = await readingRoomDb.cachedManifests.get(book.id);
      if (cached?.data) {
        setManifest(cached.data);
      }
    } catch (e) {
      console.warn('Dexie manifest read error:', e);
    }

    try {
      const res = await fetch(`/api/library/book/${book.id}/manifest`);
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = (await res.json()) as BookManifest;
      setManifest(data);

      // Save to Dexie cache
      readingRoomDb.cachedManifests.put({
        id: book.id,
        data,
        updatedAt: Date.now(),
      });

      // Restore last reading position
      const progress = await readingRoomDb.readingProgress.get(book.id);
      let targetChapterId = '';
      if (progress?.chapterId && data.chapters.some((c) => c.id === progress.chapterId)) {
        targetChapterId = progress.chapterId;
      } else if (progress?.chapterIndex !== undefined && data.chapters[progress.chapterIndex]) {
        targetChapterId = data.chapters[progress.chapterIndex].id;
      } else if (data.chapters.length > 0) {
        // Skip purely cover-only first chapter if second chapter is Chapter 1
        targetChapterId = data.chapters[0].id;
      }
      setActiveChapterId(targetChapterId);
    } catch (err: unknown) {
      console.warn('Manifest load error:', err);
      // If we don't have cached manifest, set error
      if (!manifest) {
        setError(err instanceof Error ? err.message : 'Could not load book manifest.');
      }
    } finally {
      setLoadingManifest(false);
    }
  }, [book.id]);

  useEffect(() => {
    loadManifest();
  }, [loadManifest]);

  // 3. Load Chapter HTML when activeChapterId changes
  const loadChapter = useCallback(
    async (chapterId: string, anchor?: string) => {
      if (!chapterId) return;
      setLoadingChapter(true);
      setError(null);
      if (anchor) pendingAnchorRef.current = anchor;

      const cacheKey = `${book.id}-${chapterId}`;

      // Check Dexie cached chapter
      try {
        const cached = await readingRoomDb.cachedChapters.get(cacheKey);
        if (cached?.data) {
          setChapterData(cached.data);
          setLoadingChapter(false);
        }
      } catch (e) {
        console.warn('Dexie chapter read error:', e);
      }

      try {
        const res = await fetch(`/api/library/book/${book.id}/chapter/${encodeURIComponent(chapterId)}`);
        if (!res.ok) {
          throw new Error(`Server error ${res.status}`);
        }
        const data = (await res.json()) as ChapterData;
        setChapterData(data);

        // Save to Dexie cache
        readingRoomDb.cachedChapters.put({
          id: cacheKey,
          bookId: book.id,
          chapterId,
          data,
          updatedAt: Date.now(),
        });

        // Background prefetch next chapter
        if (data.nextChapterId) {
          const nextKey = `${book.id}-${data.nextChapterId}`;
          readingRoomDb.cachedChapters.get(nextKey).then((nextCached) => {
            if (!nextCached) {
              fetch(`/api/library/book/${book.id}/chapter/${encodeURIComponent(data.nextChapterId!)}`)
                .then((r) => r.ok && r.json())
                .then((nextData) => {
                  if (nextData) {
                    readingRoomDb.cachedChapters.put({
                      id: nextKey,
                      bookId: book.id,
                      chapterId: data.nextChapterId!,
                      data: nextData,
                      updatedAt: Date.now(),
                    });
                  }
                })
                .catch(() => {});
            }
          });
        }
      } catch (err: unknown) {
        console.warn('Chapter load error:', err);
        if (!chapterData) {
          setError(err instanceof Error ? err.message : 'Could not load chapter content.');
        }
      } finally {
        setLoadingChapter(false);
      }
    },
    [book.id, chapterData]
  );

  useEffect(() => {
    if (activeChapterId && !usePlainTextFallback) {
      loadChapter(activeChapterId);
    }
  }, [activeChapterId, loadChapter, usePlainTextFallback]);

  // 4. Scroll position restoration & anchor navigation
  useEffect(() => {
    if (!scrollRef.current || loadingChapter) return;

    if (pendingAnchorRef.current) {
      const anchorEl = scrollRef.current.querySelector(
        `#${CSS.escape(pendingAnchorRef.current)}, [name="${CSS.escape(pendingAnchorRef.current)}"]`
      );
      if (anchorEl) {
        anchorEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        pendingAnchorRef.current = null;
        return;
      }
    }

    // Restore saved scroll position for this chapter
    readingRoomDb.readingProgress.get(book.id).then((progress) => {
      if (progress && progress.chapterId === activeChapterId && scrollRef.current) {
        scrollRef.current.scrollTop = progress.scrollPosition;
      } else if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    });
  }, [activeChapterId, chapterData, loadingChapter, book.id]);

  // 5. Debounced scroll position saving
  const handleScroll = useCallback(() => {
    clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      if (!scrollRef.current || !manifest) return;
      const chapterIdx = manifest.chapters.findIndex((c) => c.id === activeChapterId);
      readingRoomDb.readingProgress.put({
        bookId: book.id,
        chapterId: activeChapterId,
        chapterIndex: chapterIdx >= 0 ? chapterIdx : 0,
        scrollPosition: scrollRef.current.scrollTop,
        updatedAt: Date.now(),
      });
    }, 500);
  }, [book.id, activeChapterId, manifest]);

  // 6. Handle click inside rendered chapter HTML (Zoom image, internal chapter link)
  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      // Handle image click to zoom
      if (target.tagName.toLowerCase() === 'img') {
        const img = target as HTMLImageElement;
        if (img.src) {
          e.preventDefault();
          setZoomedImage({ src: img.src, alt: img.alt });
          return;
        }
      }

      // Handle internal chapter navigation
      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (anchor) {
        const chapterTarget = anchor.getAttribute('data-chapter-link');
        const hashTarget = anchor.getAttribute('data-anchor');
        if (chapterTarget) {
          e.preventDefault();
          setActiveChapterId(chapterTarget);
          if (hashTarget) pendingAnchorRef.current = hashTarget;
          return;
        }

        // Anchor jump within same chapter
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const targetId = href.slice(1);
          const targetEl = scrollRef.current?.querySelector(
            `#${CSS.escape(targetId)}, [name="${CSS.escape(targetId)}"]`
          );
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    },
    []
  );

  // Settings updates
  const updateFontSize = (size: number) => {
    const clamped = clamp(size, 14, 24);
    setFontSize(clamped);
    readingRoomDb.readerSettings.put({ id: 'default', fontSize: clamped, lineWidth });
  };

  const updateLineWidth = (lw: ReaderSettings['lineWidth']) => {
    setLineWidth(lw);
    readingRoomDb.readerSettings.put({ id: 'default', fontSize, lineWidth: lw });
  };

  // Keyboard navigation: Left/Right arrows for chapter nav, Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomedImage) {
          setZoomedImage(null);
        } else if (showToc) {
          setShowToc(false);
        } else {
          onClose();
        }
        return;
      }
      if (!manifest || showToc || zoomedImage) return;
      if (e.key === 'ArrowLeft' && chapterData?.prevChapterId) {
        setActiveChapterId(chapterData.prevChapterId);
      } else if (e.key === 'ArrowRight' && chapterData?.nextChapterId) {
        setActiveChapterId(chapterData.nextChapterId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, manifest, chapterData, showToc, zoomedImage]);

  const activeIndex = useMemo(() => {
    if (!manifest?.chapters) return 0;
    const idx = manifest.chapters.findIndex((c) => c.id === activeChapterId);
    return idx >= 0 ? idx : 0;
  }, [manifest?.chapters, activeChapterId]);

  const totalChapters = manifest?.chapters.length || 1;
  const isTitlePage = activeIndex === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Reading: ${book.title}`}
      style={{ background: 'var(--bg-canvas)' }}
    >
      {/* Lightbox Modal */}
      {zoomedImage && (
        <ImageLightbox
          src={zoomedImage.src}
          alt={zoomedImage.alt}
          onClose={() => setZoomedImage(null)}
        />
      )}

      {/* Table of Contents Drawer */}
      <TocDrawer
        isOpen={showToc}
        onClose={() => setShowToc(false)}
        manifest={manifest}
        activeChapterId={activeChapterId}
        onSelectChapter={(id, anchor) => {
          setActiveChapterId(id);
          if (anchor) pendingAnchorRef.current = anchor;
        }}
      />

      {/* Reader Top Bar */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-3 sm:px-6 h-12 border-b select-none z-10"
        style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-canvas)' }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reader"
            className="inline-flex items-center gap-1.5 font-manuscript text-xs sm:text-sm cursor-pointer transition-opacity hover:opacity-75 py-1 px-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Library</span>
          </button>

          <button
            type="button"
            onClick={() => setShowToc(true)}
            aria-label="Open Table of Contents"
            className="inline-flex items-center gap-1.5 font-manuscript text-xs px-2.5 py-1 rounded border border-[var(--border-brass)] cursor-pointer hover:bg-[var(--burgundy-wash)] transition-colors"
            style={{ color: 'var(--text-primary)', background: 'var(--bg-surface)' }}
          >
            <ListOrdered className="w-3.5 h-3.5 text-[var(--accent-brass)]" />
            <span className="hidden sm:inline">Contents</span>
          </button>
        </div>

        {/* Center title & progress */}
        <div className="flex-1 min-w-0 text-center px-2">
          <h1
            className="font-heading text-xs sm:text-sm font-semibold truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {book.title}
          </h1>
          {manifest && totalChapters > 1 && (
            <p className="font-manuscript text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
              {chapterData?.title || `Chapter ${activeIndex + 1}`} ({activeIndex + 1}/{totalChapters})
            </p>
          )}
        </div>

        {/* Right actions (settings) */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            aria-label="Reader typography settings"
            aria-expanded={showSettings}
            className="p-1.5 rounded cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Typography Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex-shrink-0 overflow-hidden border-b z-10"
            style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-surface)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 max-w-4xl mx-auto">
              <div className="flex items-center gap-2">
                <span className="font-manuscript text-xs text-[var(--text-muted)]">Type Size</span>
                <button
                  type="button"
                  onClick={() => updateFontSize(fontSize - 1)}
                  aria-label="Decrease font size"
                  className="w-7 h-7 flex items-center justify-center border rounded cursor-pointer hover:bg-[var(--burgundy-wash)]"
                  style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
                >
                  −
                </button>
                <span className="font-mono text-xs w-6 text-center" style={{ color: 'var(--text-primary)' }}>
                  {fontSize}
                </span>
                <button
                  type="button"
                  onClick={() => updateFontSize(fontSize + 1)}
                  aria-label="Increase font size"
                  className="w-7 h-7 flex items-center justify-center border rounded cursor-pointer hover:bg-[var(--burgundy-wash)]"
                  style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
                >
                  +
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-manuscript text-xs text-[var(--text-muted)]">Measure</span>
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

              {manifest?.source === 'epub' && (
                <span className="font-mono text-[10px] text-[var(--accent-brass)]">
                  Illustrated EPUB3
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chapter Navigation Bar */}
      {manifest && totalChapters > 1 && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-3 sm:px-6 py-2 border-b text-sm z-10"
          style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-surface)' }}
        >
          <button
            type="button"
            onClick={() => chapterData?.prevChapterId && setActiveChapterId(chapterData.prevChapterId)}
            disabled={!chapterData?.prevChapterId}
            aria-label="Previous chapter"
            className="flex items-center gap-1 font-manuscript text-xs px-2.5 py-1.5 border rounded cursor-pointer disabled:opacity-40 hover:bg-[var(--burgundy-wash)] transition-colors bg-[var(--bg-canvas)] dark:bg-[#1A1916]"
            style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Prev</span>
          </button>

          <select
            value={activeChapterId}
            onChange={(e) => setActiveChapterId(e.target.value)}
            aria-label="Jump to chapter"
            className="flex-1 font-manuscript text-xs px-2.5 py-1.5 border rounded cursor-pointer bg-[var(--bg-canvas)] dark:bg-[#1A1916] text-[var(--text-primary)] dark:text-[#F4EFE5] border-[var(--border-brass)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] [color-scheme:light] dark:[color-scheme:dark]"
            style={{
              borderColor: 'var(--border-brass)',
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--text-primary)',
            }}
          >
            {manifest.chapters.map((ch, idx) => (
              <option
                key={ch.id}
                value={ch.id}
                className="bg-[var(--bg-surface)] dark:bg-[#24231F] text-[var(--text-primary)] dark:text-[#F4EFE5]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                }}
              >
                {ch.title || `Chapter ${idx + 1}`}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => chapterData?.nextChapterId && setActiveChapterId(chapterData.nextChapterId)}
            disabled={!chapterData?.nextChapterId}
            aria-label="Next chapter"
            className="flex items-center gap-1 font-manuscript text-xs px-2.5 py-1.5 border rounded cursor-pointer disabled:opacity-40 hover:bg-[var(--burgundy-wash)] transition-colors bg-[var(--bg-canvas)] dark:bg-[#1A1916]"
            style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
          >
            <span className="hidden sm:inline">Next</span> <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Reader Manuscript Content Viewport */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onClick={handleContentClick}
        className="flex-1 overflow-y-auto px-4 sm:px-10 py-8"
      >
        <div className={`mx-auto ${lineWidthClasses[lineWidth]}`}>
          {/* Skeletons while loading */}
          {(loadingManifest || loadingChapter) && !chapterData && (
            <div className="py-12 space-y-6 animate-pulse">
              <div className="h-8 bg-[var(--bg-recessed)] rounded w-2/3 mx-auto" />
              <div className="h-4 bg-[var(--bg-recessed)] rounded w-1/3 mx-auto" />
              <div className="space-y-3 pt-6">
                <div className="h-4 bg-[var(--bg-recessed)] rounded w-full" />
                <div className="h-4 bg-[var(--bg-recessed)] rounded w-11/12" />
                <div className="h-4 bg-[var(--bg-recessed)] rounded w-full" />
                <div className="h-4 bg-[var(--bg-recessed)] rounded w-4/5" />
              </div>
            </div>
          )}

          {/* Error View with Retry & Plain-Text Fallback */}
          {error && !chapterData && (
            <div className="flex flex-col items-center gap-4 py-16 text-center max-w-md mx-auto">
              <AlertCircle className="w-10 h-10 text-[var(--accent-primary)]" />
              <p className="font-heading text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                Could not load edition
              </p>
              <p className="font-manuscript text-sm" style={{ color: 'var(--text-secondary)' }}>
                {error}
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={loadManifest}
                  className="px-4 py-2 border rounded font-manuscript text-xs flex items-center gap-1.5 hover:bg-[var(--burgundy-wash)]"
                  style={{ borderColor: 'var(--border-brass)', color: 'var(--text-primary)' }}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            </div>
          )}

          {/* Book Title Colophon Page for Opening */}
          {isTitlePage && manifest && (
            <div className="text-center py-8 mb-8 border-b border-[var(--border-brass)]/40">
              {manifest.cover && (
                <div className="mb-6 mx-auto w-44 rounded overflow-hidden shadow-2xl border border-[var(--border-brass)]">
                  <img
                    src={manifest.cover}
                    alt={manifest.title}
                    className="w-full h-auto object-cover !m-0 !p-0 !border-0"
                  />
                </div>
              )}
              <h1 className="font-heading text-3xl sm:text-4xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {manifest.title}
              </h1>
              <p className="font-manuscript text-lg italic mt-2" style={{ color: 'var(--text-secondary)' }}>
                By {manifest.authors.join(', ')}
              </p>
              <p className="font-manuscript text-xs text-[var(--accent-brass)] mt-3">
                ❦ Standard Public-Domain Literary Edition
              </p>
            </div>
          )}

          {/* Render Sanitized Chapter HTML */}
          {chapterData && (
            <article
              className="inkwell-reader-container"
              style={{ fontSize: `${fontSize}px` }}
              dangerouslySetInnerHTML={{ __html: chapterData.html }}
            />
          )}

          {/* Chapter Bottom Navigation Footer */}
          {manifest && totalChapters > 1 && chapterData && (
            <div
              className="mt-14 pt-8 border-t flex items-center justify-between font-manuscript text-xs select-none"
              style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}
            >
              <div>
                {chapterData.prevChapterId ? (
                  <button
                    type="button"
                    onClick={() => setActiveChapterId(chapterData.prevChapterId!)}
                    className="hover:text-[var(--accent-primary)] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous Section
                  </button>
                ) : (
                  <span>Opening Section</span>
                )}
              </div>
              <span className="italic">
                Section {activeIndex + 1} of {totalChapters}
              </span>
              <div>
                {chapterData.nextChapterId ? (
                  <button
                    type="button"
                    onClick={() => setActiveChapterId(chapterData.nextChapterId!)}
                    className="hover:text-[var(--accent-primary)] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    Next Section <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-[var(--accent-brass)]">End of Volume ❦</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard navigation hints */}
      <div
        className="flex-shrink-0 hidden sm:flex items-center justify-center py-2 border-t gap-6 text-[11px] font-manuscript text-[var(--text-muted)] select-none"
        style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-canvas)' }}
      >
        <span>← → Navigate Chapters</span>
        <span>Click image to zoom</span>
        <span>Esc to close</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Page Export
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

  // Live favorites from Dexie
  const favorites = useLiveQuery(
    () => readingRoomDb.favorites.orderBy('addedAt').reverse().toArray(),
    [],
    [] as FavoriteBook[]
  );
  const favoriteIds = useMemo(
    () => new Set((favorites ?? []).map((f) => f.id)),
    [favorites]
  );

  // Search Gutendex
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

  const toggleFavorite = useCallback(
    async (book: LibraryBook) => {
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
    },
    [favoriteIds]
  );

  const openReader = useCallback((book: LibraryBook) => {
    setSelectedBook(null);
    setReaderBook(book);
  }, []);

  return (
    <>
      {/* Reader View Overlay */}
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

      {/* Book Detail Dialog */}
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

      {/* Main Study Shelf Page */}
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
              Complete Illustrated Public-Domain Classics via Project Gutenberg
            </p>
          </div>
        </div>

        {/* Search Bar */}
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
              placeholder="Search by title or author — e.g. Alice in Wonderland, Frankenstein, Austen…"
              className="w-full pl-10 pr-10 py-3 font-manuscript text-sm border rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
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
            Searching thousands of public-domain classics — formatted as true illustrated volumes.
          </p>
        </div>

        {/* Search Error */}
        {searchError && (
          <div
            className="flex items-center gap-2 mb-6 px-4 py-3 border rounded-sm"
            style={{
              borderColor: 'var(--accent-primary)',
              background: 'var(--burgundy-wash)',
              color: 'var(--accent-primary)',
            }}
            role="alert"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-manuscript text-sm">{searchError}</span>
          </div>
        )}

        {/* Favorites Shelf */}
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

        {/* Search Results */}
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

        {/* Empty State */}
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
                Search for a classic — Austen, Dickens, Shelley, Carroll — and settle in.
              </p>
            </div>
          </div>
        )}

        {/* Empty search results */}
        {query && !searching && results.length === 0 && !searchError && debouncedQuery === query && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <BookOpen className="w-10 h-10 text-[var(--text-muted)]" strokeWidth={1.2} />
            <p className="font-manuscript italic text-[var(--text-secondary)]">
              No volumes matched "{query}" in the Gutenberg archive.
            </p>
            <p className="font-manuscript text-xs text-[var(--text-muted)]">
              Try a different title or author name.
            </p>
          </div>
        )}
      </div>
    </>
  );
};
