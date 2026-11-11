/**
 * epubService.ts
 * Robust server-side EPUB parser, asset streamer, and chapter sanitizer
 * for The Reading Room in Inkwell Atelier.
 */

import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import sanitizeHtml from 'sanitize-html';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TocItem {
  id: string;
  title: string;
  level: number;
  href: string; // original target href or anchor
  chapterId?: string; // mapped spine chapter id
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

interface ParsedEpubBook {
  manifest: BookManifest;
  spineFiles: Array<{ id: string; title: string; zipPath: string; wordCount: number }>;
  zip: JSZip;
}

// ---------------------------------------------------------------------------
// Constants & In-Memory Caches
// ---------------------------------------------------------------------------

const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'library');
const parsedBookCache = new Map<number, { data: ParsedEpubBook; ts: number }>();
const PARSED_TTL = 30 * 60 * 1000; // 30 minutes in-memory

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Fetch EPUB with timeout, redirects, and size limit
// ---------------------------------------------------------------------------

async function fetchEpubBuffer(
  bookId: number,
  formats?: Record<string, string>
): Promise<Buffer> {
  ensureCacheDir();
  const cachePath = path.join(CACHE_DIR, `book_${bookId}.epub`);

  // Check disk cache first
  if (fs.existsSync(cachePath)) {
    try {
      const stats = fs.statSync(cachePath);
      if (stats.size > 1000) {
        return fs.readFileSync(cachePath);
      }
    } catch (e) {
      console.warn(`[epubService] Error reading cached epub ${bookId}:`, e);
    }
  }

  // Candidate URLs in priority order
  const candidates: string[] = [];
  if (formats?.['application/epub+zip']) {
    candidates.push(formats['application/epub+zip']);
  }
  candidates.push(`https://www.gutenberg.org/ebooks/${bookId}.epub3.images`);
  candidates.push(`https://www.gutenberg.org/ebooks/${bookId}.epub.images`);
  candidates.push(`https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}-images-3.epub`);
  candidates.push(`https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}-images.epub`);

  let lastError: Error | null = null;

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000); // 25s timeout

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Inkwell/1.0',
          Accept: 'application/epub+zip, application/octet-stream, */*',
        },
        redirect: 'follow',
      });
      clearTimeout(timer);

      if (!res.ok) {
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html') && !url.includes('.epub')) {
        continue;
      }

      const arrayBuffer = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);

      // Verify buffer has valid ZIP header (PK\x03\x04)
      if (buf.length > 500 && buf[0] === 0x50 && buf[1] === 0x4b) {
        try {
          fs.writeFileSync(cachePath, buf);
        } catch (err) {
          console.warn(`[epubService] Could not write cache file:`, err);
        }
        return buf;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error(`Could not download EPUB for book ${bookId}`);
}

// ---------------------------------------------------------------------------
// Parse EPUB Structure
// ---------------------------------------------------------------------------

export async function getParsedEpub(
  bookId: number,
  metadata?: { title?: string; authors?: string[]; formats?: Record<string, string> }
): Promise<ParsedEpubBook> {
  const cached = parsedBookCache.get(bookId);
  if (cached && Date.now() - cached.ts < PARSED_TTL) {
    return cached.data;
  }

  const epubBuf = await fetchEpubBuffer(bookId, metadata?.formats);
  const zip = await JSZip.loadAsync(epubBuf);

  // 1. Locate container.xml -> OPF
  const containerEntry = zip.file('META-INF/container.xml');
  if (!containerEntry) {
    throw new Error('Invalid EPUB: META-INF/container.xml not found.');
  }
  const containerXml = await containerEntry.async('text');
  const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const containerData = xmlParser.parse(containerXml);
  const opfPath: string =
    containerData?.container?.rootfiles?.rootfile?.['@_full-path'] || 'OEBPS/content.opf';
  const opfDir = path.posix.dirname(opfPath);

  const opfEntry = zip.file(opfPath);
  if (!opfEntry) {
    throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);
  }
  const opfXml = await opfEntry.async('text');
  const opfData = xmlParser.parse(opfXml);

  const pkg = opfData.package || {};
  const manifestItemsRaw = pkg?.manifest?.item || [];
  const spineItemsRaw = pkg?.spine?.itemref || [];

  const manifestItems: any[] = Array.isArray(manifestItemsRaw)
    ? manifestItemsRaw
    : [manifestItemsRaw];
  const spineItems: any[] = Array.isArray(spineItemsRaw)
    ? spineItemsRaw
    : [spineItemsRaw];

  const manifestMap = new Map<string, any>();
  for (const item of manifestItems) {
    if (item?.['@_id']) {
      manifestMap.set(item['@_id'], item);
    }
  }

  // 2. Identify Cover
  let coverHref: string | null = null;
  // A. Meta tag: <meta name="cover" content="cover-image-id"/>
  const metaTags = Array.isArray(pkg?.metadata?.meta)
    ? pkg.metadata.meta
    : pkg?.metadata?.meta
    ? [pkg.metadata.meta]
    : [];
  const coverMeta = metaTags.find((m: any) => m?.['@_name'] === 'cover');
  if (coverMeta && manifestMap.has(coverMeta['@_content'])) {
    const item = manifestMap.get(coverMeta['@_content']);
    coverHref = path.posix.join(opfDir, item['@_href']);
  }
  // B. Manifest item with properties="cover-image"
  if (!coverHref) {
    const coverItem = manifestItems.find((it) =>
      it?.['@_properties']?.includes('cover-image')
    );
    if (coverItem) {
      coverHref = path.posix.join(opfDir, coverItem['@_href']);
    }
  }
  // C. Fallback: item with 'cover' in href and image media type
  if (!coverHref) {
    const coverItem = manifestItems.find(
      (it) =>
        it?.['@_media-type']?.startsWith('image/') &&
        it?.['@_href']?.toLowerCase().includes('cover')
    );
    if (coverItem) {
      coverHref = path.posix.join(opfDir, coverItem['@_href']);
    }
  }

  // 3. Parse Table of Contents
  const tocList: TocItem[] = [];

  // Try EPUB 3 Nav Document (manifest item with properties="nav")
  const navItem = manifestItems.find((it) =>
    it?.['@_properties']?.includes('nav')
  );
  if (navItem) {
    try {
      const navPath = path.posix.join(opfDir, navItem['@_href']);
      const navXml = (await zip.file(navPath)?.async('text')) || '';
      const navParsed = xmlParser.parse(navXml);
      // Recursively parse ol/li/a elements in nav
      const extractNavOl = (olNode: any, level = 1) => {
        if (!olNode) return;
        const lis = Array.isArray(olNode.li) ? olNode.li : olNode.li ? [olNode.li] : [];
        for (const li of lis) {
          if (li.a) {
            const title = String(li.a['#text'] || li.a || '').trim();
            const rawHref = String(li.a['@_href'] || '').trim();
            if (title && rawHref) {
              const fullHref = path.posix.normalize(
                path.posix.join(path.posix.dirname(navPath), rawHref)
              );
              tocList.push({
                id: `toc-${tocList.length + 1}`,
                title,
                level,
                href: fullHref,
              });
            }
          }
          if (li.ol) {
            extractNavOl(li.ol, level + 1);
          }
        }
      };

      const htmlBody = navParsed?.html?.body;
      const navElements = Array.isArray(htmlBody?.nav)
        ? htmlBody.nav
        : htmlBody?.nav
        ? [htmlBody.nav]
        : [];
      for (const n of navElements) {
        if (n?.ol) extractNavOl(n.ol, 1);
      }
    } catch (e) {
      console.warn(`[epubService] Could not parse nav.xhtml:`, e);
    }
  }

  // Fallback to EPUB 2 NCX
  if (tocList.length === 0) {
    const ncxItem = manifestItems.find(
      (it) => it?.['@_media-type'] === 'application/x-dtbncx+xml'
    );
    if (ncxItem) {
      try {
        const ncxPath = path.posix.join(opfDir, ncxItem['@_href']);
        const ncxXml = (await zip.file(ncxPath)?.async('text')) || '';
        const ncxParsed = xmlParser.parse(ncxXml);
        const navMap = ncxParsed?.ncx?.navMap;

        const parseNavPoints = (navPoints: any[], level = 1) => {
          for (const np of navPoints) {
            const title = String(np?.navLabel?.text || '').trim();
            const rawSrc = String(np?.content?.['@_src'] || '').trim();
            if (title && rawSrc) {
              const fullHref = path.posix.normalize(
                path.posix.join(path.posix.dirname(ncxPath), rawSrc)
              );
              tocList.push({
                id: np['@_id'] || `toc-${tocList.length + 1}`,
                title,
                level,
                href: fullHref,
              });
            }
            if (np?.navPoint) {
              const children = Array.isArray(np.navPoint) ? np.navPoint : [np.navPoint];
              parseNavPoints(children, level + 1);
            }
          }
        };

        if (navMap?.navPoint) {
          const roots = Array.isArray(navMap.navPoint) ? navMap.navPoint : [navMap.navPoint];
          parseNavPoints(roots, 1);
        }
      } catch (e) {
        console.warn(`[epubService] Could not parse toc.ncx:`, e);
      }
    }
  }

  // 4. Process Spine Items into Chapters
  const spineFiles: Array<{ id: string; title: string; zipPath: string; wordCount: number }> = [];

  for (let i = 0; i < spineItems.length; i++) {
    const idref = spineItems[i]?.['@_idref'];
    const item = manifestMap.get(idref);
    if (!item) continue;

    const zipPath = path.posix.normalize(path.posix.join(opfDir, item['@_href']));
    const fileEntry = zip.file(zipPath);
    if (!fileEntry) continue;

    const rawHtml = await fileEntry.async('text');
    const textOnly = rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = textOnly.split(' ').filter(Boolean).length;

    // Filter out Gutenberg license footers
    const isLicensePage =
      rawHtml.includes('THE FULL PROJECT GUTENBERG') ||
      rawHtml.includes('START: FULL LICENSE') ||
      rawHtml.includes('*** END OF THE PROJECT GUTENBERG') ||
      idref === 'pg-footer';

    if (isLicensePage) {
      continue;
    }

    // Filter out cover-only spine items (e.g. wrap0000.xhtml with only 1 word)
    const isCoverWrapper =
      (idref?.toLowerCase().includes('cover') || zipPath.toLowerCase().includes('cover')) &&
      words <= 20;
    if (isCoverWrapper) {
      continue;
    }

    // Extract Title:
    // 1. Match from TOC where href filename matches zipPath
    let chapterTitle = '';
    const tocMatch = tocList.find((t) => {
      const baseHref = t.href.split('#')[0];
      return baseHref === zipPath || baseHref.endsWith(path.posix.basename(zipPath));
    });
    if (tocMatch) {
      chapterTitle = tocMatch.title;
    }

    // 2. Heading tag extraction fallback (h1, h2, h3, title)
    if (!chapterTitle) {
      const hMatch = rawHtml.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
      if (hMatch) {
        chapterTitle = hMatch[1].replace(/<[^>]+>/g, '').trim();
      }
    }

    // 3. Roman / Part fallback
    if (!chapterTitle) {
      chapterTitle = i === 0 ? 'Frontispiece & Opening' : `Chapter ${spineFiles.length + 1}`;
    }

    // Clean brackets or punctuation from title
    chapterTitle = chapterTitle.replace(/[\]\[]/g, '').trim();

    spineFiles.push({
      id: idref || `ch-${i + 1}`,
      title: chapterTitle,
      zipPath,
      wordCount: words,
    });
  }

  // Map TOC entries to spine chapter IDs
  for (const t of tocList) {
    const baseHref = t.href.split('#')[0];
    const match = spineFiles.find(
      (sf) => sf.zipPath === baseHref || sf.zipPath.endsWith(path.posix.basename(baseHref))
    );
    if (match) {
      t.chapterId = match.id;
    }
  }

  // Build public chapters manifest
  const chapters: ChapterItem[] = spineFiles.map((sf, idx) => ({
    id: sf.id,
    title: sf.title,
    order: idx + 1,
    wordCount: sf.wordCount,
    href: sf.zipPath,
  }));

  // Build BookManifest
  const title = metadata?.title || pkg?.metadata?.['dc:title'] || 'Untitled Volume';
  const author = metadata?.authors || (pkg?.metadata?.['dc:creator'] ? [pkg.metadata['dc:creator']] : ['Unknown Author']);

  const manifest: BookManifest = {
    id: bookId,
    title: typeof title === 'string' ? title : String(title['#text'] || title),
    authors: Array.isArray(author) ? author : [String(author)],
    cover: coverHref ? `/api/library/book/${bookId}/asset/${coverHref}` : null,
    toc: tocList,
    chapters,
    source: 'epub',
  };

  const parsedBook: ParsedEpubBook = {
    manifest,
    spineFiles,
    zip,
  };

  parsedBookCache.set(bookId, { data: parsedBook, ts: Date.now() });
  return parsedBook;
}

// ---------------------------------------------------------------------------
// Sanitizer & Asset Rewriter for Chapter HTML
// ---------------------------------------------------------------------------

export async function getSanitizedChapterHtml(
  bookId: number,
  chapterId: string,
  bookMetadata?: { title?: string; authors?: string[]; formats?: Record<string, string> }
): Promise<{ title: string; html: string; nextChapterId: string | null; prevChapterId: string | null }> {
  const parsed = await getParsedEpub(bookId, bookMetadata);
  const chapterIdx = parsed.spineFiles.findIndex((sf) => sf.id === chapterId);
  if (chapterIdx === -1) {
    throw new Error(`Chapter "${chapterId}" not found in book ${bookId}`);
  }

  const spineItem = parsed.spineFiles[chapterIdx];
  const fileEntry = parsed.zip.file(spineItem.zipPath);
  if (!fileEntry) {
    throw new Error(`File ${spineItem.zipPath} missing inside EPUB archive.`);
  }

  let rawHtml = await fileEntry.async('text');
  const chapterDir = path.posix.dirname(spineItem.zipPath);

  // 1. Extract <body> contents
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : rawHtml;

  // 2. Rewrite Image Sources: <img src="..."> and <image href="...">
  content = content.replace(
    /(<(?:img|image)[^>]+?(?:src|xlink:href|href)=["'])([^"']+)(["'][^>]*>)/gi,
    (_full, prefix, srcUrl, suffix) => {
      // Don't rewrite absolute URLs or data URIs
      if (/^(?:https?:|\/\/|data:)/i.test(srcUrl)) {
        return `${prefix}${srcUrl}${suffix}`;
      }
      const resolved = path.posix.normalize(path.posix.join(chapterDir, srcUrl));
      const assetUrl = `/api/library/book/${bookId}/asset/${resolved}`;
      return `${prefix}${assetUrl}${suffix}`;
    }
  );

  // 3. Rewrite CSS url(...) in style attributes
  content = content.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (_full, url) => {
    if (/^(?:https?:|\/\/|data:)/i.test(url)) return _full;
    const resolved = path.posix.normalize(path.posix.join(chapterDir, url));
    return `url('/api/library/book/${bookId}/asset/${resolved}')`;
  });

  // 4. Rewrite internal chapter links: <a href="other.xhtml#anchor">
  content = content.replace(/(<a[^>]+?href=["'])([^"']+)(["'][^>]*>)/gi, (_full, prefix, href, suffix) => {
    if (/^(?:https?:|\/\/|mailto:|tel:)/i.test(href)) {
      return `${prefix}${href}${suffix}`;
    }
    // Anchor on same page: <a href="#pgepubid0001">
    if (href.startsWith('#')) {
      return `${prefix}${href}${suffix}`;
    }
    // Link to another chapter file
    const [targetFile, hash] = href.split('#');
    const resolvedTarget = path.posix.normalize(path.posix.join(chapterDir, targetFile));
    const targetChapter = parsed.spineFiles.find(
      (sf) => sf.zipPath === resolvedTarget || sf.zipPath.endsWith(path.posix.basename(resolvedTarget))
    );
    if (targetChapter) {
      const dataHref = hash ? `#chapter-${targetChapter.id}?anchor=${hash}` : `#chapter-${targetChapter.id}`;
      return `${prefix}${dataHref}" data-chapter-link="${targetChapter.id}" data-anchor="${hash || ''}${suffix}`;
    }
    return `${prefix}${href}${suffix}`;
  });

  // 5. Sanitize HTML
  const sanitized = sanitizeHtml(content, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'b', 'i', 'strong', 'em', 'strike',
      'code', 'hr', 'br', 'div', 'span', 'pre', 'blockquote', 'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'figure', 'figcaption',
      'sup', 'sub', 'small', 'dl', 'dt', 'dd', 'cite', 'abbr', 'section', 'article',
    ],
    allowedAttributes: {
      '*': ['id', 'class', 'style', 'title', 'data-chapter-link', 'data-anchor'],
      a: ['href', 'name', 'target', 'rel', 'data-chapter-link', 'data-anchor'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    },
    allowedSchemes: ['http', 'https', 'data'],
    allowProtocolRelative: false,
  });

  const prevChapter = chapterIdx > 0 ? parsed.spineFiles[chapterIdx - 1].id : null;
  const nextChapter = chapterIdx < parsed.spineFiles.length - 1 ? parsed.spineFiles[chapterIdx + 1].id : null;

  return {
    title: spineItem.title,
    html: sanitized,
    nextChapterId: nextChapter,
    prevChapterId: prevChapter,
  };
}

// ---------------------------------------------------------------------------
// Stream Asset from EPUB
// ---------------------------------------------------------------------------

export async function getAssetFromEpub(
  bookId: number,
  assetPath: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const parsed = await getParsedEpub(bookId);
  const normalized = path.posix.normalize(assetPath.replace(/^\/+/, ''));

  // Look for exact match or case-insensitive match
  let fileEntry = parsed.zip.file(normalized);
  if (!fileEntry) {
    const lower = normalized.toLowerCase();
    for (const [key, entry] of Object.entries(parsed.zip.files)) {
      if (key.toLowerCase() === lower || key.endsWith(normalized)) {
        fileEntry = entry;
        break;
      }
    }
  }

  if (!fileEntry) {
    throw new Error(`Asset "${assetPath}" not found in book ${bookId}`);
  }

  const arrayBuffer = await fileEntry.async('arraybuffer');
  const buffer = Buffer.from(arrayBuffer);

  // Determine mime type
  const ext = path.extname(normalized).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.css': 'text/css',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  return { buffer, mimeType };
}
