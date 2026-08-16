import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { SentenceService } from '../../services/sentence.service';
import { SettingsService } from '../../services/settings.service';
import { DomainService } from '../../services/domain.service';
import { GrammarTopicService } from '../../services/grammar-topic.service';
import { PartOfSpeechService, PartOfSpeechInfo } from '../../services/part-of-speech.service';
import { AiService, TranslationResult, GeneratedSentence } from '../../services/ai.service';
import { WordService } from '../../services/word.service';
import { DifficultyLevel, PartOfSpeech, Word } from '../../models/word';
import { Sentence } from '../../models/sentence';

type ExerciseMode = 'new' | 'review';

interface ExerciseSession {
  sentence: Sentence;
  userInput: string;
  result: TranslationResult | null;
}

@Component({
  selector: 'app-exercise',
  imports: [
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatSelectModule,
    CommonModule,
  ],
  templateUrl: './exercise.component.html',
  styleUrl: './exercise.component.scss',
})
export class ExerciseComponent {
  readonly allLevels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

  readonly selectedLevels = signal<DifficultyLevel[]>([]);
  readonly mode = signal<ExerciseMode>('new');
  readonly currentIndex = signal(0);
  readonly session = signal<ExerciseSession[]>([]);
  readonly userInput = signal('');
  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly generationError = signal<string | null>(null);
  readonly result = signal<TranslationResult | null>(null);
  readonly exerciseStarted = signal(false);
  readonly exerciseFinished = signal(false);

  // Domain selection
  readonly domainInput = signal('');
  readonly selectedDomain = signal<string | null>(null);
  readonly domainSearchFocused = signal(false);

  readonly filteredDomains = computed(() => {
    const query = this.domainInput();
    if (!query.trim()) {
      return this.domainService.getAllDomains();
    }
    return this.domainService.searchDomains(query);
  });

  // Parts of speech selection
  readonly allPartsOfSpeech: PartOfSpeechInfo[];
  readonly selectedPartsOfSpeech = signal<PartOfSpeech[]>([]);

  // Grammar topics selection
  readonly selectedGrammarTopics = signal<string[]>([]);
  readonly grammarSearchInput = signal('');

  readonly filteredGrammarTopics = computed(() => {
    const query = this.grammarSearchInput();
    if (!query.trim()) {
      return this.grammarTopicService.getAllTopics();
    }
    return this.grammarTopicService.searchTopics(query);
  });

  // Sentence count
  readonly sentenceCount = signal(5);

  // Forced word selection
  readonly forcedWordIds = signal<Set<string>>(new Set());
  readonly wordSearchQuery = signal('');
  readonly wordDateFrom = signal<string>('');
  readonly wordDateTo = signal<string>('');

  readonly filteredWords = computed(() => {
    let words = this.wordService.getWords();
    const search = this.wordSearchQuery().toLowerCase().trim();
    const from = this.wordDateFrom();
    const to = this.wordDateTo();

    if (search) {
      words = words.filter(
        (w) =>
          w.german.toLowerCase().includes(search) ||
          w.translationEn.toLowerCase().includes(search) ||
          w.translationRu.toLowerCase().includes(search)
      );
    }
    if (from) {
      const fromDate = new Date(from);
      words = words.filter((w) => new Date(w.createdAt) >= fromDate);
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      words = words.filter((w) => new Date(w.createdAt) <= toDate);
    }

    return words;
  });

  readonly forcedWordCount = computed(() => this.forcedWordIds().size);

  readonly currentSentence = computed(() => {
    const s = this.session();
    const i = this.currentIndex();
    return i < s.length ? s[i] : null;
  });

  readonly currentNumber = computed(() => this.currentIndex() + 1);
  readonly totalSentences = computed(() => this.session().length);
  readonly correctCount = computed(
    () => this.session().filter((s) => s.result?.correct).length
  );

  readonly availableNew = computed(() =>
    this.sentenceService.getNewSentences(
      this.selectedLevels().length > 0 ? this.selectedLevels() : this.allLevels,
      this.selectedDomain() ?? undefined,
      this.selectedGrammarTopics()
    )
  );
  readonly availableReview = computed(() =>
    this.sentenceService.getPassedSentences(
      this.selectedLevels().length > 0 ? this.selectedLevels() : this.allLevels,
      this.selectedDomain() ?? undefined,
      this.selectedGrammarTopics()
    )
  );

  constructor(
    private readonly sentenceService: SentenceService,
    private readonly settingsService: SettingsService,
    private readonly domainService: DomainService,
    private readonly grammarTopicService: GrammarTopicService,
    private readonly posService: PartOfSpeechService,
    private readonly aiService: AiService,
    private readonly wordService: WordService
  ) {
    this.allPartsOfSpeech = this.posService.getAll();
  }

  toggleLevel(level: DifficultyLevel): void {
    this.selectedLevels.update((levels) =>
      levels.includes(level)
        ? levels.filter((l) => l !== level)
        : [...levels, level]
    );
  }

  selectDomain(domain: string): void {
    this.selectedDomain.set(domain);
    this.domainInput.set(domain);
  }

  clearDomain(): void {
    this.selectedDomain.set(null);
    this.domainInput.set('');
  }

  onDomainInputBlur(): void {
    const input = this.domainInput().trim();
    if (input && !this.selectedDomain()) {
      this.domainService.addCustomDomain(input);
      this.selectedDomain.set(input);
    }
    this.domainSearchFocused.set(false);
  }

  togglePartOfSpeech(pos: PartOfSpeech): void {
    this.selectedPartsOfSpeech.update((parts) =>
      parts.includes(pos)
        ? parts.filter((p) => p !== pos)
        : [...parts, pos]
    );
  }

  toggleGrammarTopic(topic: string): void {
    this.selectedGrammarTopics.update((topics) =>
      topics.includes(topic)
        ? topics.filter((t) => t !== topic)
        : [...topics, topic]
    );
  }

  clearGrammarTopics(): void {
    this.selectedGrammarTopics.set([]);
  }

  getTranslation(sentence: Sentence): string {
    return this.settingsService.translationLanguage() === 'ru'
      ? sentence.translationRu
      : sentence.translationEn;
  }

  // ── Forced word selection ──

  toggleForcedWord(wordId: string): void {
    this.forcedWordIds.update((s) => {
      const next = new Set(s);
      if (next.has(wordId)) {
        next.delete(wordId);
      } else {
        next.add(wordId);
      }
      return next;
    });
  }

  isWordForced(wordId: string): boolean {
    return this.forcedWordIds().has(wordId);
  }

  clearForcedWords(): void {
    this.forcedWordIds.set(new Set());
  }

  onSentenceCountChange(value: string): void {
    this.sentenceCount.set(Number(value));
  }

  async startExercise(): Promise<void> {
    this.generationError.set(null);
    const levels =
      this.selectedLevels().length > 0
        ? this.selectedLevels()
        : this.allLevels;
    const domain = this.selectedDomain() ?? undefined;
    const grammarTopics = this.selectedGrammarTopics();

    let sentences: Sentence[];

    if (this.mode() === 'new') {
      sentences = this.sentenceService.getNewSentences(levels, domain, grammarTopics);
      if (sentences.length === 0) {
        await this.generateSentences(levels, domain, grammarTopics);
        sentences = this.sentenceService.getNewSentences(levels, domain, grammarTopics);
      }
    } else {
      sentences = this.sentenceService.getPassedSentences(levels, domain, grammarTopics);
    }

    if (sentences.length === 0) {
      if (!this.generationError()) {
        this.generationError.set(
          this.mode() === 'review'
            ? 'No reviewed sentences match your filters.'
            : 'Could not find or generate sentences matching your filters. Check your API key in settings.'
        );
      }
      return;
    }

    this.session.set(
      sentences.map((s) => ({ sentence: s, userInput: '', result: null }))
    );
    this.currentIndex.set(0);
    this.userInput.set('');
    this.result.set(null);
    this.exerciseStarted.set(true);
    this.exerciseFinished.set(false);
  }

  private async generateSentences(
    levels: DifficultyLevel[],
    domain?: string,
    grammarTopics?: string[]
  ): Promise<void> {
    this.generating.set(true);
    this.generationError.set(null);
    try {
      // Forced words are always included
      const forcedIds = Array.from(this.forcedWordIds());
      const forcedWords = forcedIds
        .map((id) => this.wordService.getWords().find((w) => w.id === id))
        .filter((w): w is Word => w !== undefined)
        .map((w) => w.german);

      // Fill remaining slots with the existing weighted algorithm
      const maxAuto = Math.max(0, 50 - forcedWords.length);
      const autoWords = this.wordService
        .selectWordsForGeneration(levels, maxAuto, this.selectedPartsOfSpeech())
        .map((w: Word) => w.german);

      // Combine: forced words first, then auto-selected
      const knownWords = [...forcedWords, ...autoWords];
      const level = levels[0] ?? 'A1';
      const count = this.sentenceCount();

      const generated: GeneratedSentence[] =
        await this.aiService.generateSentences(
          level,
          knownWords,
          count,
          domain,
          grammarTopics
        );
      this.sentenceService.addSentences(
        generated.map((g) => ({
          german: g.german,
          translationEn: g.translationEn,
          translationRu: g.translationRu,
          level: g.level,
          domain: g.domain,
          grammarTopics: grammarTopics ?? [],
          passedAt: null,
          timesPassed: 0,
        }))
      );

      // Track which of the selected words actually appeared in generated sentences
      const usedWords = knownWords.filter((w) =>
        generated.some((s) =>
          s.german.toLowerCase().includes(w.toLowerCase())
        )
      );
      if (usedWords.length > 0) {
        this.wordService.incrementUsage(usedWords);
      }
    } catch (err) {
      console.error('Failed to generate sentences:', err);
      this.generationError.set(
        err instanceof Error ? err.message : 'Failed to generate sentences. Check your API key.'
      );
    } finally {
      this.generating.set(false);
    }
  }

  async submitTranslation(): Promise<void> {
    const sentence = this.currentSentence();
    if (!sentence || !this.userInput().trim()) {
      return;
    }

    this.loading.set(true);
    try {
      const result = await this.aiService.verifyTranslation(
        this.userInput(),
        sentence.sentence.german
      );
      this.result.set(result);
      this.session.update((s) =>
        s.map((item, i) =>
          i === this.currentIndex() ? { ...item, result } : item
        )
      );
    } catch (err) {
      console.error('Verification failed:', err);
    } finally {
      this.loading.set(false);
    }
  }

  markAsPassed(): void {
    const sentence = this.currentSentence();
    if (sentence) {
      this.sentenceService.markAsPassed(sentence.sentence.id);
    }
  }

  nextSentence(): void {
    if (this.currentIndex() + 1 >= this.session().length) {
      this.exerciseFinished.set(true);
      return;
    }
    this.currentIndex.update((i) => i + 1);
    this.userInput.set('');
    this.result.set(null);
  }

  restart(): void {
    this.exerciseStarted.set(false);
    this.exerciseFinished.set(false);
    this.session.set([]);
    this.currentIndex.set(0);
    this.userInput.set('');
    this.result.set(null);
  }

  getErrorText(
    input: string,
    error: { startIndex: number; endIndex: number }
  ): string {
    return input.substring(error.startIndex, error.endIndex);
  }
}