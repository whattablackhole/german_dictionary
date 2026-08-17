import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { CommonModule } from '@angular/common';
import { WordService } from '../../services/word.service';
import { SettingsService } from '../../services/settings.service';
import { DomainService } from '../../services/domain.service';
import { GrammarTopicService } from '../../services/grammar-topic.service';
import { PartOfSpeechService, PartOfSpeechInfo } from '../../services/part-of-speech.service';
import { WordExerciseService } from '../../services/word-exercise.service';
import { SpeechService } from '../../services/speech.service';
import { AiService, GeneratedWordExercise } from '../../services/ai.service';
import { TranslationService } from '../../services/translation.service';
import { DifficultyLevel, PartOfSpeech, Word } from '../../models/word';
import { WordExercise, BlankRange } from '../../models/word-exercise';

interface PracticeSession {
  exercise: WordExercise;
  userInput: string;
  correct: boolean | null;
}

@Component({
  selector: 'app-practice-word',
  imports: [
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    CommonModule,
  ],
  templateUrl: './practice-word.component.html',
  styleUrl: './practice-word.component.scss',
})
export class PracticeWordComponent {
  readonly allLevels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

  readonly selectedLevels = signal<DifficultyLevel[]>([]);
  readonly currentIndex = signal(0);
  readonly session = signal<PracticeSession[]>([]);
  readonly userInput = signal('');
  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly result = signal<boolean | null>(null);
  readonly translation = signal<string | null>(null);
  readonly translationLoading = signal(false);
  readonly masteryFeedback = signal<number | null>(null);
  readonly practiceStarted = signal(false);
  readonly practiceFinished = signal(false);
  readonly reviewMastered = signal(false);

  // Domain selection
  readonly domainInput = signal('');
  readonly selectedDomain = signal<string | null>(null);

  readonly filteredDomains = computed(() => {
    const query = this.domainInput();
    if (!query.trim()) {
      return this.domainService.getAllDomains();
    }
    return this.domainService.searchDomains(query);
  });

  // Parts of speech
  readonly allPartsOfSpeech: PartOfSpeechInfo[];
  readonly selectedPartsOfSpeech = signal<PartOfSpeech[]>([]);

  // Grammar topics
  readonly selectedGrammarTopics = signal<string[]>([]);
  readonly grammarSearchInput = signal('');

  readonly filteredGrammarTopics = computed(() => {
    const query = this.grammarSearchInput();
    if (!query.trim()) {
      return this.grammarTopicService.getAllTopics();
    }
    return this.grammarTopicService.searchTopics(query);
  });

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

  readonly currentExercise = computed(() => {
    const s = this.session();
    const i = this.currentIndex();
    return i < s.length ? s[i] : null;
  });

  readonly currentNumber = computed(() => this.currentIndex() + 1);
  readonly totalExercises = computed(() => this.session().length);
  readonly correctCount = computed(
    () => this.session().filter((s) => s.correct === true).length
  );

  readonly availableInProgress = computed(() => {
    const words = this.wordService.getWords();
    return this.wordExerciseService.getInProgressExercises(
      this.selectedLevels().length > 0 ? this.selectedLevels() : this.allLevels,
      this.selectedDomain() ?? undefined,
      words
    );
  });

  readonly availableNew = computed(() =>
    this.wordExerciseService.getNewExercises(
      this.selectedLevels().length > 0 ? this.selectedLevels() : this.allLevels,
      this.selectedDomain() ?? undefined
    )
  );

  readonly masteredWordCount = computed(() => {
    const words = this.wordService.getWords();
    const mastered = this.wordExerciseService.getMasteredExercises(
      this.selectedLevels().length > 0 ? this.selectedLevels() : this.allLevels,
      this.selectedDomain() ?? undefined,
      words
    );
    // Count unique words, not individual sentences
    return new Set(mastered.map((e) => e.wordId)).size;
  });

  readonly masteredWordList = computed(() => {
    const words = this.wordService.getWords();
    const mastered = this.wordExerciseService.getMasteredExercises(
      this.selectedLevels().length > 0 ? this.selectedLevels() : this.allLevels,
      this.selectedDomain() ?? undefined,
      words
    );
    const wordIds = new Set(mastered.map((e) => e.wordId));
    return words.filter((w) => wordIds.has(w.id));
  });

  constructor(
    private readonly wordService: WordService,
    private readonly settingsService: SettingsService,
    private readonly domainService: DomainService,
    private readonly grammarTopicService: GrammarTopicService,
    private readonly posService: PartOfSpeechService,
    private readonly wordExerciseService: WordExerciseService,
    private readonly speechService: SpeechService,
    private readonly aiService: AiService,
    private readonly translationService: TranslationService
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

  getHint(exercise: WordExercise): string {
    return this.settingsService.translationLanguage() === 'ru'
      ? exercise.wordHint
      : exercise.wordHint;
  }

  /**
   * Returns the blank ranges to actually blank out, considering the article setting.
   * - Show article ON: blank only the noun/verb ranges from AI (article stays visible)
   * - Show article OFF: extend the first range back to include the preceding article
   */
  private getBlankRanges(exercise: WordExercise): BlankRange[] {
    const ranges = exercise.blankRanges.map((r) => ({ ...r }));
    if (!this.settingsService.showArticleInPractice() && exercise.hasArticle) {
      const first = ranges[0];
      const before = exercise.fullSentence.slice(0, first.start);
      const match = before.match(
        /\b(der|die|das|den|dem|ein|eine|einen|einem|einer)\s+$/i
      );
      if (match) {
        ranges[0] = {
          start: first.start - match[0].length,
          end: first.end,
        };
      }
    }
    return ranges;
  }

  /** Build the sentence with blanks from fullSentence + blankRanges */
  buildBlankSentence(exercise: WordExercise): string {
    const ranges = this.getBlankRanges(exercise);
    const sorted = [...ranges].sort((a, b) => b.start - a.start);
    let result = exercise.fullSentence;
    for (const range of sorted) {
      result = result.slice(0, range.start) + '___' + result.slice(range.end);
    }
    return result;
  }

  /** Build the filled sentence with the user's answer / expected answer */
  buildFilledSentence(exercise: WordExercise, answer: string): string {
    const ranges = this.getBlankRanges(exercise);
    // If multiple blank ranges (separable verb), split answer by space and fill each range
    if (ranges.length > 1) {
      const parts = answer.split(/\s+/);
      const sorted = [...ranges].sort((a, b) => b.start - a.start);
      let result = exercise.fullSentence;
      for (let i = 0; i < sorted.length; i++) {
        const part = parts[parts.length - 1 - i] ?? '';
        result = result.slice(0, sorted[i].start) + part + result.slice(sorted[i].end);
      }
      return result.charAt(0).toUpperCase() + result.slice(1);
    }
    const sorted = [...ranges].sort((a, b) => b.start - a.start);
    let result = exercise.fullSentence;
    for (const range of sorted) {
      result = result.slice(0, range.start) + answer + result.slice(range.end);
    }
    // Capitalize first letter
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  /** Build the expected answer (what the user must type, matching the visible blank) */
  expectedAnswer(exercise: WordExercise): string {
    const ranges = this.getBlankRanges(exercise);
    const parts = ranges.map((r) => exercise.fullSentence.slice(r.start, r.end));
    return parts.join(' ');
  }

  async startPractice(): Promise<void> {
    const levels =
      this.selectedLevels().length > 0
        ? this.selectedLevels()
        : this.allLevels;
    const domain = this.selectedDomain() ?? undefined;

    // 1. Collect in-progress exercises (sessionCount > 0, mastery < 100)
    const words = this.wordService.getWords();
    const inProgress = this.wordExerciseService.getInProgressExercises(levels, domain, words);
    const shuffledInProgress = this.shuffleArray(inProgress).slice(0, 5);

    // 2. Collect new exercises (sessionCount === 0), up to 5
    const newExercises = this.wordExerciseService.getNewExercises(levels, domain);
    const shuffledNew = this.shuffleArray(newExercises).slice(0, 5);

    // 3. If we don't have enough exercises total (target ~10), generate more
    let exercises = [...shuffledInProgress, ...shuffledNew];

    if (exercises.length < 10) {
      await this.generateExercises(levels, domain);
      // After generation, recheck for fresh new exercises
      const freshNew = this.wordExerciseService.getNewExercises(levels, domain);
      const freshShuffled = this.shuffleArray(freshNew).slice(0, 10 - exercises.length);
      exercises = [...exercises, ...freshShuffled];
    }

    if (exercises.length === 0) {
      return;
    }

    this.reviewMastered.set(false);
    this.masteryFeedback.set(null);
    this.session.set(
      exercises.map((e) => ({ exercise: e, userInput: '', correct: null }))
    );
    this.currentIndex.set(0);
    this.userInput.set('');
    this.result.set(null);
    this.practiceStarted.set(true);
    this.practiceFinished.set(false);
  }

  async startReviewMastered(): Promise<void> {
    const levels =
      this.selectedLevels().length > 0
        ? this.selectedLevels()
        : this.allLevels;
    const domain = this.selectedDomain() ?? undefined;
    const words = this.wordService.getWords();

    const mastered = this.wordExerciseService.getMasteredExercises(levels, domain, words);
    if (mastered.length === 0) {
      return;
    }

    this.reviewMastered.set(true);
    this.masteryFeedback.set(null);
    this.session.set(
      mastered.map((e) => ({ exercise: e, userInput: '', correct: null }))
    );
    this.currentIndex.set(0);
    this.userInput.set('');
    this.result.set(null);
    this.practiceStarted.set(true);
    this.practiceFinished.set(false);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private readonly levelOrder: Record<DifficultyLevel, number> = { 'A1': 0, 'A2': 1, 'B1': 2, 'B2': 3, 'C1': 4 };
  private readonly allLevelsOrdered: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

  /** Determine the AI generation level range based on user selection and available words */
  private determineGenerationLevel(
    levels: DifficultyLevel[],
    words: Word[]
  ): { level: DifficultyLevel; levelRange: DifficultyLevel[] } {
    let levelSet: Set<DifficultyLevel>;

    if (this.selectedLevels().length > 0) {
      // User explicitly selected levels → use exactly those
      levelSet = new Set(this.selectedLevels());
    } else {
      // No levels selected → find the range from lowest to highest level among our words
      const wordLevels = new Set(words.map((w) => w.level));
      if (wordLevels.size === 0) {
        return { level: 'A1', levelRange: ['A1'] };
      }
      levelSet = wordLevels;
    }

    const minIdx = Math.min(...Array.from(levelSet).map(l => this.levelOrder[l]));
    const maxIdx = Math.max(...Array.from(levelSet).map(l => this.levelOrder[l]));
    const levelRange = this.allLevelsOrdered.slice(minIdx, maxIdx + 1);
    // Use the highest level as the primary level for the prompt
    return { level: levelRange[levelRange.length - 1], levelRange };
  }

  private async generateExercises(
    levels: DifficultyLevel[],
    domain?: string
  ): Promise<void> {
    this.generating.set(true);
    try {
      const words = this.wordService.getWords();
      const { wordIdsToExclude, allSentences } =
        this.wordExerciseService.getGenerationContext(words);

      // Forced words are always included
      const forcedIds = Array.from(this.forcedWordIds());
      const forcedWords = forcedIds
        .map((id) => this.wordService.getWords().find((w) => w.id === id))
        .filter((w): w is Word => w !== undefined);

      // Fill remaining slots with the existing weighted algorithm
      const maxAuto = Math.max(0, 50 - forcedWords.length);
      const selectedWords = this.wordService.selectWordsForPractice(
        levels,
        maxAuto,
        this.selectedPartsOfSpeech()
      );

      // Filter out mastered words (but keep forced words even if mastered)
      const autoWords = selectedWords.filter(
        (w) => !wordIdsToExclude.has(w.id)
      );

      // Combine: forced words first, then auto-selected
      const combinedWords = [...forcedWords, ...autoWords];

      if (combinedWords.length === 0) {
        console.warn('All words are mastered. Add new words first.');
        return;
      }

      const targetWords = combinedWords.map((w: Word) => ({
        german: w.german,
        translationEn: w.translationEn,
        translationRu: w.translationRu,
      }));

      // Collect ALL existing sentences for these words to avoid repeats
      const avoidSentences: string[] = [];
      for (const word of combinedWords) {
        const existing = allSentences.get(word.id);
        if (existing) {
          avoidSentences.push(...existing);
        }
      }

      const { level, levelRange } = this.determineGenerationLevel(levels, words);
      const generated: GeneratedWordExercise[] =
        await this.aiService.generateWordExercises(
          level,
          targetWords,
          10,
          domain,
          this.selectedGrammarTopics(),
          avoidSentences.length > 0 ? avoidSentences : undefined,
          levelRange
        );

      // Map AI output to WordExercise objects, using the AI's blankWords
      // (exact substrings) to compute character ranges. Matching by string
      // content is far more reliable than word indices, which the AI
      // frequently gets wrong due to tokenization differences.
      const exercises = generated
        .map((g) => {
          const matchedWord = combinedWords.find((w) =>
            g.targetWord.toLowerCase() === w.german.toLowerCase()
          );

          // Find each blank word in the sentence by searching for the exact string
          const blankRanges: BlankRange[] = [];
          let searchFrom = 0;
          for (const bw of g.blankWords) {
            const found = g.fullSentence.indexOf(bw, searchFrom);
            if (found === -1) {
              // Word not found — skip this exercise entirely
              return null;
            }
            blankRanges.push({
              start: found,
              end: found + bw.length,
            });
            searchFrom = found + bw.length;
          }

          // Skip if no valid blank ranges were produced
          if (blankRanges.length === 0) return null;

          return {
            wordId: matchedWord?.id ?? '',
            fullSentence: g.fullSentence,
            targetWord: g.targetWord,
            wordHint: g.wordHint,
            blankRanges,
            hasArticle: g.hasArticle,
            level: g.level,
            domain: g.domain,
            grammarTopics: g.grammarTopics,
            sessionCount: 0,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      this.wordExerciseService.addExercises(exercises);
    } catch (err) {
      console.error('Failed to generate exercises:', err);
    } finally {
      this.generating.set(false);
    }
  }

  checkAnswer(): void {
    const exercise = this.currentExercise();
    if (!exercise || !this.userInput().trim()) {
      return;
    }

    const userAnswer = this.userInput().trim().toLowerCase();
    const correctAnswer = this.expectedAnswer(exercise.exercise).toLowerCase();

    const correct = userAnswer === correctAnswer;
    this.result.set(correct);

    this.session.update((s) =>
      s.map((item, i) =>
        i === this.currentIndex() ? { ...item, correct } : item
      )
    );

    // Record attempt
    this.wordExerciseService.recordAttempt(exercise.exercise.id);

    // Auto-play the full sentence
    const fullSentence = this.buildFilledSentence(exercise.exercise, this.expectedAnswer(exercise.exercise));
    this.speechService.speak(fullSentence);

    // Translate the sentence via LibreTranslate (non-blocking)
    this.translateSentence(fullSentence);
  }

  adjustMastery(delta: number): void {
    const exercise = this.currentExercise();
    if (!exercise) {
      return;
    }
    const word = this.wordService
      .getWords()
      .find((w) => w.id === exercise.exercise.wordId);
    if (word) {
      const newMastery =
        delta === 100 ? 100 : Math.max(0, Math.min(100, word.mastery + delta));
      this.wordService.updateMastery(word.id, newMastery);
    }
    // Show visual feedback until user moves to next word
    this.masteryFeedback.set(delta);
  }

  private async translateSentence(sentence: string): Promise<void> {
    this.translationLoading.set(true);
    try {
      const result = await this.translationService.translateSentence(sentence);
      this.translation.set(result);
    } catch {
      // LibreTranslate not running — silently ignore
      this.translation.set(null);
    } finally {
      this.translationLoading.set(false);
    }
  }

  speakWord(): void {
    const exercise = this.currentExercise();
    if (exercise) {
      const fullSentence = this.buildFilledSentence(exercise.exercise, this.expectedAnswer(exercise.exercise));
      this.speechService.speak(fullSentence);
    }
  }

  nextExercise(): void {
    // Clear mastery feedback for the current word
    this.masteryFeedback.set(null);
    if (this.currentIndex() + 1 >= this.session().length) {
      this.practiceFinished.set(true);
      return;
    }
    this.currentIndex.update((i) => i + 1);
    this.userInput.set('');
    this.result.set(null);
    this.translation.set(null);
  }

  restart(): void {
    this.practiceStarted.set(false);
    this.practiceFinished.set(false);
    this.reviewMastered.set(false);
    this.session.set([]);
    this.currentIndex.set(0);
    this.userInput.set('');
    this.result.set(null);
  }
}