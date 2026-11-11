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
      className="relative flex flex-col cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 text-left group book-cover-tilt"
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
  { slug: 'childrens-classics',  label: "Children's Classics",    icon: '🧸' },
  { slug: 'humor-satire',        label: 'Humor & Satire',         icon: '😄' },
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
// BookShelfRow — horizontal scrollable shelf
// ---------------------------------------------------------------------------

const BookShelfRow: React.FC<{
  title: string;
  icon?: React.ReactNode;
  books: LibraryBook[];
  loading: boolean;
  error?: string | null;
  favoriteIds: Set<number>;
  onBookClick: (book: LibraryBook) => void;
  onRetry?: () => void;
}> = ({ title, icon, books, loading, error, favoriteIds, onBookClick, onRetry }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: -1 | 1) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  if (error) {
    return (
      <section className="mb-8" aria-labelledby={`shelf-${title}`}>
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h2 id={`shelf-${title}`} className="font-heading text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 border rounded-sm" style={{ borderColor: 'var(--border-hairline)', background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
          <AlertCircle className="w-4 h-4 shrink-0 text-[var(--accent-primary)]" />
          <span className="font-manuscript text-sm">{error}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="ml-auto font-manuscript text-xs underline cursor-pointer hover:text-[var(--text-primary)] transition-colors" style={{ color: 'var(--accent-brass)' }}>
              Retry
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8" aria-labelledby={`shelf-${title}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 id={`shelf-${title}`} className="font-heading text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            onClick={() => scrollBy(-1)}
            className="p-1.5 rounded-sm border cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)]"
            style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            onClick={() => scrollBy(1)}
            className="p-1.5 rounded-sm border cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)]"
            style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="relative rounded-sm pb-5 pt-4 px-4"
        style={{
          background: 'color-mix(in srgb, var(--bg-surface) 70%, transparent)',
          borderBottom: '4px solid var(--border-brass)',
          boxShadow: 'inset 0 -4px 12px rgba(0,0,0,0.12)',
        }}
      >
        <div
          ref={scrollRef}
          className="flex gap-3 items-end overflow-x-auto shelf-row-scroll"
          role="list"
          aria-label={`${title} books`}
          style={{ scrollbarWidth: 'none' }}
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  role="presentation"
                  className="flex-shrink-0 w-14 sm:w-16 rounded-sm animate-pulse"
                  style={{
                    height: '180px',
                    background: 'var(--bg-canvas)',
                    opacity: 0.5 + (i * 0.06),
                  }}
                />
              ))
            : books.length === 0
            ? (
                <div className="flex-1 py-10 text-center font-manuscript text-sm italic" style={{ color: 'var(--text-muted)' }}>
                  No volumes on this shelf. Try another subject.
                </div>
              )
            : books.map((book, i) => (
                <motion.div
                  key={book.id}
                  role="listitem"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.25 }}
                >
                  <SpineCard
                    book={book}
                    isFavorite={favoriteIds.has(book.id)}
                    onClick={() => onBookClick(book)}
                  />
                </motion.div>
              ))
          }
        </div>
      </div>
    </section>
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

  // Previews for 4 core categories
  const [previewHorror, setPreviewHorror] = useState<LibraryBook[]>([]);
  const [previewSciFi, setPreviewSciFi] = useState<LibraryBook[]>([]);
  const [previewMystery, setPreviewMystery] = useState<LibraryBook[]>([]);
  const [previewAdventure, setPreviewAdventure] = useState<LibraryBook[]>([]);
  const [previewsLoading, setPreviewsLoading] = useState(true);

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

  // Fetch Popular Classics
  const fetchPopular = useCallback(() => {
    setPopularLoading(true);
    setPopularError(null);
    fetch('/api/library/popular?page=1')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ books: LibraryBook[] }>;
      })
      .then((data) => {
        setPopularBooks(data.books || []);
        setPopularLoading(false);
      })
      .catch((e: Error) => {
        setPopularError(e.message);
        setPopularLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchPopular();
  }, [fetchPopular]);

  // Fetch Category Previews
  useEffect(() => {
    setPreviewsLoading(true);
    Promise.all([
      getCategoryBooks('horror-gothic', 1, 'popular', '', '', '', true).catch(() => ({ books: [] })),
      getCategoryBooks('science-fiction', 1, 'popular', '', '', '', true).catch(() => ({ books: [] })),
      getCategoryBooks('mystery-crime', 1, 'popular', '', '', '', true).catch(() => ({ books: [] })),
      getCategoryBooks('adventure', 1, 'popular', '', '', '', true).catch(() => ({ books: [] })),
    ]).then(([horror, scifi, mystery, adventure]) => {
      setPreviewHorror(horror.books);
      setPreviewSciFi(scifi.books);
      setPreviewMystery(mystery.books);
      setPreviewAdventure(adventure.books);
      setPreviewsLoading(false);
    });
  }, []);

  // "Because You Favorited" recommendation shelf
  useEffect(() => {
    if (!favorites || favorites.length === 0) {
      setRecommendedBooks([]);
      setRecommendedSubject('');
      return;
    }
    // Find top subject among favorites
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

      {/* Main Browse Container */}
      <div
        className="max-w-[1260px] mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-10"
        style={{ color: 'var(--text-primary)' }}
      >
        {/* Editorial Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <BookMarked
              className="w-7 h-7 mt-0.5 flex-shrink-0"
              style={{ color: 'var(--accent-brass)' }}
              strokeWidth={1.4}
            />
            <div>
              <h1 className="font-heading text-2xl sm:text-4xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                The Reading Room
              </h1>
              <p className="font-manuscript italic text-sm sm:text-base mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Illustrated volumes & complete public-domain archives
              </p>
            </div>
          </div>

          {/* Action buttons: Surprise Me & Filters */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleSurpriseMe}
              disabled={surpriseLoading}
              aria-label="Surprise me with a random book"
              className="flex items-center gap-2 px-3.5 py-2 font-manuscript text-xs sm:text-sm border rounded-sm cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)] shadow-sm disabled:opacity-50"
              style={{
                borderColor: 'var(--border-brass)',
                background: 'var(--bg-surface)',
                color: 'var(--accent-brass)',
              }}
            >
              {surpriseLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-brass)]" />
              ) : (
                <Shuffle className="w-4 h-4 text-[var(--accent-brass)]" />
              )}
              <span>Surprise Me</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              aria-label="Open filter drawer"
              className="relative flex items-center gap-2 px-3.5 py-2 font-manuscript text-xs sm:text-sm border rounded-sm cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)] shadow-sm"
              style={{
                borderColor: activeFilterCount > 0 ? 'var(--accent-primary)' : 'var(--border-hairline)',
                background: activeFilterCount > 0 ? 'var(--burgundy-wash)' : 'var(--bg-surface)',
                color: activeFilterCount > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span
                  className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                  style={{ background: 'var(--accent-primary)' }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Card Catalogue Search Bar */}
        <div className="relative mb-5">
          <label htmlFor="reading-room-search" className="sr-only">
            Search public-domain books
          </label>
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            {searching ? (
              <Loader2
                className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin"
                style={{ color: 'var(--accent-brass)' }}
              />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  const next = new URLSearchParams(searchParams);
                  next.delete('q');
                  setSearchParams(next);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 rounded cursor-pointer hover:bg-[var(--burgundy-wash)]"
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, author, or subject — e.g. Frankenstein, Austen, Gothic, Astronomy…"
              className="w-full pl-10 pr-10 py-3 font-manuscript text-sm border rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] shadow-sm"
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
          <div className="flex items-center justify-between mt-1.5 px-0.5">
            <p id="reading-room-hint" className="font-manuscript text-xs" style={{ color: 'var(--text-muted)' }}>
              Public-domain editions only · Complete texts and original illustrations.
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => handleApplyFilters({ language: '', fromYear: '', toYear: '', sort: 'popular', coversOnly: false })}
                className="font-manuscript text-xs underline cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                style={{ color: 'var(--accent-brass)' }}
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

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
          </div>
        )}

        {/* Category Chips Bar */}
        <CategoryChips selected={selectedCategory} onChange={handleCategoryChange} />

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
                  <div key={i} className="w-[120px] h-[200px] rounded-sm animate-pulse" style={{ background: 'var(--bg-surface)' }} />
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
          /* View C: Full Library Browse Shelves */
          <div className="space-y-4">
            {/* 1. Continue Reading Shelf */}
            {continueBooks.length > 0 && (
              <BookShelfRow
                title="Continue Reading"
                icon={<BookOpen className="w-4 h-4 text-[var(--accent-brass)]" />}
                books={continueBooks}
                loading={continueLoading}
                favoriteIds={favoriteIds}
                onBookClick={(book) => setSelectedBook(book)}
              />
            )}

            {/* 2. Favorites Shelf */}
            {favorites && favorites.length > 0 && (
              <BookShelfRow
                title="Your Favourites"
                icon={<Heart className="w-4 h-4 fill-current text-[var(--accent-primary)]" />}
                books={favorites}
                loading={false}
                favoriteIds={favoriteIds}
                onBookClick={(book) => setSelectedBook(book)}
              />
            )}

            {/* 3. Popular Classics Shelf */}
            <BookShelfRow
              title="Popular Classics"
              icon={<Star className="w-4 h-4 fill-current text-[var(--accent-brass)]" />}
              books={popularBooks}
              loading={popularLoading}
              error={popularError}
              favoriteIds={favoriteIds}
              onBookClick={(book) => setSelectedBook(book)}
              onRetry={fetchPopular}
            />

            {/* 4. Because You Favorited Shelf (Dynamic Recommendation) */}
            {recommendedBooks.length > 0 && (
              <BookShelfRow
                title={`Because You Favorited “${recommendedSubject}”`}
                icon={<BookMarked className="w-4 h-4 text-[var(--accent-brass)]" />}
                books={recommendedBooks}
                loading={recommendedLoading}
                favoriteIds={favoriteIds}
                onBookClick={(book) => setSelectedBook(book)}
              />
            )}

            {/* 5. Horror & Gothic Shelf */}
            <BookShelfRow
              title="Horror & Gothic"
              icon={<span className="text-base">🕯️</span>}
              books={previewHorror}
              loading={previewsLoading}
              favoriteIds={favoriteIds}
              onBookClick={(book) => setSelectedBook(book)}
            />

            {/* 6. Science Fiction Shelf */}
            <BookShelfRow
              title="Science Fiction"
              icon={<span className="text-base">🚀</span>}
              books={previewSciFi}
              loading={previewsLoading}
              favoriteIds={favoriteIds}
              onBookClick={(book) => setSelectedBook(book)}
            />

            {/* 7. Mystery & Crime Shelf */}
            <BookShelfRow
              title="Mystery & Crime"
              icon={<span className="text-base">🔍</span>}
              books={previewMystery}
              loading={previewsLoading}
              favoriteIds={favoriteIds}
              onBookClick={(book) => setSelectedBook(book)}
            />

            {/* 8. Adventure Shelf */}
            <BookShelfRow
              title="Adventure & Sea Stories"
              icon={<span className="text-base">⚓</span>}
              books={previewAdventure}
              loading={previewsLoading}
              favoriteIds={favoriteIds}
              onBookClick={(book) => setSelectedBook(book)}
            />

            {/* Editorial Footer / Colophon */}
            <footer className="mt-12 pt-8 pb-6 border-t text-center" style={{ borderColor: 'var(--border-hairline)' }}>
              <p className="font-manuscript text-xs italic" style={{ color: 'var(--accent-brass)' }}>
                ❦ The Inkwell Atelier Reading Room
              </p>
              <p className="font-manuscript text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Public-domain volumes sourced directly from the Project Gutenberg archive. Free to read, annotate, and preserve.
              </p>
            </footer>
          </div>
        )}
      </div>
    </>
  );
};
