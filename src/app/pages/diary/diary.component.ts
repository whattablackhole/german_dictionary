import { Component, computed, signal, viewChild } from '@angular/core';
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

  /** The entry currently being continued (null = new entry) */
  readonly activeEntryId = signal<string | null>(null);

  /** Follow-up question shown as a hint for the user's next message */
  readonly followUpHint = signal('');

  /** Reference to the conversation scroll container */
  readonly conversationScroll = viewChild('conversationScroll');

  // Unknown words → add to vocabulary
  readonly pendingWords = signal<PendingWord[] | null>(null);
  readonly selectedPendingWords = signal<Set<string>>(new Set());
  readonly analyzingWords = signal(false);
  readonly addingWords = signal(false);

  readonly entries = computed(() => this.diaryService.getEntries());
  readonly wordCount = computed(() =>
    this.entryInput().trim() ? this.entryInput().trim().split(/\s+/).length : 0
  );

  /** The active entry object (for display) */
  readonly activeEntry = computed(() => {
    const id = this.activeEntryId();
    return id ? this.diaryService.getEntry(id) ?? null : null;
  });

  /** All active entry messages (initial + follow-ups) */
  readonly activeMessages = computed(() => {
    const entry = this.activeEntry();
    if (!entry) return [];
    const messages: { role: 'user' | 'assistant'; text: string; feedback?: DiaryFeedback; timestamp: number }[] = [
      { role: 'user', text: entry.text, timestamp: entry.timestamp },
      { role: 'assistant', text: '', feedback: entry.feedback, timestamp: entry.timestamp },
    ];
    for (const m of entry.messages) {
      messages.push(m);
    }
    return messages;
  });

  /** Scroll the conversation to the bottom (latest message) */
  scrollToBottom(): void {
    const el = this.conversationScroll() as HTMLElement | null;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  constructor(
    private readonly diaryService: DiaryService,
    private readonly wordService: WordService,
    private readonly aiService: AiService
  ) {}

  /** Start a new entry (clear active entry) */
  startNewEntry(): void {
    this.activeEntryId.set(null);
    this.entryInput.set('');
    this.latestFeedback.set(null);
    this.aiError.set('');
    this.pendingWords.set(null);
    this.selectedPendingWords.set(new Set());
    this.followUpHint.set('');
  }

  /** Continue an existing entry from history */
  continueEntry(entryId: string): void {
    this.activeEntryId.set(entryId);
    this.entryInput.set('');
    this.latestFeedback.set(null);
    this.aiError.set('');
    this.pendingWords.set(null);
    this.selectedPendingWords.set(new Set());
    this.followUpHint.set('');
    // Scroll to the bottom of the conversation for the continued entry
    this.scrollToBottom();
  }

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

      const activeId = this.activeEntryId();

      if (activeId) {
        // Continuing an existing conversation
        const entry = this.diaryService.getEntry(activeId);
        if (!entry) throw new Error('Entry not found.');

        // Build conversation history from the entry
        const conversationHistory: { role: 'user' | 'assistant'; text: string }[] = [
          { role: 'user', text: entry.text },
          { role: 'assistant', text: entry.feedback.overall },
        ];
        for (const m of entry.messages) {
          conversationHistory.push({ role: m.role, text: m.text });
        }

        // Include the selected follow-up question as an assistant message (hint)
        const hint = this.followUpHint();
        if (hint) {
          conversationHistory.push({ role: 'assistant', text: hint });
        }

        // Add the user's new message to history
        this.diaryService.addMessage(activeId, 'user', text);

        const feedback = await this.aiService.analyzeDiaryEntry(
          text,
          vocabList,
          conversationHistory
        );

        // Add the AI response as an assistant message
        this.diaryService.addMessage(activeId, 'assistant', feedback.overall, feedback);
        this.latestFeedback.set(feedback);
      } else {
        // New entry
        const feedback = await this.aiService.analyzeDiaryEntry(text, vocabList);
        const entry = this.diaryService.addEntry(text, feedback);
        this.activeEntryId.set(entry.id);
        this.latestFeedback.set(feedback);
      }

      this.entryInput.set('');
      this.followUpHint.set('');
      // Scroll to the bottom to show the latest AI response
      this.scrollToBottom();
    } catch (err) {
      this.aiError.set(err instanceof Error ? err.message : 'Failed to analyze diary entry.');
    } finally {
      this.analyzing.set(false);
    }
  }

  /** Set a follow-up question as a hint for the user's next message (does NOT auto-submit). */
  useQuestion(de: string): void {
    this.followUpHint.set(de);
    // Scroll to the bottom so the user sees the hint and input area
    this.scrollToBottom();
  }

  /** Clear the follow-up question hint. */
  clearFollowUpHint(): void {
    this.followUpHint.set('');
  }

  deleteEntry(id: string): void {
    this.diaryService.deleteEntry(id);
    if (this.activeEntryId() === id) {
      this.activeEntryId.set(null);
      this.latestFeedback.set(null);
    }
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