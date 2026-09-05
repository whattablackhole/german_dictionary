import { Injectable, signal } from '@angular/core';
import { Story } from '../models/story';
import { StoryCloze } from '../models/story-cloze';
import {
  StoryClozeHistoryEntry,
  StoryClozeResult,
} from '../models/story-cloze-history';

const STORAGE_KEY = 'german-dictionary-story-cloze-history';

@Injectable({ providedIn: 'root' })
export class StoryClozeHistoryService {
  readonly entries = signal<StoryClozeHistoryEntry[]>(this.load());

  getForStory(storyId: string): StoryClozeHistoryEntry[] {
    return this.entries()
      .filter((e) => e.storyId === storyId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  getEntryById(id: string): StoryClozeHistoryEntry | undefined {
    return this.entries().find((e) => e.id === id);
  }

  /** Creates a history entry and persists it. */
  addSession(
    story: Story,
    cloze: StoryCloze,
    results: StoryClozeResult[]
  ): void {
    const answered = results.filter((r) => r.answered);
    const totalCount = results.length;
    const correctCount = answered.filter((r) => r.correct).length;

    const entry: StoryClozeHistoryEntry = {
      id: crypto.randomUUID(),
      storyId: story.id,
      storyTitle: story.title,
      level: story.level,
      completedAt: new Date().toISOString(),
      cloze: {
        id: cloze.id,
        storyId: cloze.storyId,
        sentences: cloze.sentences.map((s) => ({ ...s, removedWords: [...s.removedWords] })),
      },
      results: results.map((r) => ({ ...r })),
      correctCount,
      totalCount,
      scorePercent:
        totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100),
    };

    this.entries.update((list) => [entry, ...list]);
    this.save();
  }

  deleteEntry(id: string): void {
    this.entries.update((list) => list.filter((e) => e.id !== id));
    this.save();
  }

  /** Clears all saved entries for a story (used when a story is deleted). */
  deleteForStory(storyId: string): void {
    this.entries.update((list) => list.filter((e) => e.storyId !== storyId));
    this.save();
  }

  private load(): StoryClozeHistoryEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoryClozeHistoryEntry[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries()));
    } catch (err) {
      console.warn('Failed to persist story cloze history.', err);
    }
  }
}