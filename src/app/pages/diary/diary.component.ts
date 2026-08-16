import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DiaryService } from '../../services/diary.service';
import { WordService } from '../../services/word.service';
import { AiService, AiSuggestion } from '../../services/ai.service';
import { DiaryEntry, DiaryFeedback } from '../../models/diary';
import { PluralFormation } from '../../models/word';

interface PendingWord {
  word: string;
  storeAs: string;
  suggestion: AiSuggestion;
  isDuplicate: boolean;
  duplicateOf?: string;
}

@Component({
  selector: 'app-diary',
  imports: [
    FormsModule,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
  ],
  templateUrl: './diary.component.html',
  styleUrl: './diary.component.scss',
})
export class DiaryComponent {
  readonly entryInput = signal('');
  readonly analyzing = signal(false);
  readonly aiError = signal('');
  readonly latestFeedback = signal<DiaryFeedback | null>(null);
  readonly expandedEntryId = signal<string | null>(null);

  // Unknown words → add to vocabulary
  readonly pendingWords = signal<PendingWord[] | null>(null);
  readonly selectedPendingWords = signal<Set<string>>(new Set());
  readonly analyzingWords = signal(false);
  readonly addingWords = signal(false);

  readonly entries = computed(() => this.diaryService.getEntries());
  readonly wordCount = computed(() =>
    this.entryInput().trim() ? this.entryInput().trim().split(/\s+/).length : 0
  );

  constructor(
    private readonly diaryService: DiaryService,
    private readonly wordService: WordService,
    private readonly aiService: AiService
  ) {}

  async submitEntry(): Promise<void> {
    const text = this.entryInput().trim();
    if (!text) return;

    this.analyzing.set(true);
    this.aiError.set('');
    this.latestFeedback.set(null);
    this.pendingWords.set(null);
    this.selectedPendingWords.set(new Set());

    try {
      const words = this.wordService.getWords();
      const vocabList = words.map((w) => ({
        german: w.german,
        translationEn: w.translationEn,
        translationRu: w.translationRu,
      }));

      const feedback = await this.aiService.analyzeDiaryEntry(text, vocabList);
      this.diaryService.addEntry(text, feedback);
      this.latestFeedback.set(feedback);
      this.entryInput.set('');
    } catch (err) {
      this.aiError.set(err instanceof Error ? err.message : 'Failed to analyze diary entry.');
    } finally {
      this.analyzing.set(false);
    }
  }

  useQuestion(de: string): void {
    const current = this.entryInput().trim();
    this.entryInput.set(current ? `${current} ${de} ` : `${de} `);
    this.latestFeedback.set(null);
  }

  deleteEntry(id: string): void {
    this.diaryService.deleteEntry(id);
    if (this.expandedEntryId() === id) {
      this.expandedEntryId.set(null);
    }
  }

  toggleExpanded(id: string): void {
    this.expandedEntryId.update((current) => (current === id ? null : id));
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  // ── Unknown words → add to vocabulary ──

  private buildKnownWordForms(): Set<string> {
    const known = new Set<string>();
    for (const w of this.wordService.getWords()) {
      known.add(w.german.toLowerCase());
      if (w.verbType) {
        if (w.presentThirdPerson) known.add(w.presentThirdPerson.toLowerCase());
        if (w.simplePast) known.add(w.simplePast.toLowerCase());
        if (w.pastParticiple) known.add(w.pastParticiple.toLowerCase());
      }
    }
    return known;
  }

  async analyzeUnknownWords(): Promise<void> {
    const feedback = this.latestFeedback();
    if (!feedback?.unknownWords?.length) return;

    const wordsToCheck = feedback.unknownWords;
    const knownForms = this.buildKnownWordForms();

    this.analyzingWords.set(true);
    this.pendingWords.set(null);
    this.selectedPendingWords.set(new Set());

    try {
      const pending: PendingWord[] = [];

      for (const word of wordsToCheck) {
        const lower = word.toLowerCase();

        if (knownForms.has(lower)) {
          const existing = this.wordService.getWords().find(
            (w) =>
              w.german.toLowerCase() === lower ||
              w.presentThirdPerson?.toLowerCase() === lower ||
              w.simplePast?.toLowerCase() === lower ||
              w.pastParticiple?.toLowerCase() === lower
          );
          pending.push({
            word,
            storeAs: word,
            suggestion: null as unknown as AiSuggestion,
            isDuplicate: true,
            duplicateOf: existing?.german ?? word,
          });
          continue;
        }

        const suggestion = await this.aiService.analyzeWord(word);
        const storeAs =
          suggestion.baseForm?.trim() ||
          (suggestion.partOfSpeech === 'verb' && suggestion.infinitive
            ? suggestion.infinitive
            : word);
        pending.push({ word, storeAs, suggestion, isDuplicate: false });
      }

      this.pendingWords.set(pending);
      this.selectedPendingWords.set(
        new Set(pending.filter((p) => !p.isDuplicate).map((p) => p.word))
      );
    } catch (err) {
      this.aiError.set(err instanceof Error ? err.message : 'Failed to analyze words.');
    } finally {
      this.analyzingWords.set(false);
    }
  }

  togglePendingWord(word: string): void {
    this.selectedPendingWords.update((set) => {
      const updated = new Set(set);
      if (updated.has(word)) {
        updated.delete(word);
      } else {
        updated.add(word);
      }
      return updated;
    });
  }

  confirmAddWords(): void {
    const pending = this.pendingWords();
    if (!pending) return;

    const selected = this.selectedPendingWords();
    const toAdd = pending.filter((p) => !p.isDuplicate && selected.has(p.word));
    if (toAdd.length === 0) return;

    this.addingWords.set(true);

    try {
      for (const p of toAdd) {
        this.wordService.addWord({
          german: p.storeAs,
          partOfSpeech: p.suggestion.partOfSpeech,
          gender: p.suggestion.gender,
          translationEn: p.suggestion.translationEn,
          translationRu: p.suggestion.translationRu,
          level: p.suggestion.level,
          mastery: 0,
          usageCount: 0,
          verbType: p.suggestion.verbType,
          presentThirdPerson: p.suggestion.presentThirdPerson,
          simplePast: p.suggestion.simplePast,
          pastParticiple: p.suggestion.pastParticiple,
          pluralForm: p.suggestion.pluralForm,
          pluralFormation: p.suggestion.pluralFormation as PluralFormation | undefined,
        });
      }

      // Refresh feedback unknown words
      this.latestFeedback.update((fb) =>
        fb ? { ...fb, unknownWords: [] } : fb
      );
      this.pendingWords.set(null);
      this.selectedPendingWords.set(new Set());
    } catch (err) {
      this.aiError.set(err instanceof Error ? err.message : 'Failed to add words to vocabulary.');
    } finally {
      this.addingWords.set(false);
    }
  }

  cancelAddWords(): void {
    this.pendingWords.set(null);
    this.selectedPendingWords.set(new Set());
  }
}