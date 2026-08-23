import { Injectable, signal } from '@angular/core';
import { Story } from '../models/story';
import { StoryExercise } from '../models/story-exercise';
import {
  StoryExerciseHistoryEntry,
  StoryExerciseResult,
} from '../models/story-exercise-history';

const STORAGE_KEY = 'german-dictionary-story-exercise-history';

@Injectable({ providedIn: 'root' })
export class StoryExerciseHistoryService {
  readonly entries = signal<StoryExerciseHistoryEntry[]>(this.load());

  getForStory(storyId: string): StoryExerciseHistoryEntry[] {
    return this.entries()
      .filter((e) => e.storyId === storyId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  getEntryById(id: string): StoryExerciseHistoryEntry | undefined {
    return this.entries().find((e) => e.id === id);
  }

  /** Creates a history entry and persists it. */
  addSession(
    story: Story,
    exercises: StoryExercise[],
    results: StoryExerciseResult[]
  ): void {
    const answered = results.filter((r) => r.answered);
    const totalCount = exercises.length;
    const correctCount = answered.filter((r) => r.correct).length;

    const entry: StoryExerciseHistoryEntry = {
      id: crypto.randomUUID(),
      storyId: story.id,
      storyTitle: story.title,
      level: story.level,
      completedAt: new Date().toISOString(),
      exercises: exercises.map((e) => ({ ...e })),
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

  private load(): StoryExerciseHistoryEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoryExerciseHistoryEntry[];
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
      console.warn('Failed to persist story exercise history.', err);
    }
  }
}