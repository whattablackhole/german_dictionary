import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SentenceNotesService {
  private readonly STORAGE_PREFIX = 'sentence-note-';

  private notesCache = signal<Map<string, string>>(new Map());

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const cache = new Map<string, string>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.STORAGE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            cache.set(key, value);
          }
        }
      }
    } catch {
      // ignore storage errors
    }
    this.notesCache.set(cache);
  }

  private makeKey(storyId: string, sentenceText: string): string {
    const hash = this.hashString(sentenceText);
    return `${this.STORAGE_PREFIX}${storyId}-${hash}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  getNote(storyId: string, sentenceText: string): string | null {
    const key = this.makeKey(storyId, sentenceText);
    return this.notesCache().get(key) ?? null;
  }

  setNote(storyId: string, sentenceText: string, note: string): void {
    const key = this.makeKey(storyId, sentenceText);
    const trimmed = note.trim();

    const cache = new Map(this.notesCache());
    if (trimmed) {
      cache.set(key, trimmed);
      localStorage.setItem(key, trimmed);
    } else {
      cache.delete(key);
      localStorage.removeItem(key);
    }
    this.notesCache.set(cache);
  }

  deleteNote(storyId: string, sentenceText: string): void {
    const key = this.makeKey(storyId, sentenceText);
    const cache = new Map(this.notesCache());
    cache.delete(key);
    localStorage.removeItem(key);
    this.notesCache.set(cache);
  }

  hasNote(storyId: string, sentenceText: string): boolean {
    const key = this.makeKey(storyId, sentenceText);
    return this.notesCache().has(key);
  }

  getAllNotesForStory(storyId: string): Map<string, string> {
    const prefix = `${this.STORAGE_PREFIX}${storyId}-`;
    const result = new Map<string, string>();
    for (const [key, value] of this.notesCache()) {
      if (key.startsWith(prefix)) {
        const hash = key.slice(prefix.length);
        result.set(hash, value);
      }
    }
    return result;
  }

  clearStoryNotes(storyId: string): void {
    const prefix = `${this.STORAGE_PREFIX}${storyId}-`;
    const cache = new Map(this.notesCache());
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
        localStorage.removeItem(key);
      }
    }
    this.notesCache.set(cache);
  }
}