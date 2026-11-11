import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getParsedEpub, getSanitizedChapterHtml, getAssetFromEpub } from './src/server/epubService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini SDK if API key is provided
  const apiKey = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // API: Automatically Generate Character Constellation Map from Story
  // ---------------------------------------------------------------------------
  app.post('/api/generate-character-map', async (req: Request, res: Response) => {
    try {
      const {
        projectTitle = 'Untitled Manuscript',
        genre = 'Literary Fiction',
        synopsis = '',
        chapters = [],
      } = req.body;

      // Combine story chapters text for analysis (sample up to ~12,000 chars for prompt balance)
      const storyExcerpt = chapters
        .map(
          (ch: { title: string; content: string }, idx: number) =>
            `--- Chapter ${idx + 1}: ${ch.title} ---\n${ch.content || ''}`
        )
        .join('\n\n')
        .slice(0, 14000);

      // Attempt Gemini AI extraction if key is present
      if (ai) {
        try {
          const prompt = `You are a master literary editor and dramaturg. Analyze this manuscript and generate a comprehensive character relationship map (dramatis personae) with interconnected relationships.

Manuscript Title: "${projectTitle}"
Genre: ${genre}
Synopsis: ${synopsis}

Story Excerpt:
${storyExcerpt || 'No manuscript text available yet. Extrapolate deep literary cast from synopsis and title.'}

Instructions:
1. Extract 3 to 7 core characters (protagonist, deuteragonist, confidants, mentors, antagonists, rivals, lovers, or mysterious figures).
2. For each character, identify:
   - name: full literary name
   - role: archetype or vocation (e.g. "Junior Archivist", "Disgraced Draughtsman", "Master Bell-Founder", "Observatory Keeper")
   - traits: 2 to 4 evocative adjectives (e.g. ["Observant", "Guarded", "Tenacious"])
   - motivation: their deepest desire or unresolved lack
   - arc: how their soul or situation transforms
   - relationships: explicit clauses stating how they relate to the OTHER extracted characters (e.g. "Reluctant ally to Clara; younger brother of Arthur; debtor to Magistrate Domingos")
   - notes: sensory physicality, habits, or symbolic object (e.g. "Carries a bone folder and brass pocket lens")
Ensure the relationships reference the exact names of other characters in the cast so they form a connected directed graph.`;

          const geminiPromise = ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  characters: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        role: { type: Type.STRING },
                        traits: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                        motivation: { type: Type.STRING },
                        arc: { type: Type.STRING },
                        relationships: { type: Type.STRING },
                        notes: { type: Type.STRING },
                      },
                      required: ['name', 'role', 'motivation', 'relationships'],
                    },
                  },
                },
                required: ['characters'],
              },
            },
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini API timeout')), 6000)
          );

          const response = await Promise.race([geminiPromise, timeoutPromise]);

          const parsed = JSON.parse(response.text || '{}');
          if (Array.isArray(parsed.characters) && parsed.characters.length > 0) {
            return res.json({
              success: true,
              source: 'gemini',
              characters: parsed.characters,
            });
          }
        } catch (geminiError) {
          console.warn('Gemini character generation fallback engaged:', geminiError);
          // Fall through to deterministic story extractor
        }
      }

      // Fallback: Intelligent domain-based story extraction
      const fallbackCharacters = generateStoryCharactersFallback(
        projectTitle,
        genre,
        synopsis,
        chapters
      );

      return res.json({
        success: true,
        source: 'story-extractor',
        characters: fallbackCharacters,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown generation failure';
      console.error('Failed to generate character map:', message);
      res.status(500).json({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // API: Reading Room — Gutendex / Project Gutenberg proxy
  // ---------------------------------------------------------------------------

  // Simple in-memory caches (TTL-based)
  const searchCache = new Map<string, { data: unknown; ts: number }>();
  const bookCache = new Map<number, { data: unknown; ts: number }>();
  const SEARCH_TTL = 5 * 60 * 1000;  // 5 minutes
  const BOOK_TTL   = 10 * 60 * 1000; // 10 minutes

  type GutendexAuthor = { name: string; birth_year: number | null; death_year: number | null };
  type GutendexBook = {
    id: number;
    title: string;
    authors: GutendexAuthor[];
    subjects: string[];
    bookshelves: string[];
    languages: string[];
    formats: Record<string, string>;
    download_count?: number;
    summaries?: string[];
  };

  function mapBook(b: GutendexBook) {
    const textUrl =
      b.formats['text/plain; charset=utf-8'] ||
      b.formats['text/plain; charset=us-ascii'] ||
      b.formats['text/plain'] ||
      '';
    const coverUrl =
      b.formats['image/jpeg'] ||
      `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.cover.medium.jpg`;
    return {
      id: b.id,
      title: b.title,
      authors: b.authors.map((a) => a.name),
      authorYears: b.authors.map((a) => ({
        name: a.name,
        birthYear: a.birth_year,
        deathYear: a.death_year,
      })),
      subjects: (b.subjects || []).slice(0, 10),
      bookshelves: b.bookshelves || [],
      coverUrl,
      language: b.languages || [],
      textUrl,
      rawFormats: b.formats,
      downloadCount: b.download_count ?? 0,
      summary: ((b.summaries ?? [])[0] ?? '').trim(),
    };
  }

  // Category slug → topic terms mapping (all verified against Gutendex)
  const CATEGORY_TOPICS: Record<string, string[]> = {
    'horror-gothic':          ['horror', 'gothic', 'ghost stories', 'supernatural'],
    'science-nature':         ['science', 'natural history', 'astronomy', 'physics', 'biology'],
    'science-fiction':        ['science fiction'],
    'mystery-crime':          ['detective', 'mystery'],
    'adventure':              ['adventure', 'sea stories', 'western'],
    'romance':                ['love stories', 'romance'],
    'fantasy-myth':           ['fantasy', 'fairy tales', 'mythology', 'legends'],
    'history':                ['history', 'military', 'ancient'],
    'biography-memoir':       ['biography', 'autobiography', 'diaries'],
    'philosophy-religion':    ['philosophy', 'ethics', 'religion'],
    'travel-exploration':     ['travel', 'voyages', 'exploration'],
    'poetry-drama':           ['poetry', 'drama', 'plays'],
    'childrens-classics':     ['children', 'juvenile'],
    'humor-satire':           ['humor', 'satire'],
    'documentary-nonfiction': ['essays', 'letters', 'speeches', 'nonfiction'],
  };

  // Shared caches for browse, popular, random, author endpoints
  const browseCache = new Map<string, { data: unknown; total: number; ts: number }>();
  const popularCache = new Map<number, { data: unknown; ts: number }>();
  const authorCache = new Map<string, { data: unknown; ts: number }>();
  const BROWSE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  const POPULAR_TTL = 30 * 60 * 1000;     // 30 minutes
  const AUTHOR_TTL  = 10 * 60 * 1000;     // 10 minutes

  async function fetchWithTimeout(url: string, timeoutMs: number): Promise<globalThis.Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Inkwell/1.0',
          'Accept': 'application/json, text/plain, */*',
        },
      });
      clearTimeout(timer);
      return r;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  // GET /api/library/search?q=<query>
  app.get('/api/library/search', async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length > 200) {
      return res.status(400).json({ error: 'Query parameter "q" must be 1–200 characters.' });
    }
    const cacheKey = q.toLowerCase();
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < SEARCH_TTL) {
      return res.json(cached.data);
    }
    try {
      const r = await fetchWithTimeout(
        `https://gutendex.com/books/?search=${encodeURIComponent(q)}`,
        15000
      );
      if (!r.ok) {
        return res.status(502).json({ error: `Gutendex returned ${r.status}. Try again.` });
      }
      const json = (await r.json()) as { results: GutendexBook[] };
      const data = (json.results || []).map(mapBook);
      searchCache.set(cacheKey, { data, ts: Date.now() });
      return res.json(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      console.error('[library/search]', msg);
      return res.status(502).json({ error: `Could not reach Gutendex: ${msg}` });
    }
  });

  // GET /api/library/book/:id
  app.get('/api/library/book/:id', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id ?? '', 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Book id must be a positive integer.' });
    }
    const cached = bookCache.get(id);
    if (cached && Date.now() - cached.ts < BOOK_TTL) {
      return res.json(cached.data);
    }
    try {
      const r = await fetchWithTimeout(`https://gutendex.com/books/${id}/`, 15000);
      if (!r.ok) {
        return res.status(r.status === 404 ? 404 : 502).json({
          error: r.status === 404 ? 'Book not found in Gutenberg.' : `Gutendex returned ${r.status}.`,
        });
      }
      const data = mapBook((await r.json()) as GutendexBook);
      bookCache.set(id, { data, ts: Date.now() });
      return res.json(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      console.error('[library/book]', msg);
      return res.status(502).json({ error: `Could not reach Gutendex: ${msg}` });
    }
  });

  // GET /api/library/book/:id/manifest
  app.get('/api/library/book/:id/manifest', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id ?? '', 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Book id must be a positive integer.' });
    }
    try {
      // 1. Try EPUB parse first directly from Gutenberg / disk cache
      try {
        const parsed = await getParsedEpub(id);
        return res.json(parsed.manifest);
      } catch (epubErr) {
        console.warn(`[manifest] EPUB parse unavailable for ${id}, falling back to plain-text:`, epubErr);
      }

      // 2. Fallback: Fetch Gutendex book detail to get plain-text URL
      let rawBook: any = bookCache.get(id)?.data;
      if (!rawBook) {
        const r = await fetchWithTimeout(`https://gutendex.com/books/${id}/`, 20000);
        if (r.ok) {
          const json = (await r.json()) as GutendexBook;
          rawBook = mapBook(json);
          bookCache.set(id, { data: rawBook, ts: Date.now() });
        }
      }

      // 2. Fallback: Parse plain text into manifest format
      const textUrl = rawBook?.textUrl || '';
      if (!textUrl) {
        return res.status(404).json({ error: 'No readable text or EPUB format available for this book.' });
      }

      const r = await fetchWithTimeout(textUrl, 20000);
      if (!r.ok) {
        return res.status(502).json({ error: `Could not fetch book text (${r.status}).` });
      }
      const rawText = await r.text();

      // Strip PG header & footer
      const startMarker = /\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG/i;
      const endMarker   = /\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i;
      let body = rawText;
      const startMatch = startMarker.exec(rawText);
      if (startMatch) {
        const afterStart = rawText.indexOf('\n', startMatch.index);
        body = afterStart > -1 ? rawText.slice(afterStart + 1) : rawText;
      }
      const endMatch = endMarker.exec(body);
      if (endMatch) {
        body = body.slice(0, endMatch.index).trimEnd();
      }

      const chapterPattern = /^(CHAPTER|Chapter|PART|Part|BOOK|Book)\s+([IVXLCDM]+|[0-9]+|[A-Z][a-z]*)[.:—\s]?/m;
      const romanPattern   = /^([IVXLCDM]{1,6})\.\s*$/m;

      const lines = body.split('\n');
      const chapters: Array<{ id: string; title: string; order: number; wordCount: number; href: string }> = [];
      const toc: Array<{ id: string; title: string; level: number; href: string; chapterId: string }> = [];
      let currentTitle = '';
      let currentLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (chapterPattern.test(trimmed) || (romanPattern.test(trimmed) && trimmed.length <= 10)) {
          if (currentLines.some((l) => l.trim())) {
            const chId = `ch-${chapters.length + 1}`;
            const t = currentTitle || (chapters.length === 0 ? 'Front Matter' : `Section ${chapters.length}`);
            const wc = currentLines.join(' ').split(/\s+/).filter(Boolean).length;
            chapters.push({ id: chId, title: t, order: chapters.length + 1, wordCount: wc, href: `#${chId}` });
            toc.push({ id: `toc-${chapters.length}`, title: t, level: 1, href: `#${chId}`, chapterId: chId });
          }
          currentTitle = trimmed.replace(/[\]\[]/g, '').trim();
          currentLines = [];
        } else {
          currentLines.push(line);
        }
      }
      if (currentLines.some((l) => l.trim())) {
        const chId = `ch-${chapters.length + 1}`;
        const t = currentTitle || (chapters.length === 0 ? 'Full Volume' : `Section ${chapters.length + 1}`);
        const wc = currentLines.join(' ').split(/\s+/).filter(Boolean).length;
        chapters.push({ id: chId, title: t, order: chapters.length + 1, wordCount: wc, href: `#${chId}` });
        toc.push({ id: `toc-${chapters.length}`, title: t, level: 1, href: `#${chId}`, chapterId: chId });
      }

      return res.json({
        id,
        title: rawBook?.title || 'Untitled Book',
        authors: rawBook?.authors || ['Unknown Author'],
        cover: rawBook?.coverUrl || null,
        toc,
        chapters,
        source: 'text',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Manifest extraction failed';
      console.error('[manifest]', msg);
      return res.status(502).json({ error: msg });
    }
  });

  // GET /api/library/book/:id/chapter/:chapterId
  app.get('/api/library/book/:id/chapter/:chapterId', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id ?? '', 10);
    const chapterId = req.params.chapterId;
    if (!id || id <= 0 || !chapterId) {
      return res.status(400).json({ error: 'Valid book id and chapter id are required.' });
    }
    try {
      // 1. Try EPUB chapter first directly
      try {
        const chapterData = await getSanitizedChapterHtml(id, chapterId);
        return res.json(chapterData);
      } catch (epubErr) {
        console.warn(`[chapter] EPUB chapter ${chapterId} not available, checking text fallback:`, epubErr);
      }

      // 2. Plain-text fallback for chapter
      let rawBook: any = bookCache.get(id)?.data;
      if (!rawBook) {
        const r = await fetchWithTimeout(`https://gutendex.com/books/${id}/`, 20000);
        if (r.ok) {
          const json = (await r.json()) as GutendexBook;
          rawBook = mapBook(json);
          bookCache.set(id, { data: rawBook, ts: Date.now() });
        }
      }

      // Plain-text fallback for chapter
      const textUrl = rawBook?.textUrl || '';
      if (!textUrl) {
        return res.status(404).json({ error: 'Chapter not found' });
      }
      const r = await fetchWithTimeout(textUrl, 20000);
      if (!r.ok) {
        return res.status(502).json({ error: `Could not fetch book text.` });
      }
      const rawText = await r.text();
      const paragraphs = rawText.split(/\n\s*\n/).slice(0, 50).map((p) => `<p>${p.trim()}</p>`).join('');
      return res.json({
        title: 'Plain Text Chapter',
        html: `<article class="inkwell-chapter-content">${paragraphs}</article>`,
        nextChapterId: null,
        prevChapterId: null,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Chapter retrieval failed';
      console.error('[chapter]', msg);
      return res.status(404).json({ error: msg });
    }
  });

  // GET /api/library/book/:id/asset/*
  app.get('/api/library/book/:id/asset/*', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id ?? '', 10);
    const assetPath = req.params[0];
    if (!id || id <= 0 || !assetPath) {
      return res.status(400).send('Invalid asset request.');
    }
    try {
      const { buffer, mimeType } = await getAssetFromEpub(id, assetPath);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.send(buffer);
    } catch (e: unknown) {
      return res.status(404).send('Asset not found');
    }
  });

  // GET /api/library/text/:id
  // Fetches the plain-text from Project Gutenberg, strips header/footer, splits into chapters
  app.get('/api/library/text/:id', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id ?? '', 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Book id must be a positive integer.' });
    }
    // 1. Resolve textUrl from book detail
    let textUrl = '';
    let bookTitle = 'Untitled';
    try {
      const cached = bookCache.get(id);
      let bookData: { textUrl: string; title: string } | null = null;
      if (cached && Date.now() - cached.ts < BOOK_TTL) {
        bookData = cached.data as { textUrl: string; title: string };
      } else {
        const r = await fetchWithTimeout(`https://gutendex.com/books/${id}/`, 15000);
        if (!r.ok) {
          return res.status(r.status === 404 ? 404 : 502).json({ error: 'Book not found.' });
        }
        const raw = (await r.json()) as GutendexBook;
        bookData = mapBook(raw);
        bookCache.set(id, { data: bookData, ts: Date.now() });
      }
      textUrl = bookData.textUrl;
      bookTitle = bookData.title;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      return res.status(502).json({ error: `Could not resolve book: ${msg}` });
    }

    if (!textUrl) {
      return res.status(404).json({ error: 'No plain-text version available for this book.' });
    }

    // 2. Fetch the actual text file
    let rawText = '';
    try {
      const r = await fetchWithTimeout(textUrl, 20000);
      if (!r.ok) {
        return res.status(502).json({ error: `Text file returned ${r.status}.` });
      }
      rawText = await r.text();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      return res.status(502).json({ error: `Could not fetch text: ${msg}` });
    }

    // 3. Strip Project Gutenberg header & footer
    const startMarker = /\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG/i;
    const endMarker   = /\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i;

    let body = rawText;
    const startMatch = startMarker.exec(rawText);
    if (startMatch) {
      // Skip to end of that line
      const afterStart = rawText.indexOf('\n', startMatch.index);
      body = afterStart > -1 ? rawText.slice(afterStart + 1) : rawText;
    }
    const endMatch = endMarker.exec(body);
    if (endMatch) {
      body = body.slice(0, endMatch.index).trimEnd();
    }

    // 4. Split into chapters
    // Matches: CHAPTER I, Chapter 1, Chapter I., PART ONE, I., II., etc.
    const chapterPattern = /^(CHAPTER|Chapter|PART|Part|BOOK|Book)\s+([IVXLCDM]+|[0-9]+|[A-Z][a-z]*)[.:—\s]?/m;
    const romanPattern   = /^([IVXLCDM]{1,6})\.\s*$/m;

    const lines = body.split('\n');
    const chapters: { title: string; content: string }[] = [];
    let currentTitle = '';
    let currentLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (chapterPattern.test(trimmed) || (romanPattern.test(trimmed) && trimmed.length <= 10)) {
        if (currentLines.some((l) => l.trim())) {
          chapters.push({
            title: currentTitle || (chapters.length === 0 ? 'Front Matter' : `Section ${chapters.length}`),
            content: currentLines.join('\n').trim(),
          });
        }
        currentTitle = trimmed.replace(/[\]\[]/g, '').trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }
    // Push last segment
    if (currentLines.some((l) => l.trim())) {
      chapters.push({
        title: currentTitle || (chapters.length === 0 ? 'Full Volume' : `Section ${chapters.length + 1}`),
        content: currentLines.join('\n').trim(),
      });
    }

    // If no chapters detected, return the whole body as one chapter
    if (chapters.length === 0) {
      chapters.push({ title: bookTitle, content: body.trim() });
    }

    return res.json({ title: bookTitle, chapters });
  });

  // ---------------------------------------------------------------------------
  // API: Reading Room — Browse by category, popular, random, author
  // ---------------------------------------------------------------------------

  /**
   * GET /api/library/browse
   * Query params:
   *   category   - slug from CATEGORY_TOPICS (required)
   *   page       - page number, default 1
   *   sort       - 'popular' | 'ascending' | 'descending', default 'popular'
   *   language   - ISO 639-1 code, e.g. 'en' (optional)
   *   from_year  - author birth year filter start (optional)
   *   to_year    - author birth year filter end (optional)
   *   covers_only - 'true' to filter books with covers (optional)
   */
  app.get('/api/library/browse', async (req: Request, res: Response) => {
    const categoryRaw = typeof req.query.category   === 'string' ? req.query.category.trim()   : '';
    const page        = Math.max(1, parseInt(typeof req.query.page === 'string' ? req.query.page : '1', 10) || 1);
    const sort        = ['popular', 'ascending', 'descending'].includes(req.query.sort as string)
                        ? (req.query.sort as string) : 'popular';
    const language    = typeof req.query.language   === 'string' ? req.query.language.trim()   : '';
    const fromYear    = typeof req.query.from_year  === 'string' ? req.query.from_year.trim()  : '';
    const toYear      = typeof req.query.to_year    === 'string' ? req.query.to_year.trim()    : '';
    const coversOnly  = req.query.covers_only === 'true';

    const cacheKey = JSON.stringify({ categoryRaw, page, sort, language, fromYear, toYear, coversOnly });
    const cached = browseCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < BROWSE_TTL) {
      return res.json({ books: cached.data, total: cached.total });
    }

    const isGeneral = !categoryRaw || categoryRaw === 'all' || categoryRaw === 'popular';

    const fetchUrl = async (url: string) => {
      try {
        const r = await fetchWithTimeout(url, 25000);
        if (!r.ok) return { results: [] as GutendexBook[], count: 0 };
        const j = (await r.json()) as { results: GutendexBook[]; count: number };
        return { results: j.results || [], count: j.count || 0 };
      } catch {
        return { results: [] as GutendexBook[], count: 0 };
      }
    };

    if (isGeneral) {
      let url = `https://gutendex.com/books/?page=${page}`;
      if (sort === 'ascending' || sort === 'descending') url += `&sort=${sort}`;
      if (language)   url += `&languages=${encodeURIComponent(language)}`;
      if (fromYear)   url += `&author_year_start=${encodeURIComponent(fromYear)}`;
      if (toYear)     url += `&author_year_end=${encodeURIComponent(toYear)}`;
      if (coversOnly) url += `&mime_type=image%2Fjpeg`;

      const fetched = await fetchUrl(url);
      const books = (fetched.results || []).map(mapBook);
      browseCache.set(cacheKey, { data: books, total: fetched.count, ts: Date.now() });
      return res.json({ books, total: fetched.count });
    }

    const categorySlugs = categoryRaw.split(',').map((s) => s.trim()).filter((s) => CATEGORY_TOPICS[s]);
    if (categorySlugs.length === 0) {
      return res.status(400).json({
        error: `Unknown category "${categoryRaw}". Valid: ${Object.keys(CATEGORY_TOPICS).join(', ')}.`,
      });
    }

    // Collect topics from selected categories (up to 2 topics across them)
    const activeTopics: string[] = [];
    for (const slug of categorySlugs) {
      const top = CATEGORY_TOPICS[slug]?.[0];
      if (top && !activeTopics.includes(top)) {
        activeTopics.push(top);
      }
      if (activeTopics.length >= 2) break;
    }

    // Fetch each topic in parallel
    const fetchTopic = async (topic: string) => {
      let url = `https://gutendex.com/books/?topic=${encodeURIComponent(topic)}&page=${page}`;
      if (sort === 'ascending' || sort === 'descending') url += `&sort=${sort}`;
      if (language)   url += `&languages=${encodeURIComponent(language)}`;
      if (fromYear)   url += `&author_year_start=${encodeURIComponent(fromYear)}`;
      if (toYear)     url += `&author_year_end=${encodeURIComponent(toYear)}`;
      if (coversOnly) url += `&mime_type=image%2Fjpeg`;
      return fetchUrl(url);
    };

    const fetched = await Promise.all(activeTopics.map(fetchTopic));
    const allResults: GutendexBook[] = [];
    let totalCount = 0;
    for (const f of fetched) {
      allResults.push(...f.results);
      totalCount = Math.max(totalCount, f.count);
    }

    // Dedup by id, preserve order
    const seen = new Set<number>();
    const deduped = allResults.filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });

    const books = deduped.map(mapBook);
    browseCache.set(cacheKey, { data: books, total: totalCount, ts: Date.now() });
    return res.json({ books, total: totalCount });
  });

  /**
   * GET /api/library/popular?page=<n>
   * Returns the most popular public-domain books from Gutendex.
   */
  app.get('/api/library/popular', async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(typeof req.query.page === 'string' ? req.query.page : '1', 10) || 1);
    const cached = popularCache.get(page);
    if (cached && Date.now() - cached.ts < POPULAR_TTL) {
      return res.json(cached.data);
    }
    try {
      const r = await fetchWithTimeout(
        `https://gutendex.com/books/?page=${page}`,
        25000
      );
      if (!r.ok) {
        return res.status(502).json({ error: `Gutendex returned ${r.status}.` });
      }
      const json = (await r.json()) as { results: GutendexBook[]; count: number };
      const data = {
        books: (json.results || []).map(mapBook),
        total: json.count || 0,
      };
      popularCache.set(page, { data, ts: Date.now() });
      return res.json(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      console.error('[library/popular]', msg);
      return res.status(502).json({ error: `Could not reach Gutendex: ${msg}` });
    }
  });

  /**
   * GET /api/library/random
   * Returns a single random popular book.
   */
  app.get('/api/library/random', async (req: Request, res: Response) => {
    try {
      const randomPage = Math.floor(Math.random() * 20) + 1;
      const r = await fetchWithTimeout(
        `https://gutendex.com/books/?page=${randomPage}`,
        25000
      );
      if (!r.ok) {
        return res.status(502).json({ error: `Gutendex returned ${r.status}.` });
      }
      const json = (await r.json()) as { results: GutendexBook[] };
      const results = json.results || [];
      if (results.length === 0) {
        return res.status(404).json({ error: 'No books found.' });
      }
      const pick = results[Math.floor(Math.random() * results.length)];
      return res.json(mapBook(pick));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      console.error('[library/random]', msg);
      return res.status(502).json({ error: `Could not reach Gutendex: ${msg}` });
    }
  });

  /**
   * GET /api/library/author?name=<authorName>
   * Returns books by a specific author (or best-match by name search).
   */
  app.get('/api/library/author', async (req: Request, res: Response) => {
    const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    if (!name || name.length > 200) {
      return res.status(400).json({ error: 'Parameter "name" must be 1–200 characters.' });
    }
    const cacheKey = name.toLowerCase();
    const cached = authorCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < AUTHOR_TTL) {
      return res.json(cached.data);
    }
    try {
      const r = await fetchWithTimeout(
        `https://gutendex.com/books/?search=${encodeURIComponent(name)}`,
        25000
      );
      if (!r.ok) {
        return res.status(502).json({ error: `Gutendex returned ${r.status}.` });
      }
      const json = (await r.json()) as { results: GutendexBook[] };
      const data = (json.results || []).map(mapBook);
      authorCache.set(cacheKey, { data, ts: Date.now() });
      return res.json(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      console.error('[library/author]', msg);
      return res.status(502).json({ error: `Could not reach Gutendex: ${msg}` });
    }
  });

  /**
   * GET /api/library/cover/:id
   * Optional proxy & cache for Gutenberg cover images
   */
  const coverCache = new Map<number, { buffer: Buffer; mime: string; ts: number }>();
  app.get('/api/library/cover/:id', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id ?? '', 10);
    if (!id || id <= 0) return res.status(400).send('Invalid book id');
    const cached = coverCache.get(id);
    if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) {
      res.setHeader('Content-Type', cached.mime);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.send(cached.buffer);
    }
    const targetUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
    try {
      const r = await fetchWithTimeout(targetUrl, 10000);
      if (!r.ok) return res.status(r.status).send('Cover not found');
      const arr = await r.arrayBuffer();
      const buffer = Buffer.from(arr);
      const mime = r.headers.get('content-type') || 'image/jpeg';
      coverCache.set(id, { buffer, mime, ts: Date.now() });
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.send(buffer);
    } catch {
      return res.status(502).send('Error fetching cover');
    }
  });

  // ---------------------------------------------------------------------------
  // API: Streaming Conversational Literary Dramaturg & AI Writing Partner
  // ---------------------------------------------------------------------------
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const {
        messages,
        currentChapter = '',
        characters = [],
        worldNotes = [],
        projectTitle = 'Untitled Manuscript',
        projectGenre = 'Literary Fiction',
      } = req.body || {};

      // 1. Validate request body
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          error: 'Invalid request: "messages" must be a non-empty array of message objects.',
        });
      }

      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || typeof lastMessage.content !== 'string' || !lastMessage.content.trim()) {
        return res.status(400).json({
          error: 'Invalid request: the latest message must contain a non-empty content string.',
        });
      }

      // 2. Trim and assemble context to safe lengths
      const rawChapterText =
        typeof currentChapter === 'string'
          ? currentChapter
          : `${currentChapter?.title ? `Chapter: ${currentChapter.title}\n` : ''}${currentChapter?.content || ''}`;
      const chapterExcerpt = rawChapterText.trim().slice(0, 8000);

      const characterContext = Array.isArray(characters)
        ? characters
            .slice(0, 10)
            .map(
              (c: { name?: string; role?: string; traits?: string[]; motivation?: string; arc?: string; relationships?: string }) =>
                `• ${c.name || 'Unnamed'}${c.role ? ` (${c.role})` : ''}: ${c.motivation || 'Deep motivation pending'}. Arc: ${c.arc || 'Evolving'}. Relationships: ${c.relationships || 'None listed'}`
            )
            .join('\n')
            .slice(0, 3000)
        : typeof characters === 'string'
        ? characters.slice(0, 3000)
        : '';

      const worldContext = Array.isArray(worldNotes)
        ? worldNotes
            .slice(0, 10)
            .map(
              (w: { title?: string; name?: string; category?: string; description?: string; lore?: string }) =>
                `• ${w.title || w.name || 'Landmark'}${w.category ? ` [${w.category}]` : ''}: ${w.description || w.lore || ''}`
            )
            .join('\n')
            .slice(0, 3000)
        : typeof worldNotes === 'string'
        ? worldNotes.slice(0, 3000)
        : '';

      // Set Server-Sent Events headers for response streaming
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const systemInstruction = `You are a master literary editor and dramaturg collaborating with an author in their private candlelit writing atelier.
Your sacred duty is to respect the author's distinctive voice, prose rhythm, and narrative intentions.
Never rewrite, replace, or dictate their prose unless they explicitly ask you to rewrite a specific passage.
Provide perceptive dramaturgical critique, character psychology insights, narrative tension analysis, sensory atmosphere suggestions, and continuity observations.
Ground your guidance in the provided story context, character dossiers, and world lore where applicable.
Maintain a warm, encouraging, intellectually rigorous tone worthy of a classical bookmaker and literary scholar.`;

      // 3. Attempt Gemini streaming if AI client is initialized
      if (ai) {
        try {
          // Construct formatted conversation contents alternating user / model
          const formattedContents = messages
            .filter((m: { role?: string; content?: string }) => m && typeof m.content === 'string')
            .map((m: { role?: string; content: string }, idx: number) => {
              const role = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
              let textContent = m.content;

              // Inject manuscript dossier context into the opening user turn
              if (idx === 0 && role === 'user') {
                const dossierHeader = [
                  `[MANUSCRIPT DOSSIER: "${projectTitle}" (${projectGenre})]`,
                  characterContext ? `[DRAMATIS PERSONAE]:\n${characterContext}` : '',
                  worldContext ? `[WORLD & LORE]:\n${worldContext}` : '',
                  chapterExcerpt ? `[CURRENT CHAPTER EXCERPT]:\n${chapterExcerpt}` : '',
                  '---',
                  `Author's Query: ${textContent}`,
                ]
                  .filter(Boolean)
                  .join('\n\n');
                textContent = dossierHeader;
              }

              return {
                role,
                parts: [{ text: textContent }],
              };
            });

          const responseStream = await ai.models.generateContentStream({
            model: GEMINI_MODEL,
            contents: formattedContents,
            config: {
              systemInstruction,
            },
          });

          for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          }

          res.write('data: [DONE]\n\n');
          return res.end();
        } catch (geminiErr) {
          console.warn('Gemini chat streaming failed or timed out; engaging offline dramaturg:', geminiErr);
          // Fall through to offline companion
        }
      }

      // 4. Graceful offline fallback response
      const offlineReply = generateOfflineEditorialChat(
        lastMessage.content,
        chapterExcerpt,
        projectTitle,
        projectGenre,
        characterContext
      );

      res.write(
        `data: ${JSON.stringify({
          text: `[Offline Editorial Dramaturg]\n\n${offlineReply}`,
          offline: true,
        })}\n\n`
      );
      res.write('data: [DONE]\n\n');
      return res.end();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Chat server error';
      console.error('Failure in /api/chat:', message);
      if (!res.headersSent) {
        return res.status(500).json({ error: message });
      }
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });

  // ---------------------------------------------------------------------------
  // Vite Dev Middleware or Static File Serving
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`INKWELL studio running on http://0.0.0.0:${PORT}`);
  });
}

// -----------------------------------------------------------------------------
// Fallback Narrative Extraction Algorithm (works offline or without API key)
// -----------------------------------------------------------------------------
function generateStoryCharactersFallback(
  title: string,
  genre: string,
  synopsis: string,
  chapters: Array<{ title: string; content: string }>
) {
  const combinedText = `${title} ${synopsis} ${chapters.map((c) => `${c.title} ${c.content}`).join(' ')}`;

  // Find capitalized names in the text
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  const commonExclusions = new Set([
    'The', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'With', 'Chapter', 'Volume', 'London',
    'Lisbon', 'Thames', 'England', 'November', 'Autumn', 'Winter', 'Spring', 'Summer',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'Morning', 'Evening', 'Night', 'When', 'Then', 'After', 'Before', 'While', 'Under',
  ]);

  const candidates = new Map<string, number>();
  let match: RegExpExecArray | null;
  while ((match = namePattern.exec(combinedText)) !== null) {
    const candidate = match[1].trim();
    if (!commonExclusions.has(candidate) && candidate.length > 3 && !/^\d+$/.test(candidate)) {
      candidates.set(candidate, (candidates.get(candidate) || 0) + 1);
    }
  }

  // Pre-seed based on project theme if few candidates found
  const isMaritime = /sea|ocean|port|hydrographer|ship|fleet|island/i.test(combinedText);
  const isGothic = /bell|parish|foundry|vestry|estuary|manuscript|church/i.test(combinedText);

  if (isGothic) {
    return [
      {
        name: 'Clara Ashworth',
        role: 'Junior Archivist & Protagonist',
        traits: ['Methodical', 'Observant', 'Unyielding'],
        motivation: 'Uncover the forged registry that struck the fourth bell from London records.',
        arc: 'Transforms from an obedient cataloguer into an investigator who risks her career.',
        relationships: 'Uneasy ally to Julian Vance; protégée to Dr. Arthur Henshaw; adversary to Vestry Clerk Martin.',
        notes: 'Carries a horn-handled bone folder and a brass pocket lens on a woven cord.',
      },
      {
        name: 'Julian Vance',
        role: 'Disgraced Marine Draughtsman',
        traits: ['Guarded', 'Cynical', 'Quietly Loyal'],
        motivation: 'Exonerate his deceased brother Arthur from the Bishopsgate foundry fire.',
        arc: 'Overcomes his bitter distrust of institutions to share his family’s private ledgers.',
        relationships: 'Reluctant partner to Clara Ashworth; older brother to late Arthur Vance.',
        notes: 'Walks with a slight limp from an estuary barge accident; smells of pipe tobacco and coal dust.',
      },
      {
        name: 'Dr. Arthur Henshaw',
        role: 'Chief Keeper & Secret Mentor',
        traits: ['Cryptic', 'Scholarly', 'Guilty'],
        motivation: 'Protect the hidden bell register without alerting church authorities.',
        arc: 'A posthumous guide whose scattered margin notes point Clara toward the estuary locks.',
        relationships: 'Mentor to Clara Ashworth; former correspondent of Julian’s father.',
        notes: 'Left coded botanical illustrations pressed into the library’s third gallery volumes.',
      },
      {
        name: 'Clerk Martin Vane',
        role: 'Vestry Overseer & Antagonist',
        traits: ['Rigid', 'Ambitious', 'Secretive'],
        motivation: 'Ensure the 1842 parish ledger erasure is never brought before the bishop.',
        arc: 'Tightens institutional control as Clara’s inquiries draw closer to the estuary wharf.',
        relationships: 'Adversary to Clara Ashworth; suspicious of Julian Vance.',
        notes: 'Wears a heavy signet ring of blackened silver and speaks in low, deliberate cadences.',
      },
    ];
  }

  if (isMaritime) {
    return [
      {
        name: 'Mateus Ferreira',
        role: 'Apprentice Hydrographer',
        traits: ['Keen-eyed', 'Patient', 'Quietly Defiant'],
        motivation: 'Decipher Master Domingos’ secret Atlantic soundings before the naval fleet departs.',
        arc: 'Discovers that nautical precision carries profound moral duty to innocent crews.',
        relationships: 'Apprentice to Master Domingos; childhood ally of Inês de Almeida; rival to Lieutenant Cabral.',
        notes: 'Inks his own drafting sheets with imported vermilion cinnabar.',
      },
      {
        name: 'Inês de Almeida',
        role: 'Engraver & Master Printer’s Daughter',
        traits: ['Sharp-witted', 'Resourceful', 'Courageous'],
        motivation: 'Preserve her family’s copperplate press against royal censorship fines.',
        arc: 'Becomes the underground publisher of the unredacted charts.',
        relationships: 'Confidante and childhood friend of Mateus Ferreira; owed a favor by harbor merchants.',
        notes: 'Fingertips permanently stained from copperplate etching nitric acid.',
      },
      {
        name: 'Master Domingos',
        role: 'Royal Hydrographer & Mentor',
        traits: ['Taciturn', 'Venerable', 'Burdened'],
        motivation: 'Conceal dangerous phantom shoals from reckless admiralty captains.',
        arc: 'Entrusts his lifetime of private soundings to Mateus before sudden royal exile.',
        relationships: 'Mentor to Mateus Ferreira; estranged colleague of the Naval Minister.',
        notes: 'Keeps an ancient brass astrolabe calibrated to the Azores meridian.',
      },
      {
        name: 'Lieutenant Cabral',
        role: 'Admiralty Officer & Foil',
        traits: ['Imperious', 'Impatient', 'Nationalistic'],
        motivation: 'Claim the uncharted islands in the name of the Crown at any cost.',
        arc: 'Stands as the zealous military authority pressing the hydrographers for unverified maps.',
        relationships: 'Rival and inquisitor to Mateus Ferreira; suspicious of Inês’ print shop.',
        notes: 'Wears gold-braided naval epaulettes tarnished green by sea salt.',
      },
    ];
  }

  // General Literary Story Cast
  return [
    {
      name: `${title.split(' ')[0] || 'Alistair'} Sterling`,
      role: 'Protagonist & Scholar',
      traits: ['Analytical', 'Passionate', 'Haunted'],
      motivation: 'Resolve the mystery recorded in the manuscript’s opening chapters.',
      arc: 'Crosses from intellectual detachment into emotional vulnerability.',
      relationships: 'Companion to Evelyn Thorne; former colleague of Marcus Vane.',
      notes: 'Carries an antique silver pocket watch that runs three minutes fast.',
    },
    {
      name: 'Evelyn Thorne',
      role: 'Confidante & Keeper of the Archives',
      traits: ['Perceptive', 'Steadfast', 'Skeptical'],
      motivation: 'Protect the sanctuary of the study against outside intrusion.',
      arc: 'Reclaims her agency by deciphering the central riddle alongside Sterling.',
      relationships: 'Trusted confidante to Alistair Sterling; secret correspondent with Marcus Vane.',
      notes: 'Speaks with precise, quiet diction and keeps her hair bound with a velvet ribbon.',
    },
    {
      name: 'Marcus Vane',
      role: 'Antagonist & Rival Scholar',
      traits: ['Calculated', 'Worldly', 'Uncompromising'],
      motivation: 'Acquire the final volume to secure his appointment to the high academy.',
      arc: 'Finds his rational worldview shattered when the archives reveal his family’s debt.',
      relationships: 'Intellectual rival to Alistair Sterling; former patron of Evelyn Thorne.',
      notes: 'Carries a cane tipped with an ivory carving of a raven.',
    },
  ];
}

// -----------------------------------------------------------------------------
// Offline Editorial Dramaturg Fallback Generator
// -----------------------------------------------------------------------------
function generateOfflineEditorialChat(
  query: string,
  chapterExcerpt: string,
  title: string,
  genre: string,
  charactersContext: string
): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('twist') || lowerQuery.includes('brainstorm')) {
    return `Here are three dramaturgical complications tailored to "${title}" (${genre}):

1. **The Suppressed Ledger / Stolen Proof**: A seemingly loyal ally reveals that they have concealed a critical document or artifact—not out of malice, but to shield someone close to the protagonist from scandal.
2. **The Inverted Warning**: A message or omen previously interpreted as a threat from an adversary turns out to be a desperate appeal for assistance or a hidden confession.
3. **The Unforeseen Debt**: An outside authority or patron arrives to enforce an ancient or forgotten pact, forcing the protagonist to choose between preserving their reputation and saving an innocent companion.

*Dramaturg Note*: Ensure this complication raises emotional friction rather than merely accelerating external plot mechanics. Which of these avenues aligns closest with your vision for this chapter?`;
  }

  if (lowerQuery.includes('prose') || lowerQuery.includes('improve') || lowerQuery.includes('passage')) {
    return `Appraising the prose cadence for "${title}":

• **Rhythmic Variety**: Alternate expansive, multi-clause periods during contemplative pauses with terse, sensory fragments when narrative pressure mounts.
• **Sensory Particulars**: Ground introspective moments in tangible textures—the chill of an iron key, the rasp of dry parchment, the flicker of guttering candlelight, or the sharp scent of bitter ink.
• **Verbal Torque**: Check for passive constructions ("was feeling", "could be seen") and recast them into active, sensory verbs that carry psychological momentum.

*Would you like to examine a specific paragraph together to test these cadences?*`;
  }

  if (lowerQuery.includes('continuity') || lowerQuery.includes('check')) {
    return `Continuity appraisal for "${title}":

• **Character Voice & Agency**: Check that any active characters retain their distinctive speech rhythms, physical habits, and underlying objectives rather than merely serving plot exposition.
• **Atmospheric Consistency**: Verify that ambient illumination, spatial coordinates, and physical props (timepieces, keys, correspondence) remain consistent with prior scenes.
• **Knowledge Asymmetry**: Clarify precisely what each person knows versus what they merely suspect. The strongest dramatic tension springs from unspoken secrets between allies.

*Let me know if there is a specific timeline event or character motivation you wish to cross-reference.*`;
  }

  if (lowerQuery.includes('summarize') || lowerQuery.includes('scene')) {
    return `Dramaturgical Scene Blueprint for "${title}":

• **Scene Objective**: What does the protagonist enter the scene seeking, and what price are they willing to pay to obtain it?
• **The Point of Resistance**: Where does conflict arise—from external obstacles, environmental pressure, or internal moral hesitation?
• **The Pivot**: The key sentence or action where the power balance or understanding shifts irreversibly.
• **Narrative Residue**: The lingering consequence or unanswered question that drives the protagonist directly into the following chapter.

*How does this balance reflect the arc you intend for this folio?*`;
  }

  // General literary editorial response
  return `Regarding your inquiry on "${title}":

Your instinct to examine this narrative beat closely is perceptive. Longform fiction thrives when character motivation and environmental pressure converge with sensory specificity.

Consider these three editorial angles:
1. **The Stakes**: What does your protagonist stand to lose if they hesitate or make the wrong choice in this moment?
2. **The Subtext**: What is the emotional truth that neither character in the room is willing to state aloud?
3. **Sensory Anchoring**: How can the immediate setting (shadows, drafts, texture of paper or brass) amplify the scene's emotional weight?

Feel free to paste a specific excerpt or ask a targeted question about dialogue, pacing, or dramatic tension.`;
}

startServer();
