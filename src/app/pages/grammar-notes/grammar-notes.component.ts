import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GrammarNotesService } from '../../services/grammar-notes.service';
import { AiService } from '../../services/ai.service';
import { GrammarNote } from '../../models/grammar-note';
import { MarkdownPipe } from '../../pipes/markdown.pipe';

@Component({
  selector: 'app-grammar-notes',
  imports: [
    FormsModule,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MarkdownPipe,
  ],
  templateUrl: './grammar-notes.component.html',
  styleUrl: './grammar-notes.component.scss',
})
export class GrammarNotesComponent {
  readonly searchQuery = signal('');
  readonly selectedCategory = signal<string | null>(null);
  readonly selectedNoteId = signal<string | null>(null);
  readonly showNewNoteForm = signal(false);
  readonly userQuery = signal('');
  readonly generating = signal(false);
  readonly generationError = signal<string | null>(null);

  readonly categories = computed(() => this.notesService.getCategories());

  readonly filteredNotes = computed(() => {
    const search = this.searchQuery();
    const category = this.selectedCategory();
    let notes = this.notesService.getNotes();

    if (category) {
      notes = notes.filter((n) => n.category === category);
    }

    if (search.trim()) {
      const lower = search.toLowerCase();
      notes = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(lower) ||
          n.content.toLowerCase().includes(lower) ||
          n.category.toLowerCase().includes(lower)
      );
    }

    return notes;
  });

  readonly selectedNote = computed(() => {
    const id = this.selectedNoteId();
    return id ? this.notesService.getNoteById(id) ?? null : null;
  });

  readonly notesByCategory = computed(() => {
    const cats = this.categories();
    const search = this.searchQuery();
    return cats
      .map((cat) => {
        let notes = this.notesService.getNotesByCategory(cat);
        if (search.trim()) {
          const lower = search.toLowerCase();
          notes = notes.filter(
            (n) =>
              n.title.toLowerCase().includes(lower) ||
              n.content.toLowerCase().includes(lower)
          );
        }
        return { category: cat, notes, count: notes.length };
      })
      .filter((g) => g.count > 0);
  });

  constructor(
    private readonly notesService: GrammarNotesService,
    private readonly aiService: AiService
  ) {}

  selectCategory(category: string | null): void {
    this.selectedCategory.set(category);
    this.selectedNoteId.set(null);
  }

  selectNote(id: string): void {
    this.selectedNoteId.set(id);
    this.showNewNoteForm.set(false);
  }

  openNewNoteForm(): void {
    this.showNewNoteForm.set(true);
    this.selectedNoteId.set(null);
    this.userQuery.set('');
    this.generationError.set(null);
  }

  cancelNewNote(): void {
    this.showNewNoteForm.set(false);
    this.userQuery.set('');
    this.generationError.set(null);
  }

  async generateAndSave(): Promise<void> {
    const query = this.userQuery().trim();
    if (!query) {
      return;
    }

    this.generating.set(true);
    this.generationError.set(null);

    try {
      const result = await this.aiService.generateGrammarNote(query);
      const note = this.notesService.addNote({
        title: result.title,
        category: result.category,
        content: result.content,
        userQuery: query,
        examples: result.examples,
        relatedTopics: result.relatedTopics,
      });
      this.selectedNoteId.set(note.id);
      this.showNewNoteForm.set(false);
      this.selectedCategory.set(note.category);
    } catch (err) {
      this.generationError.set(
        err instanceof Error ? err.message : 'Failed to generate note.'
      );
    } finally {
      this.generating.set(false);
    }
  }

  deleteNote(id: string): void {
    this.notesService.deleteNote(id);
    if (this.selectedNoteId() === id) {
      this.selectedNoteId.set(null);
    }
  }

  formatExamples(examples: string[]): string {
    return examples.join('\n\n');
  }
}