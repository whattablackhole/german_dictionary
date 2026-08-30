import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CommonModule } from '@angular/common';
import { WordService } from '../../services/word.service';
import { SettingsService } from '../../services/settings.service';
import { DomainService } from '../../services/domain.service';
import { GrammarTopicService } from '../../services/grammar-topic.service';
import { PartOfSpeechService, PartOfSpeechInfo } from '../../services/part-of-speech.service';
import { WordExerciseService } from '../../services/word-exercise.service';
import { AiService } from '../../services/ai.service';
import { DifficultyLevel, PartOfSpeech, Word } from '../../models/word';
import { WordExercise } from '../../models/word-exercise';
import { StoryExercise } from '../../models/story-exercise';
import { StoryExerciseResult } from '../../models/story-exercise-history';
import { toStoryExercise } from '../../services/story-exercise-builder';
import { ExerciseListComponent } from '../../components/exercise-list/exercise-list.component';

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
    MatSlideToggleModule,
    CommonModule,
    ExerciseListComponent,
  ],
  templateUrl: './practice-word.component.html',
  styleUrl: './practice-word.component.scss',
})
export class PracticeWordComponent {
  readonly allLevels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

  readonly selectedLevels = signal<DifficultyLevel[]>([]);
  readonly generating = signal(false);
  readonly practiceStarted = signal(false);
  readonly reviewMastered = signal(false);
  readonly sessionError = signal('');
  readonly sessionExercises = signal<StoryExercise[]>([]);

  // Selected-words mode (ignores accumulated progress)
  readonly selectedWordsOnly = signal(false);
  readonly maxWords = signal(10);

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
  readonly wordPriorityFilter = signal<'all' | 'priority' | 'nonpriority'>('all');

  readonly filteredWords = computed(() => {
    let words = this.wordService.getWords();
    const search = this.wordSearchQuery().toLowerCase().trim();
    const from = this.wordDateFrom();
    const to = this.wordDateTo();
    const priority = this.wordPriorityFilter();

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
    if (priority === 'priority') {
      words = words.filter((w) => w.priority === true);
    } else if (priority === 'nonpriority') {
      words = words.filter((w) => !w.priority);
    }

    return words;
  });

  readonly forcedWordCount = computed(() => this.forcedWordIds().size);

  readonly forcedWordList = computed<Word[]>(() => {
    const words = this.wordService.getWords();
    return Array.from(this.forcedWordIds())
      .map((id) => words.find((w) => w.id === id))
      .filter((w): w is Word => w !== undefined);
  });

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
    private readonly aiService: AiService
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

togglePartOfSpeech(pos: PartOfSpeech): void {
    this.selectedPartsOfSpeech.update((positions) =>
      positions.includes(pos)
        ? positions.filter((p) => p !== pos)
        : [...positions, pos]
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

  isPriorityWord(word: Word): boolean {
    return word.priority === true;
  }

  // ── Session start ──

  async startPractice(): Promise<void> {
    if (this.selectedWordsOnly()) {
      await this.startSelectedWordsSession();
    } else {
      await this.startProgressSession();
    }
  }

  /** Regular mode: selects words based on accumulated progress and generates a mixed session. */
  private async startProgressSession(): Promise<void> {
    const levels =
      this.selectedLevels().length > 0
        ? this.selectedLevels()
        : this.allLevels;
    const domain = this.selectedDomain() ?? undefined;

    this.generating.set(true);
    this.sessionError.set('');
    try {
      const words = this.wordService.getWords();

      // In-progress words (practiced before, not mastered) come first.
      const inProgress = this.wordExerciseService.getInProgressExercises(levels, domain, words);
      const inProgressWordIds = new Set(inProgress.map((e) => e.wordId));
      const poolWords: Word[] = [];
      for (const id of inProgressWordIds) {
        const w = words.find((x) => x.id === id);
        if (w && !poolWords.some((p) => p.id === w.id)) poolWords.push(w);
      }

      // Then new / never-practiced words.
      const newExercises = this.wordExerciseService.getNewExercises(levels, domain);
      const newWordIds = new Set(newExercises.map((e) => e.wordId));
      for (const id of newWordIds) {
        const w = words.find((x) => x.id === id);
        if (w && !poolWords.some((p) => p.id === w.id)) poolWords.push(w);
      }

      // Fill remaining slots with the existing weighted algorithm.
      if (poolWords.length < 10) {
        const { wordIdsToExclude } = this.wordExerciseService.getGenerationContext(words);
        const auto = this.wordService.selectWordsForPractice(
          levels,
          10 - poolWords.length,
          this.selectedPartsOfSpeech()
        );
        for (const w of auto) {
          if (!poolWords.some((p) => p.id === w.id) && !wordIdsToExclude.has(w.id)) {
            poolWords.push(w);
          }
        }
      }

      const target = poolWords.slice(0, 10);
      if (target.length === 0) {
        this.sessionError.set('No words to practice. Add new words or select specific words first.');
        return;
      }

      const exercises = await this.generateStoryExercises(target, levels, domain);
      if (exercises.length === 0) {
        this.sessionError.set('The AI could not generate exercises. Please try again.');
        return;
      }

      // Keep the accumulated pool growing: persist cloze sentences for new words.
      this.persistClozeProgress(target, exercises, domain);

      this.startSession(exercises);
    } catch (err) {
      this.sessionError.set(
        err instanceof Error ? err.message : 'Failed to generate exercises. Try again.'
      );
    } finally {
      this.generating.set(false);
    }
  }

  /** Selected-words mode: generates out-of-order exercises ONLY for the chosen words. */
  private async startSelectedWordsSession(): Promise<void> {
    const levels =
      this.selectedLevels().length > 0
        ? this.selectedLevels()
        : this.allLevels;
    const domain = this.selectedDomain() ?? undefined;

    this.generating.set(true);
    this.sessionError.set('');
    try {
      const forced = this.forcedWordList();
      if (forced.length === 0) {
        this.sessionError.set('Select at least one word from the list to practice.');
        return;
      }
      // Clamp the user-entered max-words value (input may yield a string) to 1..50.
      const maxCount = Math.max(1, Math.min(50, Number(this.maxWords()) || 1));
      const target = forced.slice(0, maxCount);
      const exercises = await this.generateStoryExercises(target, levels, domain);
      if (exercises.length === 0) {
        this.sessionError.set('The AI could not generate exercises. Please try again.');
        return;
      }
      this.startSession(exercises);
    } catch (err) {
      this.sessionError.set(
        err instanceof Error ? err.message : 'Failed to generate exercises. Try again.'
      );
    } finally {
      this.generating.set(false);
    }
  }

  /** Review already-mastered words using their accumulated cloze exercises. */
  startReviewMastered(): void {
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

    this.sessionError.set('');
    this.reviewMastered.set(true);
    this.startSession(
      this.shuffleArray(mastered.map((e) => this.toClozeStoryExercise(e)))
    );
  }

  private generateStoryExercises(
    target: Word[],
    levels: DifficultyLevel[],
    domain?: string
  ): Promise<StoryExercise[]> {
    const { level } = this.determineGenerationLevel(levels, target);
    return this.aiService
      .generateStoryExercises({
        words: target.map((w) => ({
          german: w.german,
          translationEn: w.translationEn,
          translationRu: w.translationRu,
          partOfSpeech: w.partOfSpeech,
          pluralForm: w.pluralForm,
          simplePast: w.simplePast,
          pastParticiple: w.pastParticiple,
        })),
        storyLevel: level,
        storyDomain: domain ?? 'Everyday life',
        translationLanguage:
          this.settingsService.translationLanguage() === 'ru' ? 'ru' : 'en',
        storyText: undefined,
      })
      .then((generated) =>
        this.shuffleArray(
          generated
            .map((g) => toStoryExercise(g, 'practice-word', level))
            .filter((e): e is StoryExercise => e !== null)
        )
      );
  }

  /** Persists one cloze exercise per practiced word that has no pool entry yet. */
  private persistClozeProgress(
    target: Word[],
    exercises: StoryExercise[],
    domain?: string
  ): void {
    const existingIds = new Set(this.wordExerciseService.getExercises().map((e) => e.wordId));
    const clozeByWord = new Map<string, StoryExercise>();
    for (const ex of exercises) {
      if (ex.type === 'cloze') {
        const key = ex.word.trim().toLowerCase();
        if (!clozeByWord.has(key)) clozeByWord.set(key, ex);
      }
    }

    const toAdd: Omit<WordExercise, 'id' | 'createdAt'>[] = [];
    for (const w of target) {
      if (existingIds.has(w.id)) continue;
      const cloze = clozeByWord.get(w.german.trim().toLowerCase());
      if (!cloze || !cloze.clozeSentence) continue;
      const ranges = this.computeBlankRanges(cloze.clozeSentence, cloze.clozeBlankWords ?? []);
      if (ranges.length === 0) continue;
      toAdd.push({
        wordId: w.id,
        fullSentence: cloze.clozeSentence,
        targetWord: cloze.word,
        wordHint: cloze.clozeHint ?? w.translationEn,
        blankRanges: ranges,
        hasArticle: false,
        level: cloze.level,
        domain: domain ?? 'General',
        grammarTopics: [],
        sessionCount: 0,
      });
    }
    if (toAdd.length > 0) {
      this.wordExerciseService.addExercises(toAdd);
    }
  }

  private computeBlankRanges(sentence: string, blanks: string[]): { start: number; end: number }[] {
    const ranges: { start: number; end: number }[] = [];
    let searchFrom = 0;
    for (const bw of blanks) {
      const found = sentence.indexOf(bw, searchFrom);
      if (found === -1) return [];
      ranges.push({ start: found, end: found + bw.length });
      searchFrom = found + bw.length;
    }
    return ranges;
  }

  private toClozeStoryExercise(ex: WordExercise): StoryExercise {
    const blankWords = ex.blankRanges.map((r) => ex.fullSentence.slice(r.start, r.end));
    return {
      id: ex.id,
      storyId: 'practice-word',
      word: ex.targetWord,
      type: 'cloze',
      level: ex.level,
      clozeSentence: ex.fullSentence,
      clozeBlankWords: blankWords,
      clozeHint: ex.wordHint,
    };
  }

  private startSession(exercises: StoryExercise[]): void {
    this.sessionExercises.set(exercises);
    this.practiceStarted.set(true);
  }

  /** Comes from the shared exercise player when the user finishes the session. */
  onSessionComplete(results: StoryExerciseResult[]): void {
    this.trackProgress(results);
  }

  /** Comes from the shared exercise player when the user exits the session. */
  onSessionQuit(results: StoryExerciseResult[]): void {
    this.trackProgress(results);
    this.restart();
  }

  /** Updates the accumulative pool counters (only in progress-based modes). */
  private trackProgress(results: StoryExerciseResult[]): void {
    if (this.selectedWordsOnly() || this.reviewMastered()) return;

    const words = this.wordService.getWords();
    const wordByText = new Map(words.map((w) => [w.german.trim().toLowerCase(), w]));
    const session = this.sessionExercises();

    for (const r of results) {
      if (!r.answered) continue;
      const ex = session.find((e) => e.id === r.exerciseId);
      if (!ex) continue;
      const word = wordByText.get(ex.word.trim().toLowerCase());
      if (!word) continue;
      const pool = this.wordExerciseService.getExercisesForWord(word.id);
      if (pool.length > 0) {
        this.wordExerciseService.recordAttempt(pool[0].id);
      }
    }
  }

  /** Applies a mastery self-assessment emitted by the shared player. */
  onMasteryAdjust(event: { word: string; delta: number }): void {
    const word = this.wordService
      .getWords()
      .find((w) => w.german.trim().toLowerCase() === event.word.trim().toLowerCase());
    if (!word) return;
    const newMastery =
      event.delta === 100
        ? 100
        : Math.max(0, Math.min(100, word.mastery + event.delta));
    this.wordService.updateMastery(word.id, newMastery);
  }

  restart(): void {
    this.practiceStarted.set(false);
    this.reviewMastered.set(false);
    this.sessionExercises.set([]);
    this.sessionError.set('');
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

  /** Determine the AI generation level range based on user selection and available words. */
  private determineGenerationLevel(
    levels: DifficultyLevel[],
    words: Word[]
  ): { level: DifficultyLevel; levelRange: DifficultyLevel[] } {
    let levelSet: Set<DifficultyLevel>;

    if (this.selectedLevels().length > 0) {
      // User explicitly selected levels => use exactly those
      levelSet = new Set(this.selectedLevels());
    } else {
      // No levels selected => find the range from lowest to highest level among our words
      const wordLevels = new Set(words.map((w) => w.level));
      if (wordLevels.size === 0) {
        return { level: 'A1', levelRange: ['A1'] };
      }
      levelSet = wordLevels;
    }

    const minIdx = Math.min(...Array.from(levelSet).map((l) => this.levelOrder[l]));
    const maxIdx = Math.max(...Array.from(levelSet).map((l) => this.levelOrder[l]));
    const levelRange = this.allLevelsOrdered.slice(minIdx, maxIdx + 1);
    // Use the highest level as the primary level for the prompt
    return { level: levelRange[levelRange.length - 1], levelRange };
  }
}
