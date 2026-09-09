import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CommonModule } from '@angular/common';
import { WordService } from '../../services/word.service';
import { SettingsService } from '../../services/settings.service';
import { SpeechService } from '../../services/speech.service';
import { PartOfSpeechService } from '../../services/part-of-speech.service';
import { ImageCacheService } from '../../services/image-cache.service';
import { ImageGenerationService } from '../../services/image-generation.service';
import { DifficultyLevel, Gender, PartOfSpeech, VerbType, Word } from '../../models/word';
import { SrsGrade } from '../../services/srs.service';
import { AnswerField, buildAnswerFields, normalizeAnswer } from '../../utils/answer-fields';

/** Number of words practiced per session (same as the Gender Game). */
const SESSION_SIZE = 50;
/** localStorage key for the whole review-practice state. */
const STORAGE_KEY = 'german-dictionary-review-sessions';

type ReviewState = 'browse' | 'playing' | 'summary';
type CardDirection = 'de-native' | 'native-de';
type CardDirectionMode = 'de-native' | 'native-de' | 'both';

interface PracticeCard {
  word: Word;
  direction: CardDirection;
}

interface ReviewResult {
  word: Word;
  direction: CardDirection;
  correct: boolean;
}

interface RoundRecord {
  round: number;
  correct: number;
  answered: number;
  total: number;
}

interface ReviewSession {
  id: string;
  number: number;
  words: Word[];
  direction: CardDirectionMode;
  rounds: RoundRecord[];
  bestRound: number;
  startedAt: string;
  endedAt: string;
  /** Set on the transient summary shown for a replay (never persisted). */
  replayOf?: number;
}

interface PersistedActive {
  sessionNumber: number;
  words: Word[];
  currentIndex: number;
  round: number;
  currentResults: ReviewResult[];
  completedRounds: RoundRecord[];
  startedAt: string;
  direction: CardDirectionMode;
}

interface PersistedReviewState {
  playOrder: string[];
  poolSignature: string;
  nextStart: number;
  sessions: ReviewSession[];
  active?: PersistedActive;
}

@Component({
  selector: 'app-review',
  imports: [
    FormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    CommonModule,
  ],
  templateUrl: './review.component.html',
  styleUrl: './review.component.scss',
})
export class ReviewComponent {
  readonly genders: { key: Gender; label: string; color: string }[] = [
    { key: 'der', label: 'der', color: '#1976d2' },
    { key: 'die', label: 'die', color: '#d32f2f' },
    { key: 'das', label: 'das', color: '#388e3c' },
  ];

  readonly levels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
  readonly partsOfSpeech: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'numeral', 'phrase'];

  readonly fromDate = signal<Date | null>(null);
  readonly toDate = signal<Date | null>(null);
  readonly searchQuery = signal('');
  readonly posFilter = signal<PartOfSpeech | ''>('');
  readonly levelFilter = signal<DifficultyLevel | ''>('');
  readonly masteryMin = signal<number | null>(null);
  readonly masteryMax = signal<number | null>(null);

  // Image generation state
  readonly generatingImage = signal<Set<string>>(new Set());
  readonly imageData = signal<Map<string, string>>(new Map());

  // Full-size image modal
  readonly fullSizeImage = signal<{ data: string; german: string } | null>(null);

  readonly dateFilteredWords = computed(() =>
    this.wordService.getWordsByDateRange(this.fromDate(), this.toDate())
  );

  readonly filteredWords = computed(() => {
    let words = this.dateFilteredWords();
    const search = this.searchQuery().toLowerCase().trim();
    const pos = this.posFilter();
    const level = this.levelFilter();
    const min = this.masteryMin();
    const max = this.masteryMax();

    if (search) {
      words = words.filter(
        (w) =>
          w.german.toLowerCase().includes(search) ||
          w.translationEn.toLowerCase().includes(search) ||
          w.translationRu.toLowerCase().includes(search)
      );
    }
    if (pos) {
      words = words.filter((w) => w.partOfSpeech === pos);
    }
    if (level) {
      words = words.filter((w) => w.level === level);
    }
    if (min !== null) {
      words = words.filter((w) => w.mastery >= min);
    }
    if (max !== null) {
      words = words.filter((w) => w.mastery <= max);
    }
    return words;
  });

  readonly wordsByGender = computed(() => {
    const words = this.paginatedWords();
    const nouns = words.filter((w) => w.gender !== null);
    return {
      der: nouns.filter((w) => w.gender === 'der'),
      die: nouns.filter((w) => w.gender === 'die'),
      das: nouns.filter((w) => w.gender === 'das'),
      other: words.filter((w) => w.gender === null),
    };
  });

  readonly filterActive = computed(
    () =>
      this.fromDate() !== null ||
      this.toDate() !== null ||
      this.searchQuery().trim().length > 0 ||
      this.posFilter() !== '' ||
      this.levelFilter() !== '' ||
      this.masteryMin() !== null ||
      this.masteryMax() !== null
  );

  // Pagination
  readonly page = signal(1);
  readonly pageSize = signal(30);
  readonly pageSizeOptions = [10, 30, 50, 100];

  readonly equalDistribution = signal(false);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredWords().length / this.pageSize()))
  );

  readonly paginatedWords = computed(() => {
    const words = this.filteredWords();
    const size = this.pageSize();

    if (!this.equalDistribution()) {
      const start = (this.page() - 1) * size;
      return words.slice(start, start + size);
    }

    const der = words.filter((w) => w.gender === 'der');
    const die = words.filter((w) => w.gender === 'die');
    const das = words.filter((w) => w.gender === 'das');
    const other = words.filter((w) => w.gender === null);
    const columns = [der, die, das, other];

    const base = Math.floor(size / 4);
    const firstNGetExtra = size % 4;
    const perColumn = [0, 1, 2, 3].map((idx) => base + (idx < firstNGetExtra ? 1 : 0));

    const prevPages = this.page() - 1;
    const result: Word[] = [];
    for (let i = 0; i < 4; i++) {
      const skip = prevPages * perColumn[i];
      result.push(...columns[i].slice(skip, skip + perColumn[i]));
    }
    return result;
  });

  readonly expandedWordId = signal<string | null>(null);

  // ── Practice sessions (gender-game style, 50-word loop) ──
  readonly sessionSize = SESSION_SIZE;
  readonly state = signal<ReviewState>('browse');

  readonly activeSessionNumber = signal(0);
  private readonly queue = signal<PracticeCard[]>([]);
  private readonly currentIndex = signal(0);
  readonly round = signal(1);
  private readonly currentResults = signal<ReviewResult[]>([]);
  private readonly completedRounds = signal<RoundRecord[]>([]);
  private readonly activeStartedAt = signal('');
  private readonly activeDirection = signal<CardDirectionMode>('de-native');
  readonly lastSession = signal<ReviewSession | null>(null);
  private readonly replayOf = signal(0);

  // ── Persisted session cursor ──
  private readonly playOrder = signal<string[]>([]);
  private readonly poolSignature = signal('');
  private readonly nextStart = signal(0);
  private readonly sessions = signal<ReviewSession[]>([]);

  // ── Card interaction state (mirrors the SRS review session) ──
  readonly directionMode = signal<CardDirectionMode>('de-native');
  readonly revealed = signal(false);
  readonly selectedGrade = signal<SrsGrade | null>(null);
  readonly answerFields = signal<AnswerField[]>([]);
  readonly answersChecked = signal(false);
  readonly recorded = signal(false);
  readonly answerNonce = signal(0);

  readonly currentCard = computed<PracticeCard | null>(() => {
    const q = this.queue();
    const i = this.currentIndex();
    return i < q.length ? q[i] : null;
  });

  readonly currentNumber = computed(() => this.currentIndex() + 1);
  readonly totalWords = computed(() => this.queue().length);
  /** Correct answers in the current round. */
  readonly score = computed(
    () => this.currentResults().filter((r) => r.correct).length
  );
  readonly sessionProgress = computed(() => {
    const total = this.totalWords();
    if (total === 0) return 0;
    return Math.round(((this.currentIndex() + 1) / total) * 100);
  });
  /** Whether the current card was answered correctly (grade ≥ 2, or all typed fields right). */
  readonly currentCorrect = computed(() => {
    const card = this.currentCard();
    if (!card) return false;
    if (card.direction === 'de-native') {
      return this.selectedGrade() !== null && this.selectedGrade()! >= 2;
    }
    return (
      this.answerFields().length > 0 &&
      this.answerFields().every((f) => f.correct === true)
    );
  });
  /** Number of the next session that will be created. */
  readonly currentSessionNumber = computed(() => this.sessions().length + 1);
  readonly completedSessions = computed(() => [...this.sessions()].reverse());
  readonly hasActiveSession = computed(
    () => this.activeSessionNumber() > 0 && this.queue().length > 0
  );

  constructor(
    private readonly wordService: WordService,
    private readonly settingsService: SettingsService,
    private readonly speechService: SpeechService,
    private readonly posService: PartOfSpeechService,
    private readonly imageCache: ImageCacheService,
    private readonly imageGen: ImageGenerationService
  ) {
    // Keep page in valid range when filters change
    effect(() => {
      const total = this.totalPages();
      if (this.page() > total) {
        this.page.set(total);
      }
    });

    // Preload image data for visible words
    effect(async () => {
      const words = this.paginatedWords();
      const map = new Map<string, string>();
      for (const w of words) {
        const img = await this.imageCache.getImage(w.id);
        if (img) map.set(w.id, img);
      }
      this.imageData.set(map);
    });

    // Focus the first typed-answer input whenever a Native → German practice card renders.
    effect(() => {
      this.answerNonce();
      const card = this.currentCard();
      if (!card || card.direction !== 'native-de') return;
      if (this.state() !== 'playing' || this.revealed()) return;
      document.getElementById(`review-answer-${card.word.id}-0`)?.focus();
    });

    this.loadState();
  }

  async generateWordImage(word: Word): Promise<void> {
    this.generatingImage.update((s) => new Set(s).add(word.id));
    try {
      const data = await this.imageGen.generateImage(word);
      this.imageData.update((m) => {
        const next = new Map(m);
        next.set(word.id, data);
        return next;
      });
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      this.generatingImage.update((s) => {
        const next = new Set(s);
        next.delete(word.id);
        return next;
      });
    }
  }

  getTranslation(word: Word): string {
    return this.settingsService.getTranslation(word);
  }

  clearFilter(): void {
    this.fromDate.set(null);
    this.toDate.set(null);
    this.searchQuery.set('');
    this.posFilter.set('');
    this.levelFilter.set('');
    this.masteryMin.set(null);
    this.masteryMax.set(null);
    this.page.set(1);
  }

  setPage(p: number): void {
    const clamped = Math.min(Math.max(1, p), this.totalPages());
    this.page.set(clamped);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  pageRange(): number[] {
    const total = this.totalPages();
    const current = this.page();
    const range: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }

  speak(word: Word): void {
    const gender = word.gender ? `${word.gender} ` : '';
    this.speechService.speak(`${gender}${word.german}`);
  }

  getPosLabel(word: Word): string {
    return this.posService.getShortLabel(word.partOfSpeech);
  }

  getGenderColor(gender: Gender | null): string {
    return this.genders.find((g) => g.key === gender)?.color ?? '#757575';
  }

  getMasteryColor(mastery: number, genderColor: string): string {
    const hex = genderColor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const opacity = 0.05 + (mastery / 100) * 0.25;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  toggleExpand(wordId: string): void {
    this.expandedWordId.update((current) => (current === wordId ? null : wordId));
  }

  getVerbTypeLabel(type: VerbType | undefined): string {
    if (!type) return '';
    const labels: Record<VerbType, string> = { strong: 'stark', weak: 'schwach', mixed: 'gemischt' };
    return labels[type];
  }

  openFullSize(data: string, german: string): void {
    this.fullSizeImage.set({ data, german });
  }

  closeFullSize(): void {
    this.fullSizeImage.set(null);
  }

  // ── Practice sessions: flow ──

  /** Starts the next 50-word session from the current filter pool. */
  startSession(): void {
    this.preparePool();
    const ids = this.takeSlice();
    const words = this.buildQueue(ids);
    if (words.length === 0) return;

    this.replayOf.set(0);
    const direction = this.directionMode();
    this.activeDirection.set(direction);
    this.beginPlay(words, this.currentSessionNumber(), direction, new Date().toISOString());
  }

  replaySession(session: ReviewSession): void {
    this.replayOf.set(session.number);
    this.beginPlay(session.words, session.number, session.direction, session.startedAt);
  }

  /** Resumes a persisted active session (same words, same round/index). */
  resumeSession(): void {
    this.state.set('playing');
    this.lastSession.set(null);
    this.replayOf.set(0);
    this.resetCardState();
    this.saveState();
  }

  private beginPlay(
    words: Word[],
    number: number,
    direction: CardDirectionMode,
    startedAt: string
  ): void {
    this.queue.set(this.buildPracticeCards(words, direction));
    this.currentIndex.set(0);
    this.round.set(1);
    this.currentResults.set([]);
    this.completedRounds.set([]);
    this.lastSession.set(null);
    this.activeSessionNumber.set(number);
    this.activeStartedAt.set(startedAt);
    this.resetCardState();
    this.state.set('playing');
    this.saveState();
  }

  /** Grades the shown card (German → Native). Grade ≥ 2 counts as correct. */
  recordGrade(grade: SrsGrade): void {
    const card = this.currentCard();
    if (!card || this.recorded()) return;
    this.recordResult(card, grade >= 2);
    this.selectedGrade.set(grade);
  }

  /** Scores the typed answers (Native → German). All fields correct = correct. */
  checkAnswers(): void {
    const card = this.currentCard();
    if (!card || this.recorded()) return;

    this.answerFields.update((fields) =>
      fields.map((f) => ({
        ...f,
        correct: normalizeAnswer(f.value) === f.expectedKey,
      }))
    );
    this.answersChecked.set(true);
    this.revealed.set(true);
    this.recordResult(card, this.answerFields().every((f) => f.correct));
    this.speakWord(card.word);
  }

  /** Gives up on typing: reveals the German word, counts as incorrect. */
  showAnswer(): void {
    const card = this.currentCard();
    if (!card || this.recorded()) return;
    this.revealed.set(true);
    this.recordResult(card, false);
  }

  onFrontClick(): void {
    const card = this.currentCard();
    if (!card || card.direction !== 'de-native' || this.revealed()) return;
    this.revealed.set(true);
    this.speakWord(card.word);
  }

  onAnswerInput(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.answerFields.update((fields) =>
      fields.map((f, i) => (i === index ? { ...f, value } : f))
    );
  }

  onAnswerEnter(index: number, event: Event): void {
    event.preventDefault();
    const card = this.currentCard();
    if (!card) return;
    if (index + 1 < this.answerFields().length) {
      document.getElementById(`review-answer-${card.word.id}-${index + 1}`)?.focus();
    } else {
      this.checkAnswers();
    }
  }

  /** Moves to the next card, wrapping to round 2+ after the last one. */
  nextWord(): void {
    const length = this.queue().length;
    if (length === 0) return;

    if (this.currentIndex() + 1 >= length) {
      // Round complete — record it and start a new round with the same cards.
      const results = this.currentResults();
      this.completedRounds.update((rounds) => [
        ...rounds,
        {
          round: this.round(),
          correct: results.filter((r) => r.correct).length,
          answered: results.length,
          total: length,
        },
      ]);
      this.round.update((r) => r + 1);
      this.currentIndex.set(0);
      this.currentResults.set([]);
    } else {
      this.currentIndex.update((i) => i + 1);
    }
    this.resetCardState();
    this.saveState();
  }

  /** Ends the session (even mid-round) and records it as completed. */
  endSession(): void {
    const cards = this.queue();
    const words = cards.map((c) => c.word);
    if (words.length === 0) return;

    const results = this.currentResults();
    const finalRound: RoundRecord = {
      round: this.round(),
      correct: results.filter((r) => r.correct).length,
      answered: results.length,
      total: words.length,
    };
    const rounds = [...this.completedRounds(), finalRound];
    const isReplay = this.replayOf() > 0;

    const session: ReviewSession = {
      id: crypto.randomUUID(),
      number: isReplay ? this.replayOf() : this.currentSessionNumber(),
      words,
      direction: this.activeDirection(),
      rounds,
      bestRound: this.computeBest(rounds),
      startedAt: this.activeStartedAt(),
      endedAt: new Date().toISOString(),
    };
    if (isReplay) {
      session.replayOf = this.replayOf();
    } else {
      this.sessions.update((s) => [...s, session]);
    }

    this.lastSession.set(session);
    this.state.set('summary');
    this.saveState();
  }

  toBrowse(): void {
    this.state.set('browse');
    this.saveState();
  }

  private recordResult(card: PracticeCard, correct: boolean): void {
    this.recorded.set(true);
    this.currentResults.update((results) => [
      ...results,
      { word: card.word, direction: card.direction, correct },
    ]);
    this.saveState();
  }

  private resetCardState(): void {
    const card = this.currentCard();
    this.revealed.set(false);
    this.answersChecked.set(false);
    this.recorded.set(false);
    this.selectedGrade.set(null);
    if (card && card.direction === 'native-de') {
      this.answerFields.set(buildAnswerFields(card.word));
    } else {
      this.answerFields.set([]);
    }
    this.answerNonce.update((n) => n + 1);
  }

  speakWord(word: Word): void {
    const gender = word.gender ? `${word.gender} ` : '';
    this.speechService.speak(`${gender}${word.german}`);
  }

  // ── Practice sessions: construction ──

  private buildPracticeCards(
    words: Word[],
    direction: CardDirectionMode
  ): PracticeCard[] {
    if (direction !== 'both') {
      return words.map((w) => ({ word: w, direction: direction as CardDirection }));
    }

    // Bidirectional: interleave German→Native and Native→German cards.
    const deNativeOrder = [...words].sort(() => Math.random() - 0.5);
    const nativeDeOrder = [...words].sort(() => Math.random() - 0.5);
    const deNativeCards = deNativeOrder.map((w) => ({
      word: w,
      direction: 'de-native' as CardDirection,
    }));
    const nativeDeCards = nativeDeOrder.map((w) => ({
      word: w,
      direction: 'native-de' as CardDirection,
    }));
    return this.mergeBidirectionalCards(deNativeCards, nativeDeCards);
  }

  private mergeBidirectionalCards(
    deNativeCards: PracticeCard[],
    nativeDeCards: PracticeCard[]
  ): PracticeCard[] {
    const nativeDeMap = new Map<string, PracticeCard>();
    for (const card of nativeDeCards) {
      nativeDeMap.set(card.word.id, card);
    }

    const result = [...deNativeCards];
    const remainingNativeDe = new Map(nativeDeMap);

    for (const deNativeCard of deNativeCards) {
      const nativeDeCard = remainingNativeDe.get(deNativeCard.word.id);
      if (!nativeDeCard) continue;

      const deNativeIndex = result.indexOf(deNativeCard);
      if (deNativeIndex === -1) continue;

      const maxInsertPos = result.length;
      const minInsertPos = deNativeIndex + 1;
      const insertPos =
        minInsertPos + Math.floor(Math.random() * (maxInsertPos - minInsertPos + 1));

      result.splice(insertPos, 0, nativeDeCard);
      remainingNativeDe.delete(deNativeCard.word.id);
    }

    return result;
  }

  private preparePool(): void {
    const words = this.filteredWords();
    const ids = words.map((w) => w.id);
    if (ids.length === 0) return;

    const signature = ids.join(',');
    const order = this.playOrder();
    if (order.length === 0 || signature !== this.poolSignature()) {
      this.shuffle(ids);
      this.playOrder.set(ids);
      this.poolSignature.set(signature);
      this.nextStart.set(0);
    }
  }

  private takeSlice(): string[] {
    let order = this.playOrder();
    let start = this.nextStart();

    if (start >= order.length) {
      // Pool exhausted — reshuffle the current pool and begin again.
      const ids = this.filteredWords().map((w) => w.id);
      this.shuffle(ids);
      this.playOrder.set(ids);
      this.poolSignature.set(ids.join(','));
      this.nextStart.set(0);
      order = ids;
      start = 0;
    }

    const slice = order.slice(start, start + SESSION_SIZE);
    this.nextStart.set(start + slice.length);
    return slice;
  }

  private buildQueue(ids: string[]): Word[] {
    const byId = new Map(this.filteredWords().map((w) => [w.id, w] as const));
    const queue: Word[] = [];
    for (const id of ids) {
      const word = byId.get(id);
      if (word) queue.push(word);
    }
    return queue;
  }

  // ── Practice sessions: summary helpers ──

  sessionFinalRound(s: ReviewSession): RoundRecord | null {
    return s.rounds.length > 0 ? s.rounds[s.rounds.length - 1] : null;
  }

  sessionMeta(s: ReviewSession): string {
    const d = new Date(s.endedAt);
    const date = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${s.words.length} words · ${s.direction} · Best ${s.bestRound}/${s.words.length} · ${date} ${time}`;
  }

  private computeBest(rounds: RoundRecord[]): number {
    return rounds.reduce((best, r) => Math.max(best, r.correct), 0);
  }

  // ── Persistence ──

  private loadState(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedReviewState;
      this.playOrder.set(parsed.playOrder ?? []);
      this.poolSignature.set(parsed.poolSignature ?? '');
      this.nextStart.set(parsed.nextStart ?? 0);
      this.sessions.set(parsed.sessions ?? []);
      if (parsed.active) {
        const a = parsed.active;
        this.activeSessionNumber.set(a.sessionNumber);
        this.queue.set(this.buildPracticeCards(a.words, a.direction));
        this.currentIndex.set(a.currentIndex);
        this.round.set(a.round);
        this.currentResults.set(a.currentResults);
        this.completedRounds.set(a.completedRounds);
        this.activeStartedAt.set(a.startedAt);
        this.activeDirection.set(a.direction);
        this.replayOf.set(0);
        // Keep browsing on load; the "Continue" button resumes the session.
      }
    } catch {
      // Corrupt/old storage — start fresh.
    }
  }

  private saveState(): void {
    const active: PersistedActive | undefined =
      this.state() === 'playing'
        ? {
            sessionNumber: this.activeSessionNumber(),
            words: this.queue().map((c) => c.word),
            currentIndex: this.currentIndex(),
            round: this.round(),
            currentResults: this.currentResults(),
            completedRounds: this.completedRounds(),
            startedAt: this.activeStartedAt(),
            direction: this.activeDirection(),
          }
        : undefined;
    const data: PersistedReviewState = {
      playOrder: this.playOrder(),
      poolSignature: this.poolSignature(),
      nextStart: this.nextStart(),
      sessions: this.sessions(),
    };
    if (active) data.active = active;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to persist review session state.', err);
    }
  }

  private shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
