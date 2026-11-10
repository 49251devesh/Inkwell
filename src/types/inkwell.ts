export type StudioTheme = 'daylight' | 'midnight';

export type CoverPaletteId =
  | 'burgundy-morocco'
  | 'midnight-indigo'
  | 'forest-buckram'
  | 'ochre-linen'
  | 'charcoal-calfskin';

export interface CoverPalette {
  id: CoverPaletteId;
  name: string;
  clothHex: string;
  spineHex: string;
  foilHex: string;
  ribbonHex: string;
  accentHex: string;
}

export interface Chapter {
  id: string;
  projectId: string;
  order: number;
  title: string;
  content: string; // Plain text / paragraphs separated by double newlines
  notes: string;
  wordCount: number;
  updatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  genre: string;
  synopsis: string;
  coverPalette: CoverPaletteId;
  wordGoal: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedChapterId?: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  role: string;
  traits: string[];
  motivation: string;
  arc: string;
  relationships: string;
  notes: string;
}

export interface WorldLocation {
  id: string;
  projectId: string;
  name: string;
  region: string;
  atmosphere: string;
  description: string;
  mapX: number; // 0..100 normalized coordinates for hand-drawn atlas
  mapY: number;
}

export interface LoreEntry {
  id: string;
  projectId: string;
  title: string;
  category: string;
  summary: string;
}

export interface TimelineEvent {
  id: string;
  projectId: string;
  era: string;
  title: string;
  description: string;
  order: number;
}

export interface WritingSession {
  id: string;
  date: string; // YYYY-MM-DD
  projectId: string;
  wordsWritten: number;
  minutesSpent: number;
}

export interface StudioSettings {
  theme: StudioTheme;
  authorPenName: string;
  dailyWordGoal: number;
  focusModeEnabled: boolean;
}

export interface InkwellStoreData {
  version: number;
  projects: Project[];
  chapters: Chapter[];
  characters: Character[];
  locations: WorldLocation[];
  lore: LoreEntry[];
  timeline: TimelineEvent[];
  sessions: WritingSession[];
  settings: StudioSettings;
}

export interface LiteraryEpigraph {
  quote: string;
  author: string;
  work: string;
}
