import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Chapter,
  Character,
  CoverPaletteId,
  InkwellStoreData,
  LoreEntry,
  Project,
  StudioTheme,
  StudioSettings,
  TimelineEvent,
  WorldLocation,
} from '../types/inkwell';
import { createSeedData } from '../lib/seedData';
import { countWords, toRoman } from '../lib/formatters';

const STORAGE_KEY = 'inkwell_studio_v1';
const THEME_CACHE_KEY = 'inkwell_theme';

interface CreateProjectInput {
  title: string;
  subtitle?: string;
  genre: string;
  synopsis: string;
  coverPalette: CoverPaletteId;
  wordGoal: number;
  author?: string;
}

interface InkwellContextValue {
  data: InkwellStoreData;
  activeProject: Project | null;
  setTheme: (theme: StudioTheme) => void;
  toggleTheme: () => StudioTheme;
  updateSettings: (patch: Partial<StudioSettings>) => void;
  createProject: (input: CreateProjectInput) => Project;
  updateProject: (projectId: string, patch: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  selectActiveProject: (projectId: string) => void;
  getProjectChapters: (projectId: string) => Chapter[];
  getProjectWordCount: (projectId: string) => number;
  getTotalWords: () => number;
  getRecentChapters: (limit?: number) => Array<Chapter & { projectTitle: string; projectGenre: string }>;
  updateChapter: (chapterId: string, patch: Partial<Chapter>) => void;
  createChapter: (projectId: string, title?: string) => Chapter;
  deleteChapter: (chapterId: string) => void;
  reorderChapters: (projectId: string, chapterIds: string[]) => void;
  recordWritingSession: (projectId: string, wordsDelta: number) => void;
  exportLibraryJson: () => string;
  importLibraryJson: (rawJson: string) => { ok: true } | { ok: false; error: string };
  resetToSampleLibrary: () => void;

  // Character Studio
  createCharacter: (input: Omit<Character, 'id'>) => Character;
  updateCharacter: (id: string, patch: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;
  getProjectCharacters: (projectId: string) => Character[];

  // World Builder: Locations
  createLocation: (input: Omit<WorldLocation, 'id'>) => WorldLocation;
  updateLocation: (id: string, patch: Partial<WorldLocation>) => void;
  deleteLocation: (id: string) => void;
  getProjectLocations: (projectId: string) => WorldLocation[];

  // World Builder: Lore
  createLore: (input: Omit<LoreEntry, 'id'>) => LoreEntry;
  updateLore: (id: string, patch: Partial<LoreEntry>) => void;
  deleteLore: (id: string) => void;
  getProjectLore: (projectId: string) => LoreEntry[];

  // World Builder: Timeline
  createTimelineEvent: (input: Omit<TimelineEvent, 'id'>) => TimelineEvent;
  updateTimelineEvent: (id: string, patch: Partial<TimelineEvent>) => void;
  deleteTimelineEvent: (id: string) => void;
  reorderTimeline: (projectId: string, eventIds: string[]) => void;
  getProjectTimeline: (projectId: string) => TimelineEvent[];
}

const InkwellContext = createContext<InkwellContextValue | null>(null);

function loadInitialStore(): InkwellStoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<InkwellStoreData>;
      if (
        parsed &&
        typeof parsed.version === 'number' &&
        Array.isArray(parsed.projects) &&
        parsed.projects.length > 0 &&
        Array.isArray(parsed.chapters) &&
        parsed.chapters.length > 0 &&
        parsed.settings
      ) {
        const seed = createSeedData();
        return {
          version: 1,
          projects: parsed.projects,
          chapters: parsed.chapters,
          characters: Array.isArray(parsed.characters) ? parsed.characters : seed.characters,
          locations: Array.isArray(parsed.locations) ? parsed.locations : seed.locations,
          lore: Array.isArray(parsed.lore) ? parsed.lore : seed.lore,
          timeline: Array.isArray(parsed.timeline) ? parsed.timeline : seed.timeline,
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : seed.sessions,
          settings: {
            ...seed.settings,
            ...parsed.settings,
          },
        };
      }
    }
  } catch {
    // Fall back to fresh literary seed data
  }
  return createSeedData();
}

export const InkwellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<InkwellStoreData>(() => loadInitialStore());
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const initial = loadInitialStore();
    const sorted = [...initial.projects].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return sorted[0]?.id ?? '';
  });

  // Persist entire store atomically on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(THEME_CACHE_KEY, data.settings.theme);
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [data]);

  // Synchronize root .dark class with theme state
  useEffect(() => {
    const root = document.documentElement;
    if (data.settings.theme === 'midnight') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [data.settings.theme]);

  const setTheme = useCallback((theme: StudioTheme) => {
    setData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme,
      },
    }));
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: StudioTheme = data.settings.theme === 'daylight' ? 'midnight' : 'daylight';
    setTheme(nextTheme);
    return nextTheme;
  }, [data.settings.theme, setTheme]);

  const updateSettings = useCallback((patch: Partial<StudioSettings>) => {
    setData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...patch,
      },
    }));
  }, []);

  const createProject = useCallback(
    (input: CreateProjectInput): Project => {
      const nowIso = new Date().toISOString();
      const projectId = `proj-${Date.now().toString(36)}`;
      const firstChapterId = `ch-${Date.now().toString(36)}`;

      const openingLine = '';
      const firstChapter: Chapter = {
        id: firstChapterId,
        projectId,
        order: 1,
        title: 'Opening Folio',
        content: openingLine,
        notes: 'Initial blank folio bound into the volume.',
        wordCount: countWords(openingLine),
        updatedAt: nowIso,
      };

      const newProject: Project = {
        id: projectId,
        title: input.title.trim(),
        subtitle: input.subtitle?.trim() || undefined,
        author: input.author?.trim() || data.settings.authorPenName,
        genre: input.genre.trim(),
        synopsis: input.synopsis.trim(),
        coverPalette: input.coverPalette,
        wordGoal: input.wordGoal,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastOpenedChapterId: firstChapterId,
      };

      setData((prev) => ({
        ...prev,
        projects: [newProject, ...prev.projects],
        chapters: [...prev.chapters, firstChapter],
      }));
      setActiveProjectId(projectId);
      return newProject;
    },
    [data.settings.authorPenName]
  );

  const updateProject = useCallback((projectId: string, patch: Partial<Project>) => {
    setData((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === projectId ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
      ),
    }));
  }, []);

  const deleteProject = useCallback(
    (projectId: string) => {
      setData((prev) => ({
        ...prev,
        projects: prev.projects.filter((p) => p.id !== projectId),
        chapters: prev.chapters.filter((c) => c.projectId !== projectId),
        characters: prev.characters.filter((c) => c.projectId !== projectId),
        locations: prev.locations.filter((l) => l.projectId !== projectId),
        lore: prev.lore.filter((l) => l.projectId !== projectId),
        timeline: prev.timeline.filter((t) => t.projectId !== projectId),
      }));
      if (activeProjectId === projectId) {
        setActiveProjectId('');
      }
    },
    [activeProjectId]
  );

  const selectActiveProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
  }, []);

  const getProjectChapters = useCallback(
    (projectId: string) =>
      data.chapters
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => a.order - b.order),
    [data.chapters]
  );

  const getProjectWordCount = useCallback(
    (projectId: string) =>
      data.chapters
        .filter((c) => c.projectId === projectId)
        .reduce((sum, ch) => sum + ch.wordCount, 0),
    [data.chapters]
  );

  const getTotalWords = useCallback(
    () => data.chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
    [data.chapters]
  );

  const getRecentChapters = useCallback(
    (limit = 6) => {
      const projectMap = new Map(data.projects.map((p) => [p.id, p]));
      return [...data.chapters]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, limit)
        .map((ch) => {
          const parent = projectMap.get(ch.projectId);
          return {
            ...ch,
            projectTitle: parent?.title ?? 'Untitled Volume',
            projectGenre: parent?.genre ?? 'Manuscript',
          };
        });
    },
    [data.chapters, data.projects]
  );

  const updateChapter = useCallback(
    (chapterId: string, patch: Partial<Chapter>) => {
      const nowIso = new Date().toISOString();
      setData((prev) => {
        let parentProjectId = '';
        const updatedChapters = prev.chapters.map((ch) => {
          if (ch.id === chapterId) {
            parentProjectId = ch.projectId;
            const updatedContent = patch.content !== undefined ? patch.content : ch.content;
            const updatedWordCount =
              patch.wordCount !== undefined ? patch.wordCount : countWords(updatedContent);
            return {
              ...ch,
              ...patch,
              content: updatedContent,
              wordCount: updatedWordCount,
              updatedAt: nowIso,
            };
          }
          return ch;
        });

        const updatedProjects = prev.projects.map((proj) => {
          if (proj.id === parentProjectId) {
            return {
              ...proj,
              updatedAt: nowIso,
              lastOpenedChapterId: chapterId,
            };
          }
          return proj;
        });

        return {
          ...prev,
          chapters: updatedChapters,
          projects: updatedProjects,
        };
      });
    },
    []
  );

  const createChapter = useCallback(
    (projectId: string, title?: string): Chapter => {
      const nowIso = new Date().toISOString();
      const existing = data.chapters.filter((c) => c.projectId === projectId);
      const nextOrder = existing.length > 0 ? Math.max(...existing.map((c) => c.order)) + 1 : 1;
      const chapterId = `ch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const chapterTitle = title?.trim() || `Chapter ${toRoman(nextOrder)}`;

      const newChapter: Chapter = {
        id: chapterId,
        projectId,
        order: nextOrder,
        title: chapterTitle,
        content: '',
        notes: '',
        wordCount: 0,
        updatedAt: nowIso,
      };

      setData((prev) => ({
        ...prev,
        chapters: [...prev.chapters, newChapter],
        projects: prev.projects.map((p) =>
          p.id === projectId
            ? { ...p, updatedAt: nowIso, lastOpenedChapterId: chapterId }
            : p
        ),
      }));

      return newChapter;
    },
    [data.chapters]
  );

  const deleteChapter = useCallback((chapterId: string) => {
    setData((prev) => {
      const target = prev.chapters.find((c) => c.id === chapterId);
      if (!target) return prev;
      const filtered = prev.chapters.filter((c) => c.id !== chapterId);
      let count = 1;
      const renumbered = filtered.map((c) => {
        if (c.projectId === target.projectId) {
          return { ...c, order: count++ };
        }
        return c;
      });
      return {
        ...prev,
        chapters: renumbered,
      };
    });
  }, []);

  const reorderChapters = useCallback((projectId: string, chapterIds: string[]) => {
    setData((prev) => {
      const idOrderMap = new Map(chapterIds.map((id, index) => [id, index + 1]));
      const updated = prev.chapters.map((ch) => {
        if (ch.projectId === projectId && idOrderMap.has(ch.id)) {
          return { ...ch, order: idOrderMap.get(ch.id)! };
        }
        return ch;
      });
      return {
        ...prev,
        chapters: updated,
      };
    });
  }, []);

  const recordWritingSession = useCallback((projectId: string, wordsDelta: number) => {
    if (wordsDelta <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    setData((prev) => {
      const sessionIndex = prev.sessions.findIndex(
        (s) => s.date === today && s.projectId === projectId
      );
      if (sessionIndex >= 0) {
        const updated = [...prev.sessions];
        updated[sessionIndex] = {
          ...updated[sessionIndex],
          wordsWritten: updated[sessionIndex].wordsWritten + wordsDelta,
        };
        return { ...prev, sessions: updated };
      }
      const newSession = {
        id: `sess-${Date.now().toString(36)}`,
        date: today,
        projectId,
        wordsWritten: wordsDelta,
        minutesSpent: 1,
      };
      return { ...prev, sessions: [newSession, ...prev.sessions] };
    });
  }, []);

  const exportLibraryJson = useCallback(() => {
    return JSON.stringify(data, null, 2);
  }, [data]);

  const importLibraryJson = useCallback(
    (rawJson: string): { ok: true } | { ok: false; error: string } => {
      try {
        const parsed = JSON.parse(rawJson) as Partial<InkwellStoreData>;
        if (
          !parsed ||
          typeof parsed.version !== 'number' ||
          !Array.isArray(parsed.projects) ||
          !Array.isArray(parsed.chapters) ||
          !parsed.settings
        ) {
          return {
            ok: false,
            error: 'This archive file does not match the Inkwell manuscript schema.',
          };
        }
        const seed = createSeedData();
        const sanitized: InkwellStoreData = {
          version: 1,
          projects: parsed.projects,
          chapters: parsed.chapters,
          characters: Array.isArray(parsed.characters) ? parsed.characters : [],
          locations: Array.isArray(parsed.locations) ? parsed.locations : [],
          lore: Array.isArray(parsed.lore) ? parsed.lore : [],
          timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
          settings: {
            ...seed.settings,
            ...parsed.settings,
          },
        };
        setData(sanitized);
        setActiveProjectId(sanitized.projects[0]?.id ?? '');
        return { ok: true };
      } catch {
        return {
          ok: false,
          error: 'Could not parse JSON. Ensure the file is a valid Inkwell archive.',
        };
      }
    },
    []
  );

  const createCharacter = useCallback((input: Omit<Character, 'id'>): Character => {
    const id = `char-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newChar: Character = { id, ...input };
    setData((prev) => ({ ...prev, characters: [newChar, ...prev.characters] }));
    return newChar;
  }, []);

  const updateCharacter = useCallback((id: string, patch: Partial<Character>) => {
    setData((prev) => ({
      ...prev,
      characters: prev.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const deleteCharacter = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      characters: prev.characters.filter((c) => c.id !== id),
    }));
  }, []);

  const getProjectCharacters = useCallback(
    (projectId: string) => data.characters.filter((c) => c.projectId === projectId),
    [data.characters]
  );

  const createLocation = useCallback((input: Omit<WorldLocation, 'id'>): WorldLocation => {
    const id = `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newLoc: WorldLocation = { id, ...input };
    setData((prev) => ({ ...prev, locations: [newLoc, ...prev.locations] }));
    return newLoc;
  }, []);

  const updateLocation = useCallback((id: string, patch: Partial<WorldLocation>) => {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }, []);

  const deleteLocation = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.filter((l) => l.id !== id),
    }));
  }, []);

  const getProjectLocations = useCallback(
    (projectId: string) => data.locations.filter((l) => l.projectId === projectId),
    [data.locations]
  );

  const createLore = useCallback((input: Omit<LoreEntry, 'id'>): LoreEntry => {
    const id = `lore-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newLore: LoreEntry = { id, ...input };
    setData((prev) => ({ ...prev, lore: [newLore, ...prev.lore] }));
    return newLore;
  }, []);

  const updateLore = useCallback((id: string, patch: Partial<LoreEntry>) => {
    setData((prev) => ({
      ...prev,
      lore: prev.lore.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }, []);

  const deleteLore = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      lore: prev.lore.filter((l) => l.id !== id),
    }));
  }, []);

  const getProjectLore = useCallback(
    (projectId: string) => data.lore.filter((l) => l.projectId === projectId),
    [data.lore]
  );

  const createTimelineEvent = useCallback((input: Omit<TimelineEvent, 'id'>): TimelineEvent => {
    const id = `tl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newTl: TimelineEvent = { id, ...input };
    setData((prev) => ({ ...prev, timeline: [...prev.timeline, newTl] }));
    return newTl;
  }, []);

  const updateTimelineEvent = useCallback((id: string, patch: Partial<TimelineEvent>) => {
    setData((prev) => ({
      ...prev,
      timeline: prev.timeline.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);

  const deleteTimelineEvent = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((t) => t.id !== id),
    }));
  }, []);

  const reorderTimeline = useCallback((projectId: string, eventIds: string[]) => {
    setData((prev) => {
      const idOrderMap = new Map(eventIds.map((id, index) => [id, index + 1]));
      const updated = prev.timeline.map((item) => {
        if (item.projectId === projectId && idOrderMap.has(item.id)) {
          return { ...item, order: idOrderMap.get(item.id)! };
        }
        return item;
      });
      return { ...prev, timeline: updated };
    });
  }, []);

  const getProjectTimeline = useCallback(
    (projectId: string) =>
      data.timeline.filter((t) => t.projectId === projectId).sort((a, b) => a.order - b.order),
    [data.timeline]
  );

  const resetToSampleLibrary = useCallback(() => {
    const fresh = createSeedData();
    setData(fresh);
    setActiveProjectId(fresh.projects[0]?.id ?? '');
  }, []);

  const activeProject = useMemo(() => {
    if (data.projects.length === 0) return null;
    const found = data.projects.find((p) => p.id === activeProjectId);
    if (found) return found;
    return [...data.projects].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  }, [activeProjectId, data.projects]);

  const value = useMemo<InkwellContextValue>(
    () => ({
      data,
      activeProject,
      setTheme,
      toggleTheme,
      updateSettings,
      createProject,
      updateProject,
      deleteProject,
      selectActiveProject,
      getProjectChapters,
      getProjectWordCount,
      getTotalWords,
      getRecentChapters,
      updateChapter,
      createChapter,
      deleteChapter,
      reorderChapters,
      recordWritingSession,
      exportLibraryJson,
      importLibraryJson,
      resetToSampleLibrary,
      createCharacter,
      updateCharacter,
      deleteCharacter,
      getProjectCharacters,
      createLocation,
      updateLocation,
      deleteLocation,
      getProjectLocations,
      createLore,
      updateLore,
      deleteLore,
      getProjectLore,
      createTimelineEvent,
      updateTimelineEvent,
      deleteTimelineEvent,
      reorderTimeline,
      getProjectTimeline,
    }),
    [
      data,
      activeProject,
      setTheme,
      toggleTheme,
      updateSettings,
      createProject,
      updateProject,
      deleteProject,
      selectActiveProject,
      getProjectChapters,
      getProjectWordCount,
      getTotalWords,
      getRecentChapters,
      updateChapter,
      createChapter,
      deleteChapter,
      reorderChapters,
      recordWritingSession,
      exportLibraryJson,
      importLibraryJson,
      resetToSampleLibrary,
      createCharacter,
      updateCharacter,
      deleteCharacter,
      getProjectCharacters,
      createLocation,
      updateLocation,
      deleteLocation,
      getProjectLocations,
      createLore,
      updateLore,
      deleteLore,
      getProjectLore,
      createTimelineEvent,
      updateTimelineEvent,
      deleteTimelineEvent,
      reorderTimeline,
      getProjectTimeline,
    ]
  );

  return <InkwellContext.Provider value={value}>{children}</InkwellContext.Provider>;
};

export function useInkwell(): InkwellContextValue {
  const ctx = useContext(InkwellContext);
  if (!ctx) {
    throw new Error('useInkwell must be used inside InkwellProvider');
  }
  return ctx;
}
