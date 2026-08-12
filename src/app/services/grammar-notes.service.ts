import { Injectable, signal } from '@angular/core';
import { GrammarNote } from '../models/grammar-note';

const STORAGE_KEY = 'german-dictionary-grammar-notes';

@Injectable({ providedIn: 'root' })
export class GrammarNotesService {
  readonly notes = signal<GrammarNote[]>(this.loadNotes());

  getNotes(): GrammarNote[] {
    return this.notes();
  }

  getNoteById(id: string): GrammarNote | undefined {
    return this.notes().find((n) => n.id === id);
  }

  getCategories(): string[] {
    const cats = this.notes().map((n) => n.category);
    return [...new Set(cats)].sort();
  }

  getNotesByCategory(category: string): GrammarNote[] {
    return this.notes().filter((n) => n.category === category);
  }

  addNote(note: Omit<GrammarNote, 'id' | 'createdAt' | 'updatedAt'>): GrammarNote {
    const newNote: GrammarNote = {
      ...note,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.notes.update((notes) => [...notes, newNote]);
    this.save();
    return newNote;
  }

  updateNote(id: string, changes: Partial<Omit<GrammarNote, 'id' | 'createdAt'>>): void {
    this.notes.update((notes) =>
      notes.map((n) =>
        n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n
      )
    );
    this.save();
  }

  deleteNote(id: string): void {
    this.notes.update((notes) => notes.filter((n) => n.id !== id));
    this.save();
  }

  searchNotes(query: string): GrammarNote[] {
    if (!query.trim()) {
      return this.notes();
    }
    const lower = query.toLowerCase();
    return this.notes().filter(
      (n) =>
        n.title.toLowerCase().includes(lower) ||
        n.content.toLowerCase().includes(lower) ||
        n.category.toLowerCase().includes(lower) ||
        n.userQuery.toLowerCase().includes(lower)
    );
  }

  private loadNotes(): GrammarNote[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as GrammarNote[];
      } catch {
        // fall through
      }
    }
    return [];
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notes()));
  }
}