import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { PrepositionService } from '../../services/preposition.service';
import { AiService } from '../../services/ai.service';
import { SettingsService } from '../../services/settings.service';
import { DifficultyLevel } from '../../models/word';
import { WordService } from '../../services/word.service';
import {
  CASE_LABELS,
  GermanCase,
  PrepositionFlashcard,
  PrepositionRule,
} from '../../models/preposition-rule';

type TrainerMode = 'rules' | 'verbs' | 'ai';

interface SessionCard {
  card: PrepositionFlashcard;
  selectedOption: string | null;
  answered: boolean;
  correct: boolean;
  pairId?: string;
}

interface AiExerciseData {
  sentenceWithBlank: string;
  correctPreposition: string;
  correctCase: GermanCase;
  hintEn: string;
  hintRu: string;
  explanation: string;
  options: string[];
  title: string;
}

@Component({
  selector: 'app-preposition-trainer',
  imports: [
    FormsModule,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatCardModule,
  ],
  templateUrl: './preposition-trainer.component.html',
  styleUrl: './preposition-trainer.component.scss',
})
export class PrepositionTrainerComponent {
  readonly mode = signal<TrainerMode>('rules');
  readonly selectedRuleId = signal<string | null>(null);

  // Session state
  readonly sessionCards = signal<SessionCard[]>([]);
  readonly currentIndex = signal(0);
  readonly sessionActive = signal(false);
  readonly sessionFinished = signal(false);
  readonly sessionTitle = signal('');
  readonly sessionType = signal<'rule' | 'verb' | 'ai'>('rule');

  // Verb pair session filters
  readonly selectedLevel = signal<DifficultyLevel | ''>('');

  // AI exercise state
  readonly aiExercise = signal<AiExerciseData | null>(null);
  readonly aiLoading = signal(false);
  readonly aiError = signal('');
  readonly aiInput = signal('');
  readonly aiResult = signal<{ correct: boolean; message: string } | null>(null);

  /** Queue of already-generated exercises, shown immediately on "Next". */
  private aiQueue: AiExerciseData[] = [];
  /** True while the next exercise is being generated in the background. */
  readonly aiPrefetching = signal(false);
  /** How many exercises to keep ready ahead of the current one. */
  private readonly PREFETCH_TARGET = 2;
  /** Incremented to invalidate stale async generation when leaving/re-entering AI mode. */
  private aiGenToken = 0;

  readonly levels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

  readonly rules = computed(() => this.prepositionService.getAllRules());
  readonly allPairs = computed(() => this.prepositionService.getAllPairs());

  readonly selectedRule = computed(() => {
    const id = this.selectedRuleId();
    return id ? this.prepositionService.getRuleById(id) ?? null : null;
  });

  readonly currentCard = computed(() => {
    const cards = this.sessionCards();
    const i = this.currentIndex();
    return i < cards.length ? cards[i] : null;
  });

  readonly currentNumber = computed(() => this.currentIndex() + 1);
  readonly totalCards = computed(() => this.sessionCards().length);
  readonly correctCount = computed(
    () => this.sessionCards().filter((c) => c.answered && c.correct).length
  );

  readonly scorePercent = computed(() => {
    const total = this.totalCards();
    if (total === 0) return 0;
    return Math.round((this.correctCount() / total) * 100);
  });

  readonly masteredPairsCount = computed(
    () => this.prepositionService.masteredPairs().filter((m) => m.mastery >= 80).length
  );

  readonly pairList = computed(() => {
    const level = this.selectedLevel();
    const pairs = this.prepositionService.getPairsByLevel(level || undefined);
    return pairs.map((p) => ({
      pair: p,
      mastery: this.prepositionService.getMasteryValue(p.id),
    }));
  });

  constructor(
    private readonly prepositionService: PrepositionService,
    private readonly aiService: AiService,
    private readonly settingsService: SettingsService,
    private readonly wordService: WordService
  ) {}

  // ─────────────────────────────────────────────
  // MODE SWITCHING
  // ─────────────────────────────────────────────

  setMode(mode: TrainerMode): void {
    this.mode.set(mode);
    this.sessionActive.set(false);
    this.sessionFinished.set(false);
    this.sessionCards.set([]);
    this.aiResult.set(null);
    this.aiExercise.set(null);
    // Invalidate any in-flight AI generation and clear the prefetch queue
    this.aiGenToken++;
    this.aiQueue = [];
    this.aiPrefetching.set(false);
    this.aiError.set('');
  }

  // ─────────────────────────────────────────────
  // RULE SESSION (Mode 1)
  // ─────────────────────────────────────────────

  selectRule(ruleId: string): void {
    this.selectedRuleId.set(ruleId);
  }

  startRuleSession(): void {
    const rule = this.selectedRule();
    if (!rule) return;
    const cards = this.prepositionService.buildRuleSession(rule.id, 8);
    if (cards.length === 0) return;
    this.sessionCards.set(cards.map((card) => ({
      card,
      selectedOption: null,
      answered: false,
      correct: false,
    })));
    this.currentIndex.set(0);
    this.sessionActive.set(true);
    this.sessionFinished.set(false);
    this.sessionTitle.set(rule.name);
    this.sessionType.set('rule');
  }

  // ─────────────────────────────────────────────
  // VERB PAIR SESSION (Mode 3)
  // ─────────────────────────────────────────────

  startVerbSession(): void {
    const cards = this.prepositionService.buildVerbSession(
      10,
      (this.selectedLevel() || undefined) as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | undefined
    );
    if (cards.length === 0) return;
    this.sessionCards.set(cards.map((card) => ({
      card,
      selectedOption: null,
      answered: false,
      correct: false,
      pairId: card.id.replace(/^verb-/, ''),
    })));
    this.currentIndex.set(0);
    this.sessionActive.set(true);
    this.sessionFinished.set(false);
    this.sessionTitle.set(
      this.selectedLevel()
        ? `Verb + Preposition (${this.selectedLevel()})`
        : 'Verb + Preposition (All Levels)'
    );
    this.sessionType.set('verb');
  }

  // ─────────────────────────────────────────────
  // ANSWER HANDLING
  // ─────────────────────────────────────────────

  selectOption(option: string): void {
    const card = this.currentCard();
    if (!card || card.answered) return;

    const isCorrect = option === card.card.correctPreposition;
    card.selectedOption = option;
    card.answered = true;
    card.correct = isCorrect;

    this.sessionCards.update((cards) =>
      cards.map((c, i) => (i === this.currentIndex() ? card : c))
    );

    if (card.pairId) {
      this.prepositionService.recordAnswer(card.pairId, isCorrect);
    }
  }

  nextCard(): void {
    if (this.currentIndex() + 1 >= this.sessionCards().length) {
      this.sessionActive.set(false);
      this.sessionFinished.set(true);
      return;
    }
    this.currentIndex.update((i) => i + 1);
  }

  restartSession(): void {
    const t = this.sessionType();
    if (t === 'rule') {
      this.startRuleSession();
    } else if (t === 'verb') {
      this.startVerbSession();
    } else {
      this.startAiExercise();
    }
  }

  closeSession(): void {
    this.sessionActive.set(false);
    this.sessionFinished.set(false);
    this.sessionCards.set([]);
    this.currentIndex.set(0);
  }

  // ─────────────────────────────────────────────
  // AI EXERCISE (Mode 2)
  // ─────────────────────────────────────────────

  async startAiExercise(): Promise<void> {
    this.aiLoading.set(true);
    this.aiError.set('');
    this.aiResult.set(null);
    this.aiQueue = [];
    this.aiExercise.set(null);
    this.sessionType.set('ai');
    const token = ++this.aiGenToken;

    try {
      // Generate the first exercise so the user can start immediately.
      const first = await this.generateOne();
      if (token !== this.aiGenToken) return; // user left AI mode meanwhile
      this.aiQueue.push(first);
      this.advanceAi();

      // Prefetch the next ones in the background while the user solves this one.
      this.prefetchAi();
    } catch (err) {
      if (token === this.aiGenToken) {
        this.aiError.set(
          err instanceof Error ? err.message : 'Failed to generate exercise.'
        );
      }
    } finally {
      if (token === this.aiGenToken) {
        this.aiLoading.set(false);
      }
    }
  }

  /** Generate a single AI preposition exercise (used for the first + prefetch). */
  private async generateOne(): Promise<AiExerciseData> {
    const rules = this.prepositionService.getAllRules();
    const rule = rules[Math.floor(Math.random() * rules.length)];
    const knownWords = this.wordService.getWords().slice(0, 60).map((w) => w.german);

    const exercise = await this.aiService.generatePrepositionExercise(
      rule.id,
      rule.name,
      rule.prepositions,
      knownWords,
      'A2'
    );

    return {
      sentenceWithBlank: exercise.sentenceWithBlank,
      correctPreposition: exercise.correctPreposition,
      correctCase: exercise.correctCase,
      hintEn: exercise.hintEn,
      hintRu: exercise.hintRu,
      explanation: exercise.explanation,
      options: exercise.options,
      title: 'AI Exercise: ' + rule.name,
    };
  }

  /** Show the head of the queue as the current exercise (if any). */
  private advanceAi(): void {
    const next = this.aiQueue.shift();
    if (next) {
      this.aiExercise.set(next);
      this.aiInput.set('');
      this.aiResult.set(null);
      this.aiError.set('');
      this.sessionTitle.set(next.title);
    }
  }

  /** Background refill: keep the queue topped up while the user is in AI mode. */
  private async prefetchAi(): Promise<void> {
    if (this.aiPrefetching() || this.mode() !== 'ai') return;
    this.aiPrefetching.set(true);
    try {
      while (this.aiQueue.length < this.PREFETCH_TARGET && this.mode() === 'ai') {
        try {
          this.aiQueue.push(await this.generateOne());
        } catch {
          break; // stop prefetching on failure; next exercise will generate on demand
        }
      }
    } finally {
      this.aiPrefetching.set(false);
    }
  }

  checkAiAnswer(): void {
    const exercise = this.aiExercise();
    if (!exercise || !this.aiInput().trim()) return;

    const answer = this.aiInput().trim().toLowerCase();
    const correct = answer === exercise.correctPreposition.toLowerCase();

    this.aiResult.set({
      correct,
      message: correct
        ? `Correct! "${exercise.correctPreposition}" + ${CASE_LABELS[exercise.correctCase]}`
        : `Not quite. Correct answer: "${exercise.correctPreposition}" + ${CASE_LABELS[exercise.correctCase]}`,
    });
  }

  /** Move to the next exercise — served instantly from the prefetched queue. */
  completeAiExercise(): void {
    if (this.aiQueue.length > 0) {
      this.advanceAi();
      // Refill the queue for the following ones.
      this.prefetchAi();
      return;
    }
    // Queue unexpectedly empty — generate on demand (rare, only if prefetch failed).
    this.startAiExercise();
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  getCaseLabel(caseValue: GermanCase): string {
    return CASE_LABELS[caseValue];
  }

  getMasteryClass(mastery: number): string {
    if (mastery >= 80) return 'mastery-high';
    if (mastery >= 40) return 'mastery-mid';
    return 'mastery-low';
  }

  getTranslationForExample(ex: { translationEn: string; translationRu: string }): string {
    return this.settingsService.translationLanguage() === 'ru'
      ? ex.translationRu
      : ex.translationEn;
  }
}