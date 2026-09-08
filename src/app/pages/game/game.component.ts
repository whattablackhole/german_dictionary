import { Component, computed, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { WordService } from '../../services/word.service';
import { SettingsService } from '../../services/settings.service';
import { SpeechService } from '../../services/speech.service';
import { Gender, Word } from '../../models/word';

/** Number of German words per session. */
const SESSION_SIZE = 50;
/** localStorage key for the whole gender-game state. */
const STORAGE_KEY = 'german-dictionary-gender-game';

interface GameResult {
  word: Word;
  selected: Gender;
  correct: boolean;
}

interface RoundRecord {
  round: number;
  correct: number;
  answered: number;
  total: number;
}

interface GameSession {
  id: string;
  number: number;
  words: Word[];
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
  currentResults: GameResult[];
  completedRounds: RoundRecord[];
  startedAt: string;
}

interface PersistedGameState {
  playOrder: string[];
  poolSignature: string;
  nextStart: number;
  sessions: GameSession[];
  active?: PersistedActive;
}

@Component({
  selector: 'app-game',
  imports: [
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
  ],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent {
  readonly genders: { key: Gender; label: string; color: string }[] = [
    { key: 'der', label: 'der', color: '#1976d2' },
    { key: 'die', label: 'die', color: '#d32f2f' },
    { key: 'das', label: 'das', color: '#388e3c' },
  ];

  readonly sessionSize = SESSION_SIZE;

  readonly fromDate = signal<Date | null>(null);
  readonly toDate = signal<Date | null>(null);

  // ── Screen/flow state ──
  readonly state = signal<'hub' | 'playing' | 'summary'>('hub');

  // ── Active session state ──
  readonly activeSessionNumber = signal(0);
  private readonly queue = signal<Word[]>([]);
  private readonly currentIndex = signal(0);
  readonly round = signal(1);
  private readonly currentResults = signal<GameResult[]>([]);
  private readonly completedRounds = signal<RoundRecord[]>([]);
  private readonly activeStartedAt = signal('');
  readonly lastSession = signal<GameSession | null>(null);
  private readonly replayOf = signal(0);
  readonly selectedGender = signal<Gender | null>(null);

  // ── Persisted session cursor ──
  private readonly playOrder = signal<string[]>([]);
  private readonly poolSignature = signal('');
  private readonly nextStart = signal(0);
  private readonly sessions = signal<GameSession[]>([]);

  readonly currentWord = computed<Word | null>(() => {
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
  readonly filteredWords = computed(() =>
    this.wordService.getWordsByDateRange(this.fromDate(), this.toDate())
  );
  readonly filteredNouns = computed(() =>
    this.filteredWords().filter((w) => w.partOfSpeech === 'noun')
  );
  readonly availableNouns = computed(() => this.filteredNouns().length);
  readonly filterActive = computed(
    () => this.fromDate() !== null || this.toDate() !== null
  );
  /** Number of the next session that will be created. */
  readonly currentSessionNumber = computed(() => this.sessions().length + 1);
  /** Completed sessions, newest first. */
  readonly completedSessions = computed(() => [...this.sessions()].reverse());

  constructor(
    private readonly wordService: WordService,
    private readonly settingsService: SettingsService,
    private readonly speechService: SpeechService
  ) {
    this.loadState();
  }

  getTranslation(word: Word): string {
    return this.settingsService.getTranslation(word);
  }

  clearFilter(): void {
    this.fromDate.set(null);
    this.toDate.set(null);
  }

  speakCurrentWord(): void {
    const word = this.currentWord();
    if (word) {
      this.speechService.speak(`${word.gender} ${word.german}`);
    }
  }

  // ── Session flow ──

  /** Starts the next 50-word session from the current pool. */
  startSession(): void {
    this.preparePool();
    const ids = this.takeSlice();
    const words = this.buildQueue(ids);
    if (words.length === 0) return;

    this.replayOf.set(0);
    this.beginPlay(words, this.currentSessionNumber(), new Date().toISOString());
  }

  /** Replays a previously completed session (does not create a new record). */
  replaySession(session: GameSession): void {
    this.replayOf.set(session.number);
    this.beginPlay(session.words, session.number, session.startedAt);
  }

  private beginPlay(words: Word[], number: number, startedAt: string): void {
    this.queue.set(words);
    this.currentIndex.set(0);
    this.round.set(1);
    this.currentResults.set([]);
    this.completedRounds.set([]);
    this.selectedGender.set(null);
    this.lastSession.set(null);
    this.activeSessionNumber.set(number);
    this.activeStartedAt.set(startedAt);
    this.state.set('playing');
    this.saveState();
  }

  selectGender(gender: Gender): void {
    if (this.selectedGender() !== null) {
      return;
    }
    const word = this.currentWord();
    if (!word) {
      return;
    }
    this.selectedGender.set(gender);
    this.currentResults.update((results) => [
      ...results,
      { word, selected: gender, correct: gender === word.gender },
    ]);
    this.saveState();

    // Automatically pronounce the correct article + word
    this.speechService.speak(`${word.gender} ${word.german}`);
  }

  /** Moves to the next word, wrapping to round 2+ after the last word. */
  nextWord(): void {
    const length = this.queue().length;
    if (length === 0) return;

    if (this.currentIndex() + 1 >= length) {
      // Round complete — record it and start a new round with the same words.
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
    this.selectedGender.set(null);
    this.saveState();
  }

  /** Ends the session (even mid-round) and records it as completed. */
  endSession(): void {
    const words = this.queue();
    const length = words.length;
    if (length === 0) {
      return;
    }

    const results = this.currentResults();
    const finalRound: RoundRecord = {
      round: this.round(),
      correct: results.filter((r) => r.correct).length,
      answered: results.length,
      total: length,
    };
    const rounds = [...this.completedRounds(), finalRound];
    const isReplay = this.replayOf() > 0;

    const session: GameSession = {
      id: crypto.randomUUID(),
      number: isReplay ? this.replayOf() : this.currentSessionNumber(),
      words,
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

  toHub(): void {
    this.state.set('hub');
    this.saveState();
  }

  // ── Session construction ──

  private preparePool(): void {
    const nouns = this.filteredNouns();
    const ids = nouns.map((w) => w.id);
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
      const ids = this.filteredNouns().map((w) => w.id);
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

  // ── Summary helpers ──

  sessionFinalRound(s: GameSession): RoundRecord | null {
    return s.rounds.length > 0 ? s.rounds[s.rounds.length - 1] : null;
  }

  sessionMeta(s: GameSession): string {
    const d = new Date(s.endedAt);
    const date = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${s.words.length} words · Best ${s.bestRound}/${s.words.length} · ${date} ${time}`;
  }

  private computeBest(rounds: RoundRecord[]): number {
    return rounds.reduce((best, r) => Math.max(best, r.correct), 0);
  }

  // ── Persistence ──

  private loadState(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedGameState;
      this.playOrder.set(parsed.playOrder ?? []);
      this.poolSignature.set(parsed.poolSignature ?? '');
      this.nextStart.set(parsed.nextStart ?? 0);
      this.sessions.set(parsed.sessions ?? []);
      if (parsed.active) {
        const a = parsed.active;
        this.activeSessionNumber.set(a.sessionNumber);
        this.queue.set(a.words);
        this.currentIndex.set(a.currentIndex);
        this.round.set(a.round);
        this.currentResults.set(a.currentResults);
        this.completedRounds.set(a.completedRounds);
        this.activeStartedAt.set(a.startedAt);
        this.replayOf.set(0);
        this.state.set('playing');
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
            words: this.queue(),
            currentIndex: this.currentIndex(),
            round: this.round(),
            currentResults: this.currentResults(),
            completedRounds: this.completedRounds(),
            startedAt: this.activeStartedAt(),
          }
        : undefined;
    const data: PersistedGameState = {
      playOrder: this.playOrder(),
      poolSignature: this.poolSignature(),
      nextStart: this.nextStart(),
      sessions: this.sessions(),
    };
    if (active) data.active = active;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  private shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}