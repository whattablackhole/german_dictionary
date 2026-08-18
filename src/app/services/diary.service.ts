import { Injectable, signal } from '@angular/core';
import { DiaryEntry, DiaryFeedback } from '../models/diary';

const STORAGE_KEY = 'german-dictionary-diary';

@Injectable({ providedIn: 'root' })
export class DiaryService {
  readonly entries = signal<DiaryEntry[]>(this.loadEntries());

  getEntries(): DiaryEntry[] {
    return this.entries();
  }

  addEntry(text: string, feedback: DiaryFeedback): DiaryEntry {
    const entry: DiaryEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      text,
      feedback,
      messages: [],
    };
    this.entries.update((entries) => [entry, ...entries]);
    this.save();
    return entry;
  }

  getEntry(id: string): DiaryEntry | undefined {
    return this.entries().find((e) => e.id === id);
  }

  addMessage(
    entryId: string,
    role: 'user' | 'assistant',
    text: string,
    feedback?: DiaryFeedback
  ): void {
    this.entries.update((entries) =>
      entries.map((e) => {
        if (e.id !== entryId) return e;
        return {
          ...e,
          messages: [
            ...e.messages,
            { role, text, feedback, timestamp: Date.now() },
          ],
        };
      })
    );
    this.save();
  }

  deleteEntry(id: string): void {
    this.entries.update((entries) => entries.filter((e) => e.id !== id));
    this.save();
  }

  private loadEntries(): DiaryEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DiaryEntry[];
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // corrupted data — fall through
    }
    return [];
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries()));
    } catch (err) {
      console.warn('Failed to persist diary entries to localStorage; keeping in memory.', err);
    }
  }
}