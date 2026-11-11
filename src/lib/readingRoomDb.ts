/**
 * readingRoomDb.ts
 * Dexie-based IndexedDB schema for The Reading Room folio only.
 * This module NEVER touches the existing localStorage key `inkwell_studio_v1`
 * or any other inkwellStore data.
 */

import Dexie, { type Table } from 'dexie';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FavoriteBook {
  id: number;          // Gutendex / Project Gutenberg book ID
  title: string;
  authors: string[];
  subjects: string[];
  coverUrl: string;
  language: string[];
  textUrl: string;
  addedAt: number;     // Date.now() epoch ms
}

export interface ReadingProgress {
  bookId: number;        // primary key — one row per book
  chapterIndex: number;  // 0-based chapter index last visited
  scrollPosition: number; // scrollTop in pixels
  updatedAt: number;     // Date.now() epoch ms
}

export interface ReaderSettings {
  id: 'default';         // singleton row
  fontSize: number;      // 14–24 (px)
  lineWidth: 'narrow' | 'medium' | 'wide';
}

// ---------------------------------------------------------------------------
// Database class
// ---------------------------------------------------------------------------

class ReadingRoomDatabase extends Dexie {
  favorites!: Table<FavoriteBook, number>;
  readingProgress!: Table<ReadingProgress, number>;
  readerSettings!: Table<ReaderSettings, string>;

  constructor() {
    super('InkwellReadingRoom');

    this.version(1).stores({
      favorites: 'id, addedAt',
      readingProgress: 'bookId, updatedAt',
      readerSettings: 'id',
    });
  }
}

export const readingRoomDb = new ReadingRoomDatabase();

// ---------------------------------------------------------------------------
// Helper: seed default reader settings on first open
// ---------------------------------------------------------------------------

readingRoomDb.on('ready', async () => {
  const existing = await readingRoomDb.readerSettings.get('default');
  if (!existing) {
    await readingRoomDb.readerSettings.add({
      id: 'default',
      fontSize: 18,
      lineWidth: 'medium',
    });
  }
});

