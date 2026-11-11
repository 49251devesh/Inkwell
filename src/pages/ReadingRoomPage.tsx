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
  Shuffle,
  SlidersHorizontal,
  Star,
  Tag,
  User,
  Download,
  Clock,
  Info,
  Sparkles,
  Play,
  Check,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  readingRoomDb,
  type FavoriteBook,
  type ReaderSettings,
  type CachedCategoryResult,
} from '../lib/readingRoomDb';
import { useLiveQuery } from 'dexie-react-hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LibraryBook {
  id: number;
  title: string;
  authors: string[];
  authorYears?: { name: string; birthYear: number | null; deathYear: number | null }[];
  subjects: string[];
  bookshelves?: string[];
  coverUrl: string;
  language: string[];
  textUrl: string;
  downloadCount?: number;
  summary?: string;
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
// Typographic Cover Component (with fixed 2:3 aspect ratio & graceful fallback)
// ---------------------------------------------------------------------------

export const BookCover: React.FC<{
  book: Pick<LibraryBook, 'id' | 'title' | 'authors' | 'coverUrl'>;
  className?: string;
  aspectRatioClass?: string;
  imgClassName?: string;
}> = ({ book, className = '', aspectRatioClass = 'aspect-[2/3]', imgClassName = '' }) => {
  const [imgErr, setImgErr] = useState(false);
  const palette = [
    { bg: '#3E241E', border: '#B18A5A', spine: '#2A1713', text: '#F4EFE5', subtitle: '#D4BC98' }, // deep mahogany
    { bg: '#1E2D3E', border: '#B18A5A', spine: '#131D28', text: '#F4EFE5', subtitle: '#B5CEE0' }, // navy morocco
    { bg: '#1E3626', border: '#B18A5A', spine: '#122218', text: '#F4EFE5', subtitle: '#B8D9C0' }, // forest calf
    { bg: '#4A2A38', border: '#B18A5A', spine: '#311A24', text: '#F4EFE5', subtitle: '#E0BED0' }, // imperial plum
    { bg: '#3D3123', border: '#B18A5A', spine: '#261F16', text: '#F4EFE5', subtitle: '#D4C4AB' }, // aged walnut
    { bg: '#482E1E', border: '#B18A5A', spine: '#2D1B10', text: '#F4EFE5', subtitle: '#DEC3AF' }, // terracotta umber
    { bg: '#252528', border: '#B18A5A', spine: '#161618', text: '#F4EFE5', subtitle: '#CBCBCE' }, // charcoal buckram
    { bg: '#472124', border: '#B18A5A', spine: '#2C1315', text: '#F4EFE5', subtitle: '#E6BDC0' }, // deep burgundy
  ];
  const theme = palette[Math.abs(book.id) % palette.length];
  const authorName = (book.authors && book.authors[0]) || 'Unknown Author';

  return (
    <div
      className={`relative w-full ${aspectRatioClass} rounded-sm overflow-hidden select-none bg-[var(--bg-canvas)] ${className}`}
      style={{
        backgroundColor: theme.bg,
        boxShadow: '0 4px 14px rgba(0,0,0,0.24)',
      }}
    >
      {book.coverUrl && !imgErr ? (
        <img
          src={book.coverUrl}
          alt={book.title}
          loading="lazy"
          decoding="async"
          onError={() => setImgErr(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${imgClassName}`}
        />
      ) : (
        /* Typographic cover fallback with spine edge & brass border */
        <div
          className="absolute inset-0 p-2.5 sm:p-3 flex flex-col justify-between"
          style={{
            background: `linear-gradient(135deg, ${theme.bg} 0%, ${theme.spine} 100%)`,
            border: `1px solid ${theme.border}40`,
          }}
        >
          {/* Left spine highlight */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2 pointer-events-none"
            style={{
              background: 'linear-gradient(to right, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0.25) 100%)',
              borderRight: '1px solid rgba(0,0,0,0.3)',
            }}
          />
          {/* Inner brass decorative frame */}
          <div
            className="absolute inset-1.5 pointer-events-none rounded-[1px]"
            style={{
              border: `1px solid ${theme.border}50`,
            }}
          />
          {/* Header ornament */}
          <div className="relative pl-1.5 flex items-center justify-between text-[8px] sm:text-[9px] uppercase tracking-widest font-mono" style={{ color: theme.subtitle }}>
            <span>INKWELL</span>
            <span>№ {book.id}</span>
          </div>
          {/* Title & Author */}
          <div className="relative pl-1.5 py-1 text-center my-auto">
            <h4
              className="font-heading font-bold text-xs sm:text-sm leading-tight line-clamp-4"
              style={{ color: theme.text, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
            >
              {book.title}
            </h4>
            <div className="w-8 h-[1px] mx-auto my-1.5" style={{ background: theme.border }} />
            <p
              className="font-manuscript italic text-[11px] sm:text-xs line-clamp-2"
              style={{ color: theme.subtitle }}
            >
              {authorName}
            </p>
          </div>
          {/* Footer badge */}
          <div className="relative pl-1.5 text-center text-[7px] sm:text-[8px] font-manuscript uppercase tracking-wider" style={{ color: `${theme.subtitle}99` }}>
            Public Domain Classic
          </div>
        </div>
      )}
    </div>
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
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4, boxShadow: '0 16px 36px rgba(0,0,0,0.3)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      aria-label={`Open ${book.title}`}
      className="relative flex flex-col cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 text-left group book-cover-tilt"
      style={{
        width: '130px',
        boxShadow: '2px 4px 14px rgba(0,0,0,0.22)',
      }}
    >
      <div className="rounded-t-sm overflow-hidden w-full aspect-[2/3]">
        <BookCover book={book} />
      </div>
      <div
        className="rounded-b-sm px-2.5 py-2 border border-t-0 w-full"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <p
          className="font-heading text-[12px] font-semibold leading-tight line-clamp-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {book.title}
        </p>
        <p
          className="font-manuscript text-[11px] italic mt-0.5 truncate"
          style={{ color: 'var(--text-muted)' }}
        >
          {book.authors[0] ?? 'Unknown Author'}
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
  const restoredChapterRef = useRef<string | null>(null);
  const rafId = useRef<number | null>(null);

  // Lock body scroll while ReaderView is mounted so there is exactly ONE scroll container
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

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
        setError((prev) => prev || (err instanceof Error ? err.message : 'Could not load chapter content.'));
      } finally {
        setLoadingChapter(false);
      }
    },
    [book.id]
  );

  useEffect(() => {
    restoredChapterRef.current = null;
    if (activeChapterId && !usePlainTextFallback) {
      loadChapter(activeChapterId);
    }
  }, [activeChapterId, loadChapter, usePlainTextFallback]);

  // 4. Scroll position restoration & anchor navigation (restores once when chapter renders)
  useEffect(() => {
    if (!scrollRef.current || !chapterData || restoredChapterRef.current === activeChapterId) return;

    if (pendingAnchorRef.current) {
      const anchorEl = scrollRef.current.querySelector(
        `#${CSS.escape(pendingAnchorRef.current)}, [name="${CSS.escape(pendingAnchorRef.current)}"]`
      );
      if (anchorEl) {
        restoredChapterRef.current = activeChapterId;
        anchorEl.scrollIntoView({ behavior: 'auto', block: 'start' });
        pendingAnchorRef.current = null;
        return;
      }
    }

    // Restore saved scroll position once for this chapter
    restoredChapterRef.current = activeChapterId;
    readingRoomDb.readingProgress.get(book.id).then((progress) => {
      if (progress && progress.chapterId === activeChapterId && scrollRef.current) {
        scrollRef.current.scrollTop = progress.scrollPosition;
      } else if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    });
  }, [activeChapterId, chapterData, book.id]);

  // 5. Throttled scroll position saving with requestAnimationFrame
  const handleScroll = useCallback(() => {
    if (rafId.current !== null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (!scrollRef.current || !manifest) return;
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
    });
  }, [book.id, activeChapterId, manifest]);

  useEffect(() => {
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      clearTimeout(scrollSaveTimer.current);
    };
  }, []);

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
      className="inkwell-reader-root fixed inset-0 z-50 flex flex-col h-[100vh] h-[100dvh] max-h-[100vh] max-h-[100dvh]"
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
        className="inkwell-reader-scroll flex-1 overflow-y-auto px-4 sm:px-10 py-8"
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
// Category definitions
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { slug: 'horror-gothic',       label: 'Horror & Gothic',       icon: '🕯️' },
  { slug: 'science-fiction',     label: 'Science Fiction',        icon: '🚀' },
  { slug: 'mystery-crime',       label: 'Mystery & Crime',        icon: '🔍' },
  { slug: 'adventure',           label: 'Adventure',              icon: '⚓' },
  { slug: 'romance',             label: 'Romance',                icon: '🌹' },
  { slug: 'fantasy-myth',        label: 'Fantasy & Myth',         icon: '🐉' },
  { slug: 'science-nature',      label: 'Science & Nature',       icon: '🔬' },
  { slug: 'history',             label: 'History',                icon: '📜' },
  { slug: 'biography-memoir',    label: 'Biography & Memoir',     icon: '✒️' },
  { slug: 'philosophy-religion', label: 'Philosophy & Religion',  icon: '⚖️' },
  { slug: 'travel-exploration',  label: 'Travel & Exploration',   icon: '🗺️' },
  { slug: 'poetry-drama',        label: 'Poetry & Drama',         icon: '🎭' },
  { slug: 'childrens-classics',     label: "Children's Classics",      icon: '🧸' },
  { slug: 'humor-satire',           label: 'Humor & Satire',           icon: '😄' },
  { slug: 'documentary-nonfiction', label: 'Documentary & Nonfiction', icon: '📰' },
] as const;

type CategorySlug = typeof CATEGORIES[number]['slug'];

const CATEGORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours IDB cache

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCategoryBooks(
  slug: string,
  page: number,
  sort: string,
  language: string,
  fromYear: string,
  toYear: string,
  coversOnly: boolean
): Promise<{ books: LibraryBook[]; total: number }> {
  const cacheId = `browse-${slug}-p${page}-${sort}-${language}-${fromYear}-${toYear}-${coversOnly}`;
  try {
    const cached = await readingRoomDb.cachedCategoryResults.get(cacheId);
    if (cached && Date.now() - cached.updatedAt < CATEGORY_TTL_MS) {
      return { books: cached.data as LibraryBook[], total: cached.total };
    }
  } catch { /* ignore IDB error */ }

  const params = new URLSearchParams({ category: slug, page: String(page), sort });
  if (language)   params.set('language', language);
  if (fromYear)   params.set('from_year', fromYear);
  if (toYear)     params.set('to_year', toYear);
  if (coversOnly) params.set('covers_only', 'true');

  const r = await fetch(`/api/library/browse?${params}`);
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(err.error || `HTTP ${r.status}`);
  }
  const json = (await r.json()) as { books: LibraryBook[]; total: number };

  try {
    const record: CachedCategoryResult = {
      id: cacheId,
      data: json.books,
      total: json.total,
      updatedAt: Date.now(),
    };
    await readingRoomDb.cachedCategoryResults.put(record);
  } catch { /* non-fatal */ }

  return json;
}

// Estimated reading time from download count (rough proxy: popular = more words)
function estimateReadingTime(downloadCount?: number): string | null {
  if (!downloadCount) return null;
  // Very rough heuristic: average novel ~80k words, ~250 wpm reading speed = ~320 min
  // Map download count to a rough page-count estimate:
  const hours = Math.round((downloadCount / 10000) * 3);
  if (hours < 1) return '< 1 hour';
  if (hours === 1) return '~1 hour';
  return `~${hours} hours`;
}

function authorEraLabel(authorYears?: { birthYear: number | null; deathYear: number | null }[]): string {
  if (!authorYears?.length) return '';
  const { birthYear, deathYear } = authorYears[0];
  if (birthYear && deathYear) return `(${birthYear}–${deathYear})`;
  if (birthYear) return `(b. ${birthYear})`;
  return '';
}

// ---------------------------------------------------------------------------
// Netflix-Style Book Card
// ---------------------------------------------------------------------------

export const NetflixBookCard: React.FC<{
  book: LibraryBook;
  isFavorite: boolean;
  onRead: (book: LibraryBook) => void;
  onToggleFavorite: (book: LibraryBook) => void;
  onOpenDetail: (book: LibraryBook) => void;
  rank?: number;
  progressPercent?: number;
}> = ({
  book,
  isFavorite,
  onRead,
  onToggleFavorite,
  onOpenDetail,
  rank,
  progressPercent,
}) => {
  const readingTime = estimateReadingTime(book.downloadCount);
  const authorName = (book.authors && book.authors[0]) || 'Unknown Author';
  const subjects = (book.subjects || []).slice(0, 2);

  return (
    <div
      className="relative flex-shrink-0 group select-none snap-start"
      style={{ width: '160px' }}
    >
      <motion.div
        whileHover={{ y: -8, scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 350, damping: 22 }}
        className="relative flex flex-col rounded-sm overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-md transition-shadow hover:shadow-2xl"
      >
        {/* Top 10 Rank Numeral (Netflix style) */}
        {rank !== undefined && (
          <div
            className="absolute -left-2 bottom-1 pointer-events-none z-10 font-display font-black text-6xl sm:text-7xl leading-none select-none"
            style={{
              WebkitTextStroke: '2px var(--accent-brass)',
              color: 'var(--bg-canvas)',
              filter: 'drop-shadow(2px 3px 5px rgba(0,0,0,0.5))',
              opacity: 0.92,
            }}
          >
            {rank}
          </div>
        )}

        {/* 2:3 Cover container with click to open detail on mobile */}
        <div
          className="relative w-full aspect-[2/3] cursor-pointer"
          onClick={() => onOpenDetail(book)}
        >
          <BookCover book={book} />

          {/* Reading progress bar across bottom of cover */}
          {progressPercent !== undefined && (
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60 z-20">
              <div
                className="h-full bg-[var(--accent-primary)] transition-all"
                style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
              />
            </div>
          )}

          {/* Desktop Hover Quick Action Overlay (Netflix style) */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2.5 flex flex-col justify-between z-20 pointer-events-none group-hover:pointer-events-auto">
            {/* Quick action buttons */}
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRead(book);
                }}
                className="w-8 h-8 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center shadow hover:opacity-95 cursor-pointer transition-transform hover:scale-110"
                title="Read volume"
                aria-label={`Read ${book.title}`}
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(book);
                  }}
                  className="w-8 h-8 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-brass)] text-[var(--text-primary)] flex items-center justify-center shadow hover:bg-[var(--burgundy-wash)] cursor-pointer transition-transform hover:scale-110"
                  title={isFavorite ? 'Unfavorite' : 'Add to Favorites'}
                  aria-label={isFavorite ? `Unfavorite ${book.title}` : `Favorite ${book.title}`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      isFavorite ? 'fill-[var(--accent-primary)] text-[var(--accent-primary)]' : ''
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail(book);
                  }}
                  className="w-8 h-8 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-brass)] text-[var(--text-primary)] flex items-center justify-center shadow hover:bg-[var(--burgundy-wash)] cursor-pointer transition-transform hover:scale-110"
                  title="Volume details"
                  aria-label={`Details for ${book.title}`}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick stats & tags */}
            <div className="space-y-1">
              {book.downloadCount !== undefined && book.downloadCount > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-white/80 font-mono">
                  <Download className="w-2.5 h-2.5 text-[var(--accent-brass)]" />
                  <span>{book.downloadCount.toLocaleString()}</span>
                </div>
              )}
              {readingTime && (
                <div className="flex items-center gap-1 text-[10px] text-white/80 font-mono">
                  <Clock className="w-2.5 h-2.5 text-[var(--accent-brass)]" />
                  <span>{readingTime}</span>
                </div>
              )}
              {subjects.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {subjects.map((s) => (
                    <span
                      key={s}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-white/90 truncate max-w-[130px]"
                    >
                      {s.split('--')[0].trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Title & Author below cover */}
        <div
          className="p-2.5 cursor-pointer text-left"
          onClick={() => onOpenDetail(book)}
        >
          <h4
            className="font-heading font-semibold text-[13px] leading-snug line-clamp-2"
            style={{ color: 'var(--text-primary)' }}
            title={book.title}
          >
            {book.title}
          </h4>
          <p
            className="font-manuscript italic text-[11px] truncate mt-1"
            style={{ color: 'var(--text-muted)' }}
          >
            {authorName}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Netflix-Style Horizontal Row
// ---------------------------------------------------------------------------

export const NetflixRow: React.FC<{
  title: string;
  icon?: React.ReactNode;
  books: LibraryBook[];
  loading?: boolean;
  error?: string | null;
  onSeeAll?: () => void;
  onRead: (book: LibraryBook) => void;
  onToggleFavorite: (book: LibraryBook) => void;
  onOpenDetail: (book: LibraryBook) => void;
  favoriteIds: Set<number>;
  isTop10?: boolean;
  progressMap?: Map<number, number>;
  onRetry?: () => void;
}> = ({
  title,
  icon,
  books,
  loading = false,
  error = null,
  onSeeAll,
  onRead,
  onToggleFavorite,
  onOpenDetail,
  favoriteIds,
  isTop10 = false,
  progressMap,
  onRetry,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: -1 | 1) => {
    if (!rowRef.current) return;
    const clientWidth = rowRef.current.clientWidth;
    rowRef.current.scrollBy({ left: direction * (clientWidth * 0.75), behavior: 'smooth' });
  };

  if (error) {
    return (
      <section className="mb-8" aria-label={title}>
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h3 className="font-heading text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 border rounded-sm" style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-surface)' }}>
          <AlertCircle className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          <span className="font-manuscript text-sm text-[var(--text-muted)]">{error}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="ml-auto font-manuscript text-xs underline cursor-pointer text-[var(--accent-brass)]">
              Retry
            </button>
          )}
        </div>
      </section>
    );
  }

  if (!loading && books.length === 0) return null;

  return (
    <section className="mb-9 relative group/row" aria-label={title}>
      {/* Row Header */}
      <div className="flex items-baseline justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-heading text-lg sm:text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h3>
          {books.length > 0 && !loading && (
            <span className="font-mono text-xs text-[var(--text-muted)]">
              ({books.length})
            </span>
          )}
        </div>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="flex items-center gap-1 font-manuscript text-xs sm:text-sm text-[var(--accent-brass)] hover:underline cursor-pointer transition-colors"
          >
            <span>See all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Row Scroll Container with Nav Arrows */}
      <div className="relative">
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label={`Scroll ${title} left`}
          className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-30 w-8 sm:w-10 h-16 sm:h-20 bg-black/60 hover:bg-black/80 text-white rounded-r-sm flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity backdrop-blur-sm cursor-pointer shadow-xl"
        >
          <ChevronLeft className="w-5 sm:w-6 h-5 sm:h-6" />
        </button>

        {/* Horizontal Book Strip */}
        <div
          ref={rowRef}
          className="flex gap-4 overflow-x-auto scroll-smooth py-2 px-1 shelf-row-scroll"
          style={{ scrollSnapType: 'x mandatory' }}
          role="list"
        >
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 rounded-sm animate-pulse bg-[var(--bg-surface)] border border-[var(--border-hairline)]"
                style={{ width: '160px', height: '280px' }}
              />
            ))
          ) : (
            books.map((book, idx) => (
              <div key={book.id} role="listitem">
                <NetflixBookCard
                  book={book}
                  isFavorite={favoriteIds.has(book.id)}
                  onRead={onRead}
                  onToggleFavorite={onToggleFavorite}
                  onOpenDetail={onOpenDetail}
                  rank={isTop10 ? idx + 1 : undefined}
                  progressPercent={progressMap?.get(book.id)}
                />
              </div>
            ))
          )}
        </div>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label={`Scroll ${title} right`}
          className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-30 w-8 sm:w-10 h-16 sm:h-20 bg-black/60 hover:bg-black/80 text-white rounded-l-sm flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity backdrop-blur-sm cursor-pointer shadow-xl"
        >
          <ChevronRight className="w-5 sm:w-6 h-5 sm:h-6" />
        </button>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Netflix-Style Hero Banner Component
// ---------------------------------------------------------------------------

export const HeroBanner: React.FC<{
  books: LibraryBook[];
  onRead: (book: LibraryBook) => void;
  onToggleFavorite: (book: LibraryBook) => void;
  onOpenDetail: (book: LibraryBook) => void;
  favoriteIds: Set<number>;
}> = ({ books, onRead, onToggleFavorite, onOpenDetail, favoriteIds }) => {
  const featured = useMemo(() => books.slice(0, 5), [books]);
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (isHovered || featured.length <= 1) return;
    const t = setInterval(() => {
      setIndex((prev) => (prev + 1) % featured.length);
    }, 8000);
    return () => clearInterval(t);
  }, [isHovered, featured.length]);

  if (featured.length === 0) return null;
  const current = featured[index] || featured[0];
  const isFav = favoriteIds.has(current.id);
  const authorName = (current.authors && current.authors[0]) || 'Unknown Author';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full rounded-md overflow-hidden mb-8 border border-[var(--border-brass)] shadow-2xl"
      style={{
        background: 'var(--bg-surface)',
        minHeight: '340px',
      }}
    >
      {/* Blurred cover backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {current.coverUrl && (
          <img
            src={current.coverUrl}
            alt=""
            className="w-full h-full object-cover filter blur-3xl scale-150 opacity-25 dark:opacity-15"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, var(--bg-surface) 0%, color-mix(in srgb, var(--bg-surface) 92%, transparent) 55%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, var(--bg-surface) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 p-6 sm:p-10">
        <div className="flex-1 max-w-xl text-left">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest border border-[var(--border-brass)] text-[var(--accent-brass)]"
              style={{ background: 'var(--bg-canvas)' }}
            >
              <Sparkles className="w-3 h-3 text-[var(--accent-brass)]" /> Featured Classic
            </span>
            {current.downloadCount !== undefined && current.downloadCount > 0 && (
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {current.downloadCount.toLocaleString()} readers
              </span>
            )}
          </div>

          <h2
            className="font-display font-bold text-2xl sm:text-4xl lg:text-5xl leading-tight tracking-tight mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {current.title}
          </h2>

          <p
            className="font-manuscript italic text-base sm:text-lg mb-3"
            style={{ color: 'var(--text-secondary)' }}
          >
            by {authorName}
            {current.authorYears && current.authorYears[0] && (
              <span className="ml-2 not-italic text-xs font-mono text-[var(--text-muted)]">
                {authorEraLabel(current.authorYears)}
              </span>
            )}
          </p>

          {current.summary && (
            <p
              className="font-manuscript text-xs sm:text-sm line-clamp-3 leading-relaxed mb-4"
              style={{ color: 'var(--text-muted)' }}
            >
              {current.summary}
            </p>
          )}

          {current.subjects && current.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {current.subjects.slice(0, 4).map((s) => (
                <span
                  key={s}
                  className="font-manuscript text-[11px] px-2.5 py-0.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-muted)]"
                >
                  {s.split('--')[0].trim()}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onRead(current)}
              className="flex items-center gap-2 px-5 py-2.5 font-manuscript text-sm font-semibold rounded-sm cursor-pointer shadow-md transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'var(--accent-primary)',
                color: '#F4EFE5',
              }}
            >
              <BookOpen className="w-4 h-4" />
              <span>Start Reading</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleFavorite(current)}
              className="flex items-center gap-2 px-4 py-2.5 font-manuscript text-sm rounded-sm border border-[var(--border-brass)] cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)]"
              style={{
                background: 'var(--bg-canvas)',
                color: isFav ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              <span>{isFav ? 'In Favourites' : 'Add to Favourites'}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenDetail(current)}
              className="flex items-center gap-1.5 px-3 py-2.5 font-manuscript text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <Info className="w-4 h-4" />
              <span>Details</span>
            </button>
          </div>
        </div>

        {/* Hero Cover Card on Right */}
        <div className="w-40 sm:w-52 flex-shrink-0 drop-shadow-2xl">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="cursor-pointer"
            onClick={() => onOpenDetail(current)}
          >
            <BookCover book={current} className="shadow-2xl border border-[var(--border-brass)] rounded-sm" />
          </motion.div>
        </div>
      </div>

      {/* Hero Dots Navigation */}
      {featured.length > 1 && (
        <div className="absolute bottom-3 right-5 z-20 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
          {featured.map((b, idx) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setIndex(idx)}
              aria-label={`Jump to featured slide ${idx + 1}: ${b.title}`}
              className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                idx === index
                  ? 'w-5 bg-[var(--accent-primary)]'
                  : 'bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// CategoryChips — horizontal chip bar
// ---------------------------------------------------------------------------

const CategoryChips: React.FC<{
  selected: CategorySlug | null;
  onChange: (slug: CategorySlug | null) => void;
}> = ({ selected, onChange }) => {
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight') {
      const next = chipRefs.current[(idx + 1) % (CATEGORIES.length + 1)];
      next?.focus();
    } else if (e.key === 'ArrowLeft') {
      const prev = chipRefs.current[(idx - 1 + CATEGORIES.length + 1) % (CATEGORIES.length + 1)];
      prev?.focus();
    }
  };

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2 mb-6"
      role="toolbar"
      aria-label="Browse by category"
      style={{ scrollbarWidth: 'none' }}
    >
      {/* All chip */}
      <button
        type="button"
        ref={(el) => { chipRefs.current[0] = el; }}
        onClick={() => onChange(null)}
        onKeyDown={(e) => handleKeyDown(e, 0)}
        className="flex-shrink-0 font-manuscript text-xs px-3.5 py-1.5 rounded-full border cursor-pointer transition-all"
        style={{
          borderColor: selected === null ? 'var(--accent-primary)' : 'var(--border-brass)',
          background: selected === null ? 'var(--accent-primary)' : 'var(--bg-canvas)',
          color: selected === null ? '#F4EFE5' : 'var(--accent-brass)',
        }}
        aria-pressed={selected === null}
      >
        All
      </button>

      {CATEGORIES.map((cat, idx) => (
        <button
          type="button"
          key={cat.slug}
          ref={(el) => { chipRefs.current[idx + 1] = el; }}
          onClick={() => onChange(cat.slug)}
          onKeyDown={(e) => handleKeyDown(e, idx + 1)}
          className="flex-shrink-0 font-manuscript text-xs px-3.5 py-1.5 rounded-full border cursor-pointer transition-all whitespace-nowrap"
          style={{
            borderColor: selected === cat.slug ? 'var(--accent-primary)' : 'var(--border-brass)',
            background: selected === cat.slug ? 'var(--accent-primary)' : 'var(--bg-canvas)',
            color: selected === cat.slug ? '#F4EFE5' : 'var(--accent-brass)',
          }}
          aria-pressed={selected === cat.slug}
        >
          {cat.icon} {cat.label}
        </button>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// FilterDrawer — slide-out filter panel
// ---------------------------------------------------------------------------

interface Filters {
  language: string;
  fromYear: string;
  toYear: string;
  sort: 'popular' | 'ascending' | 'descending';
  coversOnly: boolean;
}

const LANGUAGE_OPTIONS = [
  { code: '', label: 'Any language' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'la', label: 'Latin' },
  { code: 'pt', label: 'Portuguese' },
];

const FilterDrawer: React.FC<{
  isOpen: boolean;
  filters: Filters;
  onClose: () => void;
  onApply: (f: Filters) => void;
}> = ({ isOpen, filters, onClose, onApply }) => {
  const [local, setLocal] = useState<Filters>(filters);

  useEffect(() => { setLocal(filters); }, [filters]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Filters">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full sm:max-w-xs h-full flex flex-col border-l shadow-2xl overflow-y-auto"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-brass)', color: 'var(--text-primary)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-canvas)' }}>
              <h3 className="font-heading text-lg font-semibold">Filter Books</h3>
              <button type="button" onClick={onClose} aria-label="Close filters" className="p-1.5 rounded cursor-pointer hover:bg-[var(--burgundy-wash)] transition-colors" style={{ color: 'var(--text-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 px-5 py-4 space-y-5">
              {/* Sort */}
              <fieldset>
                <legend className="font-heading text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Sort by</legend>
                <div className="space-y-1.5">
                  {([['popular', 'Most Popular'], ['ascending', 'Title A–Z'], ['descending', 'Title Z–A']] as const).map(([val, label]) => (
                    <label key={val} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="sort"
                        value={val}
                        checked={local.sort === val}
                        onChange={() => setLocal(f => ({ ...f, sort: val }))}
                        className="accent-[var(--accent-primary)]"
                      />
                      <span className="font-manuscript text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Language */}
              <div>
                <label htmlFor="filter-language" className="font-heading text-sm font-semibold block mb-2" style={{ color: 'var(--text-secondary)' }}>Language</label>
                <select
                  id="filter-language"
                  value={local.language}
                  onChange={(e) => setLocal(f => ({ ...f, language: e.target.value }))}
                  className="w-full font-manuscript text-sm px-3 py-2 border rounded-sm outline-none"
                  style={{ background: 'var(--bg-canvas)', borderColor: 'var(--border-hairline)', color: 'var(--text-primary)' }}
                >
                  {LANGUAGE_OPTIONS.map(opt => (
                    <option key={opt.code} value={opt.code}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Author Era */}
              <div>
                <p className="font-heading text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Author era (birth year)</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    placeholder="From"
                    value={local.fromYear}
                    onChange={(e) => setLocal(f => ({ ...f, fromYear: e.target.value }))}
                    min={500}
                    max={1930}
                    className="w-full font-manuscript text-sm px-3 py-2 border rounded-sm outline-none"
                    style={{ background: 'var(--bg-canvas)', borderColor: 'var(--border-hairline)', color: 'var(--text-primary)' }}
                  />
                  <span className="font-manuscript text-sm" style={{ color: 'var(--text-muted)' }}>–</span>
                  <input
                    type="number"
                    placeholder="To"
                    value={local.toYear}
                    onChange={(e) => setLocal(f => ({ ...f, toYear: e.target.value }))}
                    min={500}
                    max={1930}
                    className="w-full font-manuscript text-sm px-3 py-2 border rounded-sm outline-none"
                    style={{ background: 'var(--bg-canvas)', borderColor: 'var(--border-hairline)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Covers only */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={local.coversOnly}
                  onChange={(e) => setLocal(f => ({ ...f, coversOnly: e.target.checked }))}
                  className="accent-[var(--accent-primary)] w-4 h-4"
                />
                <span className="font-manuscript text-sm" style={{ color: 'var(--text-primary)' }}>Only books with covers</span>
              </label>
            </div>

            <div className="px-5 py-4 border-t flex gap-2 shrink-0" style={{ borderColor: 'var(--border-hairline)' }}>
              <button
                type="button"
                onClick={() => { const def: Filters = { language: '', fromYear: '', toYear: '', sort: 'popular', coversOnly: false }; setLocal(def); onApply(def); }}
                className="flex-1 font-manuscript text-sm py-2 border rounded-sm cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)]"
                style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => { onApply(local); onClose(); }}
                className="flex-1 font-manuscript text-sm py-2 rounded-sm cursor-pointer transition-colors"
                style={{ background: 'var(--accent-primary)', color: '#F4EFE5' }}
              >
                Apply
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

// ---------------------------------------------------------------------------
// Upgraded BookDetailDialog
// ---------------------------------------------------------------------------

const BookDetailDialog: React.FC<{
  book: LibraryBook;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (book: LibraryBook) => void;
  onRead: (book: LibraryBook) => void;
  onSearchSubject: (subject: string) => void;
  onSearchAuthor: (author: string) => void;
  onSelectBook?: (book: LibraryBook) => void;
}> = ({ book, isFavorite, onClose, onToggleFavorite, onRead, onSearchSubject, onSearchAuthor, onSelectBook }) => {
  const [imgErr, setImgErr] = useState(false);
  const [authorBooks, setAuthorBooks] = useState<LibraryBook[]>([]);
  const [loadingAuthor, setLoadingAuthor] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!book.authors[0]) return;
    setLoadingAuthor(true);
    setAuthorBooks([]);
    fetch(`/api/library/author?name=${encodeURIComponent(book.authors[0])}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: LibraryBook[]) => {
        setAuthorBooks(data.filter(b => b.id !== book.id).slice(0, 6));
        setLoadingAuthor(false);
      })
      .catch(() => setLoadingAuthor(false));
  }, [book.id, book.authors]);

  const eraLabel = authorEraLabel(book.authorYears);
  const readingTime = estimateReadingTime(book.downloadCount);

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
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-brass)' }}
      >
        {/* Cover + meta */}
        <div className="flex flex-col sm:flex-row gap-5 p-5 sm:p-6">
          <div
            className="flex-shrink-0 mx-auto sm:mx-0 rounded-sm overflow-hidden shadow-lg border border-[var(--border-brass)]"
            style={{ width: '130px', height: '185px', background: spineColor(book.id) }}
          >
            {book.coverUrl && !imgErr ? (
              <img src={book.coverUrl} alt={book.title} onError={() => setImgErr(true)} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                <BookText className="w-8 h-8 opacity-40 text-white mb-2" />
                <span className="font-heading text-xs text-white/80 line-clamp-3">{book.title}</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-xl sm:text-2xl font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {book.title}
            </h2>
            <p className="font-manuscript text-base italic mt-1" style={{ color: 'var(--text-secondary)' }}>
              {book.authors.join(', ')}
              {eraLabel && <span className="ml-2 not-italic text-sm" style={{ color: 'var(--text-muted)' }}>{eraLabel}</span>}
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap gap-3 mt-2.5">
              {book.language.length > 0 && (
                <span className="font-manuscript text-xs" style={{ color: 'var(--text-muted)' }}>
                  🌐 {book.language.join(', ').toUpperCase()}
                </span>
              )}
              {book.downloadCount != null && book.downloadCount > 0 && (
                <span className="font-manuscript text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Download className="w-3 h-3" /> {book.downloadCount.toLocaleString()} downloads
                </span>
              )}
              {readingTime && (
                <span className="font-manuscript text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Clock className="w-3 h-3" /> {readingTime} est.
                </span>
              )}
            </div>

            {/* Summary */}
            {book.summary && (
              <p className="font-manuscript text-sm mt-3 leading-relaxed line-clamp-4" style={{ color: 'var(--text-secondary)' }}>
                {book.summary}
              </p>
            )}

            {/* Subjects as clickable tags */}
            {book.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {book.subjects.slice(0, 8).map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => { onClose(); onSearchSubject(s); }}
                    className="font-manuscript text-[11px] px-2.5 py-0.5 rounded-full border cursor-pointer transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                    style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)', background: 'var(--bg-canvas)' }}
                    title={`Search: ${s}`}
                  >
                    <Tag className="w-2.5 h-2.5 inline-block mr-0.5 -mt-0.5" />
                    {s.length > 32 ? s.slice(0, 32) + '…' : s}
                  </button>
                ))}
              </div>
            )}

            <p className="font-manuscript text-xs italic mt-4" style={{ color: 'var(--accent-brass)' }}>
              ❦ Public-domain edition via Project Gutenberg
            </p>
          </div>
        </div>

        {/* More by this author */}
        {(loadingAuthor || authorBooks.length > 0) && (
          <div className="border-t px-5 sm:px-6 py-4" style={{ borderColor: 'var(--border-hairline)' }}>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-3.5 h-3.5" style={{ color: 'var(--accent-brass)' }} />
              <h3 className="font-heading text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                More by {book.authors[0]}
              </h3>
              <button
                type="button"
                onClick={() => { onClose(); onSearchAuthor(book.authors[0]); }}
                className="ml-auto font-manuscript text-xs underline cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                style={{ color: 'var(--accent-brass)' }}
              >
                See all →
              </button>
            </div>
            {loadingAuthor ? (
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-12 rounded-sm animate-pulse" style={{ height: '70px', background: 'var(--bg-canvas)' }} />
                ))}
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {authorBooks.map(b => (
                  <motion.button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      if (onSelectBook) {
                        onSelectBook(b);
                      } else {
                        onClose();
                        onSearchAuthor(b.title);
                      }
                    }}
                    whileHover={{ y: -3 }}
                    className="flex-shrink-0 rounded-sm overflow-hidden cursor-pointer border border-[var(--border-hairline)]"
                    style={{ width: '56px', height: '80px', background: spineColor(b.id) }}
                    title={b.title}
                  >
                    {b.coverUrl ? (
                      <img src={b.coverUrl} alt={b.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                        <span className="font-heading text-[9px] text-white/80 text-center px-1 leading-tight">
                          {b.title.slice(0, 20)}
                        </span>
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div
          className="flex flex-col sm:flex-row gap-2.5 px-5 sm:px-6 pb-5 sm:pb-6 border-t pt-4"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <button
            type="button"
            onClick={() => onRead(book)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-5 font-manuscript text-sm border cursor-pointer transition-colors shadow-sm hover:opacity-95"
            style={{ background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: '#F4EFE5' }}
          >
            <BookOpen className="w-4 h-4" />
            Read this volume
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(book)}
            className="flex items-center justify-center gap-2 py-2.5 px-5 font-manuscript text-sm border cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)]"
            style={{ background: 'var(--bg-canvas)', borderColor: 'var(--border-brass)', color: isFavorite ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
          >
            {isFavorite ? <><HeartOff className="w-4 h-4" /> Unfavorite</> : <><Heart className="w-4 h-4" /> Add to Favourites</>}
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
// CategoryView — single-category paginated grid
// ---------------------------------------------------------------------------

const CategoryView: React.FC<{
  category: CategorySlug;
  filters: Filters;
  favoriteIds: Set<number>;
  onBookClick: (book: LibraryBook) => void;
}> = ({ category, filters, favoriteIds, onBookClick }) => {
  const [page, setPage] = useState(1);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const catInfo = CATEGORIES.find(c => c.slug === category)!;

  useEffect(() => {
    setLoading(true);
    setError(null);
    getCategoryBooks(category, page, filters.sort, filters.language, filters.fromYear, filters.toYear, filters.coversOnly)
      .then(({ books: b, total: t }) => { setBooks(b); setTotal(t); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [category, page, filters]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{catInfo.icon}</span>
        <h2 className="font-heading text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{catInfo.label}</h2>
        {total > 0 && <span className="font-manuscript text-sm" style={{ color: 'var(--text-muted)' }}>({total.toLocaleString()} volumes)</span>}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 border rounded-sm mb-4" style={{ borderColor: 'var(--accent-primary)', background: 'var(--burgundy-wash)', color: 'var(--accent-primary)' }} role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-manuscript text-sm">{error}</span>
          <button type="button" onClick={() => { setError(null); setLoading(true); setPage(p => p); }} className="ml-auto font-manuscript text-xs underline cursor-pointer">Retry</button>
        </div>
      )}

      <div className="flex flex-wrap gap-4" role="list" aria-label={`${catInfo.label} books`}>
        {loading
          ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} role="presentation" className="rounded-sm animate-pulse" style={{ width: '120px', height: '200px', background: 'var(--bg-surface)' }} />
            ))
          : books.map(book => (
              <div key={book.id} role="listitem">
                <CoverCard book={book} isFavorite={favoriteIds.has(book.id)} onClick={() => onBookClick(book)} />
              </div>
            ))
        }
      </div>

      {/* Pagination */}
      {total > 32 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-hairline)' }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="flex items-center gap-1.5 font-manuscript text-sm py-2 px-4 border rounded-sm cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)] disabled:opacity-40 disabled:cursor-default"
            style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="font-manuscript text-xs" style={{ color: 'var(--text-muted)' }}>
            Page {page} of {Math.ceil(total / 32)}
          </span>
          <button
            type="button"
            disabled={page >= Math.ceil(total / 32)}
            onClick={() => setPage(p => p + 1)}
            className="flex items-center gap-1.5 font-manuscript text-sm py-2 px-4 border rounded-sm cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)] disabled:opacity-40 disabled:cursor-default"
            style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Page Export
// ---------------------------------------------------------------------------

export const ReadingRoomPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const debouncedQuery = useDebounce(query, 480);
  const [results, setResults] = useState<LibraryBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [readerBook, setReaderBook] = useState<LibraryBook | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Category & filter state from URL
  const selectedCategory = (searchParams.get('category') as CategorySlug | null) || null;
  const [filters, setFilters] = useState<Filters>({
    language:   searchParams.get('language')   ?? '',
    fromYear:   searchParams.get('from_year')  ?? '',
    toYear:     searchParams.get('to_year')    ?? '',
    sort:       (searchParams.get('sort') as Filters['sort']) ?? 'popular',
    coversOnly: searchParams.get('covers_only') === 'true',
  });
  const [filterOpen, setFilterOpen] = useState(false);

  // Sync filters from URL when searchParams change
  useEffect(() => {
    setFilters({
      language:   searchParams.get('language')   ?? '',
      fromYear:   searchParams.get('from_year')  ?? '',
      toYear:     searchParams.get('to_year')    ?? '',
      sort:       (searchParams.get('sort') as Filters['sort']) ?? 'popular',
      coversOnly: searchParams.get('covers_only') === 'true',
    });
  }, [searchParams]);

  // Sync debounced search query to URL parameter
  useEffect(() => {
    const qParam = searchParams.get('q') ?? '';
    const trimmed = debouncedQuery.trim();
    if (trimmed !== qParam) {
      const next = new URLSearchParams(searchParams);
      if (trimmed) {
        next.set('q', trimmed);
        next.delete('category'); // clear category when searching
      } else {
        next.delete('q');
      }
      setSearchParams(next, { replace: true });
    }
  }, [debouncedQuery]);

  // Curated shelf state
  const [popularBooks, setPopularBooks] = useState<LibraryBook[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [popularError, setPopularError] = useState<string | null>(null);

  const [continueBooks, setContinueBooks] = useState<LibraryBook[]>([]);
  const [continueLoading, setContinueLoading] = useState(true);

  const [recommendedBooks, setRecommendedBooks] = useState<LibraryBook[]>([]);
  const [recommendedSubject, setRecommendedSubject] = useState<string>('');
  const [recommendedLoading, setRecommendedLoading] = useState(false);

  const [surpriseLoading, setSurpriseLoading] = useState(false);

  // Category shelves state
  const [horrorBooks, setHorrorBooks] = useState<LibraryBook[]>([]);
  const [scienceBooks, setScienceBooks] = useState<LibraryBook[]>([]);
  const [mysteryBooks, setMysteryBooks] = useState<LibraryBook[]>([]);
  const [adventureBooks, setAdventureBooks] = useState<LibraryBook[]>([]);
  const [romanceBooks, setRomanceBooks] = useState<LibraryBook[]>([]);
  const [fantasyBooks, setFantasyBooks] = useState<LibraryBook[]>([]);
  const [historyBooks, setHistoryBooks] = useState<LibraryBook[]>([]);
  const [nonfictionBooks, setNonfictionBooks] = useState<LibraryBook[]>([]);
  const [categoryShelvesLoading, setCategoryShelvesLoading] = useState(true);

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

  // Live reading progress from Dexie
  const progressList = useLiveQuery(
    () => readingRoomDb.readingProgress.orderBy('updatedAt').reverse().limit(12).toArray(),
    [],
    []
  );

  const progressMap = useMemo(() => {
    const map = new Map<number, number>();
    (progressList || []).forEach((p) => {
      const percent = Math.min(100, Math.max(10, Math.round((p.chapterIndex + 1) * 12)));
      map.set(p.bookId, percent);
    });
    return map;
  }, [progressList]);

  // Load Continue Reading books
  useEffect(() => {
    if (!progressList || progressList.length === 0) {
      setContinueBooks([]);
      setContinueLoading(false);
      return;
    }
    setContinueLoading(true);
    Promise.all(
      progressList.map(async (rp) => {
        try {
          const r = await fetch(`/api/library/book/${rp.bookId}`);
          if (!r.ok) return null;
          return (await r.json()) as LibraryBook;
        } catch {
          return null;
        }
      })
    ).then((books) => {
      setContinueBooks(books.filter((b): b is LibraryBook => b !== null));
      setContinueLoading(false);
    });
  }, [progressList]);

  // Fetch Popular Classics with IndexedDB cache
  const fetchPopular = useCallback(async () => {
    setPopularLoading(true);
    setPopularError(null);
    const cacheId = 'popular-classics-p1';
    try {
      const cached = await readingRoomDb.cachedCategoryResults.get(cacheId);
      if (cached && Date.now() - cached.updatedAt < CATEGORY_TTL_MS) {
        setPopularBooks(cached.data as LibraryBook[]);
        setPopularLoading(false);
        return;
      }
    } catch { /* ignore */ }

    fetch('/api/library/popular?page=1')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ books: LibraryBook[] }>;
      })
      .then(async (data) => {
        const b = data.books || [];
        setPopularBooks(b);
        setPopularLoading(false);
        try {
          await readingRoomDb.cachedCategoryResults.put({
            id: cacheId,
            data: b,
            total: b.length,
            updatedAt: Date.now(),
          });
        } catch { /* ignore */ }
      })
      .catch((e: Error) => {
        setPopularError(e.message);
        setPopularLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchPopular();
  }, [fetchPopular]);

  // Fetch Category Shelves
  useEffect(() => {
    setCategoryShelvesLoading(true);
    Promise.all([
      getCategoryBooks('horror-gothic', 1, 'popular', '', '', '', true).catch(() => ({ books: [] })),
      getCategoryBooks('science-nature', 1, 'popular', '', '', '', true).catch(() => ({ books: [] })),
      getCategoryBooks('mystery-crime', 1, 'popular', '', '', '', true).catch(() => ({ books: [] })),
      getCategoryBooks('adventure', 1, 'popular', '', '', '', true).catch(() => ({ books: [] })),
      getCategoryBooks('romance', 1, 'popular', '', '', '', true).catch(() => ({ books: [] })),
      getCategoryBooks('fantasy-myth', 1, 'popular', '', '', '', true).catch(() => ({ books: [] })),
      getCategoryBooks('history', 1, 'popular', '', '', '', true).catch(() => ({ books: [] })),
      getCategoryBooks('documentary-nonfiction', 1, 'popular', '', '', '', true).catch(() => ({ books: [] })),
    ]).then(([horror, science, mystery, adventure, romance, fantasy, history, nonfiction]) => {
      setHorrorBooks(horror.books);
      setScienceBooks(science.books);
      setMysteryBooks(mystery.books);
      setAdventureBooks(adventure.books);
      setRomanceBooks(romance.books);
      setFantasyBooks(fantasy.books);
      setHistoryBooks(history.books);
      setNonfictionBooks(nonfiction.books);
      setCategoryShelvesLoading(false);
    });
  }, []);

  // "Because You Favorited" recommendation shelf
  useEffect(() => {
    if (!favorites || favorites.length === 0) {
      setRecommendedBooks([]);
      setRecommendedSubject('');
      return;
    }
    const subjectCounts = new Map<string, number>();
    for (const fav of favorites) {
      for (const subj of fav.subjects || []) {
        const clean = subj.split('--')[0].trim();
        if (clean.length > 3) {
          subjectCounts.set(clean, (subjectCounts.get(clean) || 0) + 1);
        }
      }
    }
    let topSubject = '';
    let maxCount = 0;
    subjectCounts.forEach((count, subj) => {
      if (count > maxCount) {
        maxCount = count;
        topSubject = subj;
      }
    });

    if (topSubject) {
      setRecommendedSubject(topSubject);
      setRecommendedLoading(true);
      fetch(`/api/library/search?q=${encodeURIComponent(topSubject)}`)
        .then((r) => r.ok ? r.json() : [])
        .then((data: LibraryBook[]) => {
          const filtered = data.filter((b) => !favoriteIds.has(b.id));
          setRecommendedBooks(filtered.slice(0, 16));
          setRecommendedLoading(false);
        })
        .catch(() => setRecommendedLoading(false));
    }
  }, [favorites, favoriteIds]);

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

  // Live search suggestions pool
  const suggestions = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    const pool = [
      ...popularBooks,
      ...horrorBooks,
      ...adventureBooks,
      ...scienceBooks,
      ...(favorites || []),
    ];
    const seen = new Set<number>();
    const matches: LibraryBook[] = [];
    for (const b of pool) {
      if (seen.has(b.id)) continue;
      if (b.title.toLowerCase().includes(q) || b.authors.some((a) => a.toLowerCase().includes(q))) {
        seen.add(b.id);
        matches.push(b);
        if (matches.length >= 5) break;
      }
    }
    return matches;
  }, [query, popularBooks, horrorBooks, adventureBooks, scienceBooks, favorites]);

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

  const handleCategoryChange = (slug: CategorySlug | null) => {
    const next = new URLSearchParams(searchParams);
    if (slug) {
      next.set('category', slug);
    } else {
      next.delete('category');
    }
    next.delete('q');
    setQuery('');
    setSearchParams(next);
  };

  const handleApplyFilters = (newFilters: Filters) => {
    setFilters(newFilters);
    const next = new URLSearchParams(searchParams);
    if (newFilters.language) next.set('language', newFilters.language); else next.delete('language');
    if (newFilters.fromYear) next.set('from_year', newFilters.fromYear); else next.delete('from_year');
    if (newFilters.toYear) next.set('to_year', newFilters.toYear); else next.delete('to_year');
    if (newFilters.sort !== 'popular') next.set('sort', newFilters.sort); else next.delete('sort');
    if (newFilters.coversOnly) next.set('covers_only', 'true'); else next.delete('covers_only');
    setSearchParams(next);
  };

  const removeFilter = (key: keyof Filters) => {
    const updated: Filters = {
      ...filters,
      [key]: key === 'sort' ? 'popular' : key === 'coversOnly' ? false : '',
    };
    handleApplyFilters(updated);
  };

  const handleSearchSubject = (subject: string) => {
    setQuery(subject);
    setSelectedBook(null);
    const next = new URLSearchParams(searchParams);
    next.set('q', subject);
    next.delete('category');
    setSearchParams(next);
  };

  const handleSearchAuthor = (author: string) => {
    setQuery(author);
    setSelectedBook(null);
    const next = new URLSearchParams(searchParams);
    next.set('q', author);
    next.delete('category');
    setSearchParams(next);
  };

  const handleSurpriseMe = async () => {
    setSurpriseLoading(true);
    try {
      const r = await fetch('/api/library/random');
      if (!r.ok) throw new Error('Could not pick random volume');
      const book = (await r.json()) as LibraryBook;
      setSelectedBook(book);
    } catch (e) {
      console.error(e);
    } finally {
      setSurpriseLoading(false);
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.language) count++;
    if (filters.fromYear || filters.toYear) count++;
    if (filters.sort !== 'popular') count++;
    if (filters.coversOnly) count++;
    return count;
  }, [filters]);

  return (
    <>
      {/* Reader View Overlay */}
      <AnimatePresence>
        {readerBook && (
          <motion.div
            key="reader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transitionEnd: { transform: 'none' } }}
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
            onSearchSubject={handleSearchSubject}
            onSearchAuthor={handleSearchAuthor}
            onSelectBook={(b) => setSelectedBook(b)}
          />
        )}
      </AnimatePresence>

      {/* Filter Drawer */}
      <FilterDrawer
        isOpen={filterOpen}
        filters={filters}
        onClose={() => setFilterOpen(false)}
        onApply={handleApplyFilters}
      />

      {/* Sticky Top Bar (Netflix/Amazon style) */}
      <div className="sticky top-0 z-40 bg-[var(--bg-canvas)]/95 backdrop-blur-md border-b border-[var(--border-hairline)] shadow-sm px-4 sm:px-8 lg:px-12 py-3 transition-all">
        <div className="max-w-[1260px] mx-auto flex items-center justify-between gap-3 sm:gap-6">
          {/* Logo & Folio Title */}
          <div
            className="flex items-center gap-2.5 cursor-pointer shrink-0 select-none"
            onClick={() => {
              handleCategoryChange(null);
              setQuery('');
            }}
          >
            <BookMarked
              className="w-6 h-6"
              style={{ color: 'var(--accent-brass)' }}
              strokeWidth={1.5}
            />
            <span className="font-heading font-semibold text-lg sm:text-xl tracking-tight hidden sm:inline" style={{ color: 'var(--text-primary)' }}>
              The Reading Room
            </span>
          </div>

          {/* Live Search Input with Suggestions Dropdown */}
          <div className="relative flex-1 max-w-xl">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            {searching ? (
              <Loader2
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin"
                style={{ color: 'var(--accent-brass)' }}
              />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setShowSuggestions(false);
                  const next = new URLSearchParams(searchParams);
                  next.delete('q');
                  setSearchParams(next);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded cursor-pointer hover:bg-[var(--burgundy-wash)]"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
            <input
              id="reading-room-search"
              ref={searchInputRef}
              type="search"
              value={query}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShowSuggestions(false);
                }
              }}
              placeholder="Search classics, authors, topics — e.g. Austen, Shelley, Gothic…"
              className="w-full pl-9 sm:pl-10 pr-9 sm:pr-10 py-2 sm:py-2.5 font-manuscript text-xs sm:text-sm border rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] shadow-inner transition-all"
              style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border-brass)',
                color: 'var(--text-primary)',
              }}
              autoComplete="off"
              spellCheck={false}
            />

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-2 rounded-md shadow-2xl border border-[var(--border-brass)] bg-[var(--bg-surface)] overflow-hidden z-50 divide-y divide-[var(--border-hairline)]"
              >
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setShowSuggestions(false);
                      setSelectedBook(s);
                    }}
                    className="flex items-center gap-3 p-2.5 hover:bg-[var(--burgundy-wash)] cursor-pointer transition-colors"
                  >
                    <div className="w-8 aspect-[2/3] shrink-0 rounded-[1px] overflow-hidden">
                      <BookCover book={s} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-heading font-semibold text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                        {s.title}
                      </p>
                      <p className="font-manuscript text-[11px] italic truncate" style={{ color: 'var(--text-muted)' }}>
                        {s.authors[0] ?? 'Unknown Author'}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--accent-brass)] shrink-0" />
                  </div>
                ))}
                <div
                  onClick={() => setShowSuggestions(false)}
                  className="p-2 text-center text-xs font-manuscript italic text-[var(--accent-brass)] hover:underline cursor-pointer bg-[var(--bg-canvas)]"
                >
                  Press Enter to view all results for "{query}"
                </div>
              </div>
            )}
          </div>

          {/* Action buttons: Surprise Me & Filters */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSurpriseMe}
              disabled={surpriseLoading}
              title="Random classic volume"
              className="flex items-center gap-1.5 px-3 py-2 font-manuscript text-xs sm:text-sm border rounded-full cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)] shadow-sm"
              style={{
                borderColor: 'var(--border-brass)',
                background: 'var(--bg-surface)',
                color: 'var(--accent-brass)',
              }}
            >
              {surpriseLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Shuffle className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">Surprise Me</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 font-manuscript text-xs sm:text-sm border rounded-full cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)] shadow-sm"
              style={{
                borderColor: activeFilterCount > 0 ? 'var(--accent-primary)' : 'var(--border-hairline)',
                background: activeFilterCount > 0 ? 'var(--burgundy-wash)' : 'var(--bg-surface)',
                color: activeFilterCount > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span
                  className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                  style={{ background: 'var(--accent-primary)' }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Browse Container */}
      <div
        className="max-w-[1260px] mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-8"
        style={{ color: 'var(--text-primary)' }}
      >
        {/* Active Filter Pills (if any) */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-5">
            <span className="font-manuscript text-xs" style={{ color: 'var(--text-muted)' }}>Active filters:</span>
            {filters.language && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-manuscript" style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-surface)' }}>
                Lang: {filters.language.toUpperCase()}
                <button type="button" onClick={() => removeFilter('language')} className="hover:opacity-75 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
            {(filters.fromYear || filters.toYear) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-manuscript" style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-surface)' }}>
                Era: {filters.fromYear || '…'}–{filters.toYear || '…'}
                <button type="button" onClick={() => { removeFilter('fromYear'); removeFilter('toYear'); }} className="hover:opacity-75 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filters.sort !== 'popular' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-manuscript" style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-surface)' }}>
                Sort: {filters.sort === 'ascending' ? 'A–Z' : 'Z–A'}
                <button type="button" onClick={() => removeFilter('sort')} className="hover:opacity-75 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filters.coversOnly && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-manuscript" style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-surface)' }}>
                With covers only
                <button type="button" onClick={() => removeFilter('coversOnly')} className="hover:opacity-75 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
            <button
              type="button"
              onClick={() => handleApplyFilters({ language: '', fromYear: '', toYear: '', sort: 'popular', coversOnly: false })}
              className="font-manuscript text-xs underline cursor-pointer hover:text-[var(--text-primary)] transition-colors ml-2"
              style={{ color: 'var(--accent-brass)' }}
            >
              Clear all
            </button>
          </div>
        )}

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

        {/* MAIN DISPLAY CONTENT */}
        {debouncedQuery.trim() ? (
          /* View A: Search Results Grid */
          <section aria-labelledby="results-heading">
            <div className="flex items-center gap-2 mb-4">
              <Library className="w-4 h-4" style={{ color: 'var(--accent-brass)' }} />
              <h2 id="results-heading" className="font-heading text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                Search Results
              </h2>
              <span className="font-manuscript text-xs" style={{ color: 'var(--text-muted)' }}>
                ({results.length} volumes found)
              </span>
            </div>
            {searching ? (
              <div className="flex flex-wrap gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="w-[130px] aspect-[2/3] rounded-sm animate-pulse" style={{ background: 'var(--bg-surface)' }} />
                ))}
              </div>
            ) : results.length > 0 ? (
              <div className="flex flex-wrap gap-4" role="list" aria-label="Search results">
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
            ) : (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <BookOpen className="w-10 h-10 text-[var(--text-muted)]" strokeWidth={1.2} />
                <p className="font-manuscript italic text-[var(--text-secondary)]">
                  No volumes matched "{debouncedQuery}" in the Gutenberg archive.
                </p>
                <p className="font-manuscript text-xs text-[var(--text-muted)]">
                  Try a different title, author, or subject keyword.
                </p>
              </div>
            )}
          </section>
        ) : selectedCategory ? (
          /* View B: Selected Category Paginated Grid */
          <CategoryView
            category={selectedCategory}
            filters={filters}
            favoriteIds={favoriteIds}
            onBookClick={(book) => setSelectedBook(book)}
          />
        ) : (
          /* View C: Netflix-Style Full Library Browse */
          <div>
            {/* 1. Hero Banner (Netflix style) */}
            <HeroBanner
              books={popularBooks}
              onRead={openReader}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={(b) => setSelectedBook(b)}
              favoriteIds={favoriteIds}
            />

            {/* 2. Category Chips Bar directly under Hero */}
            <div className="mb-8">
              <CategoryChips selected={selectedCategory} onChange={handleCategoryChange} />
            </div>

            {/* 3. Continue Reading Shelf (hidden if empty) */}
            {continueBooks.length > 0 && (
              <NetflixRow
                title="Continue Reading"
                icon={<BookOpen className="w-4 h-4 text-[var(--accent-brass)]" />}
                books={continueBooks}
                loading={continueLoading}
                favoriteIds={favoriteIds}
                progressMap={progressMap}
                onRead={openReader}
                onToggleFavorite={toggleFavorite}
                onOpenDetail={(b) => setSelectedBook(b)}
              />
            )}

            {/* 4. Your Favourites Shelf (hidden if empty) */}
            {favorites && favorites.length > 0 && (
              <NetflixRow
                title="Your Favourites"
                icon={<Heart className="w-4 h-4 fill-current text-[var(--accent-primary)]" />}
                books={favorites}
                loading={false}
                favoriteIds={favoriteIds}
                onRead={openReader}
                onToggleFavorite={toggleFavorite}
                onOpenDetail={(b) => setSelectedBook(b)}
              />
            )}

            {/* 5. Top 10 Today (with large rank numerals behind covers) */}
            <NetflixRow
              title="Top 10 Today"
              icon={<Flame className="w-4 h-4 text-[var(--accent-primary)]" />}
              books={popularBooks.slice(0, 10)}
              loading={popularLoading}
              error={popularError}
              favoriteIds={favoriteIds}
              isTop10={true}
              onRead={openReader}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={(b) => setSelectedBook(b)}
              onRetry={fetchPopular}
            />

            {/* 6. Popular Classics */}
            <NetflixRow
              title="Popular Classics"
              icon={<Star className="w-4 h-4 fill-current text-[var(--accent-brass)]" />}
              books={popularBooks.slice(10, 32)}
              loading={popularLoading}
              error={popularError}
              favoriteIds={favoriteIds}
              onSeeAll={() => handleCategoryChange('popular' as any)}
              onRead={openReader}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={(b) => setSelectedBook(b)}
              onRetry={fetchPopular}
            />

            {/* 7. Horror & Gothic */}
            <NetflixRow
              title="Horror & Gothic"
              icon={<span className="text-base">🕯️</span>}
              books={horrorBooks}
              loading={categoryShelvesLoading}
              favoriteIds={favoriteIds}
              onSeeAll={() => handleCategoryChange('horror-gothic')}
              onRead={openReader}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={(b) => setSelectedBook(b)}
            />

            {/* 8. Science & Nature */}
            <NetflixRow
              title="Science & Nature"
              icon={<span className="text-base">🔬</span>}
              books={scienceBooks}
              loading={categoryShelvesLoading}
              favoriteIds={favoriteIds}
              onSeeAll={() => handleCategoryChange('science-nature')}
              onRead={openReader}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={(b) => setSelectedBook(b)}
            />

            {/* 9. Mystery & Crime */}
            <NetflixRow
              title="Mystery & Crime"
              icon={<span className="text-base">🔍</span>}
              books={mysteryBooks}
              loading={categoryShelvesLoading}
              favoriteIds={favoriteIds}
              onSeeAll={() => handleCategoryChange('mystery-crime')}
              onRead={openReader}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={(b) => setSelectedBook(b)}
            />

            {/* 10. Adventure */}
            <NetflixRow
              title="Adventure & Sea Stories"
              icon={<span className="text-base">⚓</span>}
              books={adventureBooks}
              loading={categoryShelvesLoading}
              favoriteIds={favoriteIds}
              onSeeAll={() => handleCategoryChange('adventure')}
              onRead={openReader}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={(b) => setSelectedBook(b)}
            />

            {/* 11. Romance */}
            <NetflixRow
              title="Romance & Love Stories"
              icon={<span className="text-base">🌹</span>}
              books={romanceBooks}
              loading={categoryShelvesLoading}
              favoriteIds={favoriteIds}
              onSeeAll={() => handleCategoryChange('romance')}
              onRead={openReader}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={(b) => setSelectedBook(b)}
            />

            {/* 12. Fantasy & Myth */}
            <NetflixRow
              title="Fantasy & Myth"
              icon={<span className="text-base">🐉</span>}
              books={fantasyBooks}
              loading={categoryShelvesLoading}
              favoriteIds={favoriteIds}
              onSeeAll={() => handleCategoryChange('fantasy-myth')}
              onRead={openReader}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={(b) => setSelectedBook(b)}
            />

            {/* 13. History */}
            <NetflixRow
              title="History & Chronicles"
              icon={<span className="text-base">📜</span>}
              books={historyBooks}
              loading={categoryShelvesLoading}
              favoriteIds={favoriteIds}
              onSeeAll={() => handleCategoryChange('history')}
              onRead={openReader}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={(b) => setSelectedBook(b)}
            />

            {/* 14. Documentary & Nonfiction */}
            <NetflixRow
              title="Documentary & Nonfiction"
              icon={<span className="text-base">📰</span>}
              books={nonfictionBooks}
              loading={categoryShelvesLoading}
              favoriteIds={favoriteIds}
              onSeeAll={() => handleCategoryChange('documentary-nonfiction')}
              onRead={openReader}
              onToggleFavorite={toggleFavorite}
              onOpenDetail={(b) => setSelectedBook(b)}
            />

            {/* 15. Because You Favorited... */}
            {recommendedBooks.length > 0 && (
              <NetflixRow
                title={`Because You Favorited “${recommendedSubject}”`}
                icon={<Sparkles className="w-4 h-4 text-[var(--accent-brass)]" />}
                books={recommendedBooks}
                loading={recommendedLoading}
                favoriteIds={favoriteIds}
                onRead={openReader}
                onToggleFavorite={toggleFavorite}
                onOpenDetail={(b) => setSelectedBook(b)}
              />
            )}

            {/* Editorial Footer / Colophon */}
            <footer className="mt-14 pt-8 pb-8 border-t text-center" style={{ borderColor: 'var(--border-hairline)' }}>
              <p className="font-manuscript text-xs italic" style={{ color: 'var(--accent-brass)' }}>
                ❦ The Inkwell Atelier Reading Room · Public-Domain Volumes Only
              </p>
              <p className="font-manuscript text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                All works sourced directly from the Project Gutenberg archive. Free to read, annotate, and preserve.
              </p>
            </footer>
          </div>
        )}
      </div>
    </>
  );
};
