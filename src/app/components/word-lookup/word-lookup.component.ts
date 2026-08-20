import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WordService } from '../../services/word.service';
import { AiService, AiSuggestion } from '../../services/ai.service';
import { TranslationService } from '../../services/translation.service';
import { SettingsService } from '../../services/settings.service';
import { SpeechService } from '../../services/speech.service';
import { Word, PartOfSpeech } from '../../models/word';

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

@Component({
  selector: 'app-word-lookup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './word-lookup.component.html',
  styleUrl: './word-lookup.component.scss',
})
export class WordLookupComponent {
  private readonly wordService = inject(WordService);
  private readonly aiService = inject(AiService);
  private readonly translationService = inject(TranslationService);
  readonly settingsService = inject(SettingsService);
  private readonly speechService = inject(SpeechService);

  // ── UI state ──
  readonly open = signal(false);
  readonly searchInput = signal('');
  readonly searching = signal(false);

  // ── Vocab search results ──
  readonly selectedWord = signal<Word | null>(null);

  // ── AI fallback state ──
  readonly lookupQuery = signal('');
  readonly aiLoading = signal(false);
  readonly aiError = signal('');
  readonly aiSuggestion = signal<AiSuggestion | null>(null);
  readonly defaultTranslation = signal('');

  // Hint/retry
  readonly hintInput = signal('');
  readonly hintLoading = signal(false);
  readonly hintError = signal('');

  // Add-to-vocab feedback
  readonly addedFeedback = signal(false);

  /** Live matching words as the user types (exact or partial across all forms). */
  readonly liveMatches = computed<Word[]>(() => {
    const query = normalize(this.searchInput());
    if (!query || this.selectedWord()) return [];
    const words = this.wordService.getWords();
    return words
      .filter((w) => this.wordMatchesQuery(w, query))
      .slice(0, 8);
  });

  /** True when AI mode is active (word not in vocabulary). */
  readonly aiModeActive = computed(() => this.lookupQuery() !== '');

  toggleOpen(): void {
    this.open.update((o) => !o);
    if (!this.open()) {
      this.resetState();
    }
  }

  close(): void {
    this.open.set(false);
    this.resetState();
  }

  private resetState(): void {
    this.searchInput.set('');
    this.selectedWord.set(null);
    this.searching.set(false);
    this.lookupQuery.set('');
    this.aiLoading.set(false);
    this.aiError.set('');
    this.aiSuggestion.set(null);
    this.defaultTranslation.set('');
    this.hintInput.set('');
    this.hintLoading.set(false);
    this.hintError.set('');
    this.addedFeedback.set(false);
    this.speechService.stop();
  }

  /** Called when the user edits the search input — clears previous results. */
  onInputChange(): void {
    this.selectedWord.set(null);
    this.lookupQuery.set('');
    this.aiSuggestion.set(null);
    this.aiError.set('');
    this.defaultTranslation.set('');
    this.hintInput.set('');
    this.hintError.set('');
    this.addedFeedback.set(false);
  }

  // ── Search ──

  async search(): Promise<void> {
    const query = normalize(this.searchInput());
    if (!query) return;

    this.searching.set(true);
    this.onInputChange();

    // First, try exact match on the base form
    const exactBase = this.wordService
      .getWords()
      .find((w) => normalize(w.german) === query);
    if (exactBase) {
      this.selectedWord.set(exactBase);
      this.searching.set(false);
      return;
    }

    // Then try exact match on any inflected form
    const exactForm = this.wordService
      .getWords()
      .find((w) => this.wordHasExactForm(w, query));
    if (exactForm) {
      this.selectedWord.set(exactForm);
      this.searching.set(false);
      return;
    }

    // Partial matches?
    const matches = this.wordService
      .getWords()
      .filter((w) => this.wordMatchesQuery(w, query));
    if (matches.length > 0) {
      // If there's only one match, show it directly
      if (matches.length === 1) {
        this.selectedWord.set(matches[0]);
      }
      // Otherwise leave the live matches visible for the user to click
      this.searching.set(false);
      return;
    }

    // Not found → AI mode
    this.searching.set(false);
    this.lookupQuery.set(this.searchInput().trim());
    await this.runAiLookup();
  }

  /** Force AI lookup for the query even if partial matches exist. */
  async forceAiLookup(): Promise<void> {
    const word = this.searchInput().trim();
    if (!word) return;

    this.searching.set(false);
    this.onInputChange();
    this.lookupQuery.set(word);
    await this.runAiLookup();
  }

  /** Select a word from the live matches. */
  selectWord(word: Word): void {
    this.selectedWord.set(word);
    this.searchInput.set(word.german);
    this.lookupQuery.set('');
    this.aiSuggestion.set(null);
    this.aiError.set('');
  }

  private wordMatchesQuery(word: Word, query: string): boolean {
    const fields = this.getAllForms(word);
    // Exact match on any form
    if (fields.some((f) => normalize(f) === query)) {
      return true;
    }
    // Partial match
    return fields.some((f) => normalize(f).includes(query));
  }

  private wordHasExactForm(word: Word, query: string): boolean {
    return this.getAllForms(word).some((f) => normalize(f) === query);
  }

  /** Returns all searchable forms of a word (base, conjugations, plural, translations). */
  private getAllForms(word: Word): string[] {
    return [
      word.german,
      word.translationEn,
      word.translationRu,
      word.presentThirdPerson ?? '',
      word.simplePast ?? '',
      word.pastParticiple ?? '',
      word.pluralForm ?? '',
    ].filter((f) => f.trim().length > 0);
  }

  // ── AI lookup ──

  private async runAiLookup(): Promise<void> {
    const word = this.lookupQuery();
    if (!word) return;

    this.aiLoading.set(true);
    this.aiError.set('');

    // Run AI analysis and default translation in parallel
    const [suggestion, translated] = await Promise.allSettled([
      this.aiService.analyzeWord(word),
      this.translateDefault(word),
    ]);

    if (suggestion.status === 'fulfilled') {
      this.aiSuggestion.set(suggestion.value);
    } else {
      this.aiError.set(
        suggestion.reason instanceof Error
          ? suggestion.reason.message
          : 'AI analysis failed.'
      );
    }

    if (translated.status === 'fulfilled' && translated.value) {
      this.defaultTranslation.set(translated.value);
    }

    this.aiLoading.set(false);
  }

  private async translateDefault(word: string): Promise<string> {
    try {
      return await this.translationService.translateSentence(word);
    } catch {
      return '';
    }
  }

  // ── Retry with hint ──

  async retryWithHint(): Promise<void> {
    const word = this.lookupQuery();
    const hint = this.hintInput().trim();
    if (!word || !hint) return;

    this.hintLoading.set(true);
    this.hintError.set('');
    this.aiError.set('');

    try {
      const suggestion = await this.aiService.reanalyzeWord(word, hint);
      this.aiSuggestion.set(suggestion);
      this.hintInput.set('');
    } catch (err) {
      this.hintError.set(
        err instanceof Error ? err.message : 'Re-analysis failed.'
      );
    } finally {
      this.hintLoading.set(false);
    }
  }

  // ── Add to vocabulary ──

  addToVocabulary(): void {
    const word = this.lookupQuery();
    const suggestion = this.aiSuggestion();
    if (!word || !suggestion) return;

    const isNoun = suggestion.partOfSpeech === 'noun';
    const isVerb = suggestion.partOfSpeech === 'verb';

    // Use infinitive for verbs, base form otherwise if it differs
    const dictionaryWord =
      isVerb && suggestion.infinitive
        ? suggestion.infinitive
        : suggestion.baseForm && suggestion.baseForm !== word
          ? suggestion.baseForm
          : word;

    this.wordService.addWord({
      german: dictionaryWord,
      partOfSpeech: suggestion.partOfSpeech,
      gender: isNoun ? suggestion.gender : null,
      translationEn: suggestion.translationEn,
      translationRu: suggestion.translationRu,
      level: suggestion.level,
      mastery: 0,
      usageCount: 0,
      verbType: isVerb ? suggestion.verbType : undefined,
      presentThirdPerson: isVerb ? suggestion.presentThirdPerson : undefined,
      simplePast: isVerb ? suggestion.simplePast : undefined,
      pastParticiple: isVerb ? suggestion.pastParticiple : undefined,
      pluralForm: isNoun ? suggestion.pluralForm : undefined,
      pluralFormation: isNoun
        ? (suggestion.pluralFormation as Word['pluralFormation'])
        : undefined,
    });

    this.addedFeedback.set(true);

    // After adding, switch to showing the word from vocabulary
    const added = this.wordService
      .getWords()
      .find((w) => normalize(w.german) === normalize(dictionaryWord));
    if (added) {
      setTimeout(() => {
        this.selectedWord.set(added);
        this.searchInput.set(added.german);
        this.lookupQuery.set('');
        this.aiSuggestion.set(null);
        this.aiError.set('');
        this.defaultTranslation.set('');
        this.hintInput.set('');
        this.hintError.set('');
        this.addedFeedback.set(false);
      }, 1500);
    }
  }

  // ── Audio (browser speech synthesis) ──

  playAudio(text: string): void {
    if (!text) return;
    this.speechService.speak(text);
  }

  // ── Display helpers ──

  getTranslation(word: Word): string {
    return this.settingsService.getTranslation(word);
  }

  suggestionTranslation(): string {
    const s = this.aiSuggestion();
    if (!s) return '';
    return this.settingsService.getTranslation({
      translationEn: s.translationEn,
      translationRu: s.translationRu,
    } as Word);
  }

  /** Full display word for a vocab entry: article + base form. */
  displayWord(word: Word): string {
    if (word.partOfSpeech === 'noun' && word.gender) {
      return `${word.gender} ${word.german}`;
    }
    return word.german;
  }

  /** Display word for AI suggestion: base form with article when noun. */
  aiDisplayWord(): string {
    const s = this.aiSuggestion();
    const word = this.lookupQuery();
    if (!s || !word) return word;

    const base = s.baseForm && s.baseForm !== word ? s.baseForm : word;
    if (s.partOfSpeech === 'noun' && s.gender) {
      return `${s.gender} ${base}`;
    }
    return base;
  }

  partOfSpeechLabel(pos: PartOfSpeech): string {
    const labels: Record<PartOfSpeech, string> = {
      noun: 'Noun',
      verb: 'Verb',
      adjective: 'Adjective',
      adverb: 'Adverb',
      pronoun: 'Pronoun',
      preposition: 'Preposition',
      conjunction: 'Conjunction',
      interjection: 'Interjection',
      numeral: 'Numeral',
      phrase: 'Phrase',
    };
    return labels[pos] ?? pos;
  }

  /** Verb type label for display (German style). */
  verbTypeLabel(type: 'strong' | 'weak' | 'mixed' | undefined): string {
    if (!type) return '';
    const labels: Record<string, string> = {
      strong: 'stark',
      weak: 'schwach',
      mixed: 'gemischt',
    };
    return labels[type];
  }
}