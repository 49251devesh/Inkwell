# Inkwell Project State

Last verified: 2026-11-13. This file is a code-grounded handoff; do not treat future roadmap items as implemented.

## Stack and versions

- React 19.0.1 + React DOM 19.0.1; TypeScript `^7.0.2`; Vite `^8.3.0`; React Router DOM `^7.18.5`.
- Node server: Express `^4.21.2`, run through tsx `^4.21.0`; port is hard-coded to 3000 in `server.ts`.
- AI: `@google/genai ^2.4.0` (installed lockfile version is 2.32.0); Dexie `^4.4.7` + dexie-react-hooks `^4.4.0`.
- UI: Tailwind CSS `^4.3.3`, `@tailwindcss/vite ^4.3.3`, Framer Motion `^14.11.1`, Motion `^12.23.24`, Lucide React `^0.546.0`.
- Other server/client libraries: dotenv `^17.2.3`, JSZip `^3.10.2`, fast-xml-parser `^5.12.0`, sanitize-html `^2.18.1`.
- No Node runtime version is pinned in the repo. `package-lock.json` and `bun.lock` are committed; package name is still `react-example`.

## Folder map

- `server.ts` — Express API, AI routes, Gutenberg proxy, SSE chat, Vite/static hosting.
- `server/ai/types.ts` — provider interface, request metadata, normalized error types.
- `server/ai/providers.ts` — Gemini, OpenRouter, Ollama, and offline provider implementations.
- `server/ai/index.ts` — provider selection and one-hour OpenRouter free-model catalog cache.
- `server/ai/errors.ts` — friendly AI error normalization and timeout helpers.
- `package.json` — scripts and dependency declarations.
- `vite.config.ts` — React/Tailwind Vite configuration.
- `tsconfig.json` — TypeScript compiler configuration.
- `src/main.tsx` — browser entry point and global CSS import.
- `src/App.tsx` — providers, shell, animated route table, fallback redirect.
- `src/index.css` — complete Inkwell tokens, typography, themes, paper/ink effects.
- `src/types/inkwell.ts` — Project, Chapter, Character, world, session, and settings types.
- `src/store/inkwellStore.tsx` — React context CRUD store and localStorage persistence.
- `src/lib/seedData.ts` — sample library seed data.
- `src/lib/aiService.ts` — client boundary for provider-backed editorial actions.
- `src/lib/aiClient.ts` — browser-only AI settings/key storage and request headers.
- `src/components/layout/AISettingsDialog.tsx` — Settings > AI provider/model/BYOK panel.
- `src/lib/readingRoomDb.ts` — Dexie schema for Reading Room IndexedDB.
- `src/server/epubService.ts` — EPUB fetch/cache, parse, sanitize, manifest/chapter/assets.
- `src/pages/DeskPage.tsx` — project/chapter editor, autosave, AI panels, focus mode.
- `src/pages/LibraryPage.tsx` — project shelf and JSON import/export.
- `src/pages/ManuscriptsPage.tsx` — project/chapter management.
- `src/pages/CharacterStudioPage.tsx` — dossiers and relationship graph.
- `src/pages/WorldBuilderPage.tsx` — locations, lore, timeline.
- `src/pages/AnalyticsPage.tsx` — writing metrics and session ledger.
- `src/pages/ReadingRoomPage.tsx` — Gutendex browsing, EPUB/text reader, offline caches.
- `src/components/` — feature UI grouped by analytics, characters, desk, layout, library, world.
- `public/` — static public assets (currently minimal).

## Routes

- `/` Library; `/desk` Desk using active project; `/desk/:projectId` Desk for a project.
- `/projects` Manuscripts; `/characters` Character Studio; `/world` World Builder; `/analytics` Analytics.
- `/reading-room` Reading Room; unknown paths redirect to `/`.
- AI APIs: `GET /api/ai/providers`, `GET /api/ai/models?provider=`, `POST /api/ai/test`, `POST /api/ai/assist`.

## Data model and persistence

- `InkwellStoreData` contains `version`, `projects`, `chapters`, `characters`, `locations`, `lore`, `timeline`, `sessions`, and `settings`.
- Projects own chapters, characters, locations, lore, and timeline entries through `projectId`; sessions track date, words, and minutes.
- Main studio data persists atomically in browser localStorage key `inkwell_studio_v1`; theme cache is `inkwell_theme`; Desk AI mode is `inkwell_ai_mode`.
- AI settings persist in browser localStorage key `inkwell_ai_settings` as `activeProvider` plus separate Gemini, OpenRouter, Ollama, and offline records; legacy single-key data migrates on read.
- `ReadingRoomDatabase` is IndexedDB database `InkwellReadingRoom`, Dexie schema v3: favorites, readingProgress, readerSettings, cachedManifests, cachedChapters, cachedCategoryResults.
- Server EPUB files are cached on disk at `.cache/library`; parsed EPUBs and Gutenberg API results use in-memory TTL caches. There is no database or auth.

## API endpoints

- `POST /api/generate-character-map` — Gemini character extraction when configured, deterministic story extractor fallback.
- `POST /api/chat` — SSE literary chat; Gemini streaming when configured, offline editorial fallback otherwise.
- `GET /api/library/search?q=`; `GET /api/library/book/:id`; `GET /api/library/book/:id/manifest`.
- `GET /api/library/book/:id/chapter/:chapterId`; `GET /api/library/book/:id/asset/*`; `GET /api/library/text/:id`.
- `GET /api/library/browse`; `GET /api/library/popular`; `GET /api/library/random`; `GET /api/library/author?name=`; `GET /api/library/cover/:id`.
- Library endpoints proxy Gutendex/Project Gutenberg; API responses are not persisted server-side beyond caches.

## Environment and commands

- Variable names used: `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENROUTER_API_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `PORT`, `APP_URL` (documented example; `APP_URL` is not read by current source), `NODE_ENV`, `DISABLE_HMR`.
- Never commit or copy values from `.env`; use `.env.example` as the name-only template.
- Install: `npm install`. Develop: `npm run dev` (serves `http://localhost:3000`). Start aliases dev: `npm start`.
- Validate types: `npm run lint`. Build: `npm run build`. Preview built client: `npm run preview` (not the API server).
- There is no test script and no repository test suite. `npm run clean` is Unix-specific (`rm -rf`).

## Conventions and current state

- Design system is archival/bookmaking: paper, iron-gall ink, burgundy, walnut, antique brass; daylight and midnight themes use CSS semantic tokens.
- Keep Fraunces for display, EB Garamond for manuscript prose, IBM Plex Mono for ledgers/numerals. Do not add colors or fonts; reuse existing tokens and classes.
- Preserve zero-pill, small-caps, folio, ornament, paper-card, and reduced-motion conventions. Prefer existing Lucide icons and shared ornaments/dialogs.
- One commit per step; keep changes focused and update this file when architecture/status changes.

### Done

- Local writing studio CRUD, project/chapter editor with debounced autosave, themes, JSON import/export, character/worldbuilding tools, analytics, and Reading Room UI are implemented.
- Reading Room has Gutendex proxying, EPUB parsing/sanitization, chapter navigation, favorites/progress/settings/cache persistence, and text fallback.
- Server Gemini integration exists for character-map generation and streaming chat, both with deterministic/offline fallbacks.

### In progress

- AI provider layer now covers chat, character-map generation, and margin assistance; live provider validation remains environment-dependent.
- Reading Room is the only feature using IndexedDB; the main studio and AI settings still use localStorage.

### Known bugs / maintenance

- Production build passes, but Vite warns that `vite.config.ts` uses `__dirname` with the future native config loader and warns about a >500 kB minified JS chunk.
- No automated tests or pinned Node version; `npm run clean` assumes Unix shell. `package.json` retains the starter name `react-example`.
- `APP_URL` is present in `.env.example` but unused; server defaults to port 3000 and honors `PORT`. Server-side API behavior depends on external Gutendex/Gutenberg availability.
- Browser BYOK keys live only in `inkwell_ai_settings`; they are sent in `x-inkwell-ai-key` and are not logged, persisted, or echoed by the server. `.env` is used only when no browser key is sent.

## Roadmap

- M1 — AI provider layer: Gemini, OpenRouter free, bring-your-own-key. Provider layer is implemented; live provider validation remains environment-dependent.
- M2 — Story memory.
- M3 — Automatic character detection.
- M4 — IndexedDB storage layer.
- M5 — Auth + Postgres.
- M6 — Docker.
- M7 — Kubernetes.
- M8 — Monetization.
- M9 — Posters.
- M10 — ML model.
