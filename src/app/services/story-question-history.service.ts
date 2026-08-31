import { Injectable, signal } from '@angular/core';
import { Story } from '../models/story';
import { StoryQuestion } from '../models/story-question';
import {
  StoryQuestionHistoryEntry,
  StoryQuestionResult,
} from '../models/story-question-history';

const STORAGE_KEY = 'german-dictionary-story-question-history';

@Injectable({ providedIn: 'root' })
export class StoryQuestionHistoryService {
  readonly entries = signal<StoryQuestionHistoryEntry[]>(this.load());

  getForStory(storyId: string): StoryQuestionHistoryEntry[] {
    return this.entries()
      .filter((e) => e.storyId === storyId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  getEntryById(id: string): StoryQuestionHistoryEntry | undefined {
    return this.entries().find((e) => e.id === id);
  }

  /** Creates a history entry and persists it. */
  addSession(
    story: Story,
    questions: StoryQuestion[],
    results: StoryQuestionResult[]
  ): void {
    const answered = results.filter((r) => r.answered);
    const totalCount = questions.length;
    const correctCount = answered.filter((r) => r.correct).length;

    const entry: StoryQuestionHistoryEntry = {
      id: crypto.randomUUID(),
      storyId: story.id,
      storyTitle: story.title,
      level: story.level,
      completedAt: new Date().toISOString(),
      questions: questions.map((q) => ({ ...q })),
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

  private load(): StoryQuestionHistoryEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoryQuestionHistoryEntry[];
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
      console.warn('Failed to persist story question history.', err);
    }
  }
}