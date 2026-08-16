import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DeclensionService } from '../../services/declension.service';
import { AiService, GeneratedDeclensionExercise, DeclensionAnswerResult } from '../../services/ai.service';
import { SettingsService } from '../../services/settings.service';
import { GermanCase } from '../../models/preposition-rule';
import {
  ADJECTIVE_TABLE,
  ARTICLE_TABLE,
  CASE_GAP_NOTES,
  CASE_LABELS_SHORT,
  CASE_ORDER,
  CASE_QUESTIONS_RU,
  DeclensionGender,
  DeclensionQuestionType,
  DeclensionType,
  ArticleType,
  EXAMPLE_ADJECTIVES,
  EXAMPLE_NOUNS,
  GENDER_LABELS,
  GENDER_ORDER,
} from '../../models/case-declension';

type TrainerMode = 'practice' | 'reference';

interface SessionItem {
  exercise: GeneratedDeclensionExercise;
  selectedOption: string | null;
  answered: boolean;
  correct: boolean;
  feedback: DeclensionAnswerResult | null;
}

@Component({
  selector: 'app-declension-trainer',
  imports: [
    FormsModule,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './declension-trainer.component.html',
  styleUrl: './declension-trainer.component.scss',
})
export class DeclensionTrainerComponent {
  readonly mode = signal<TrainerMode>('practice');
  readonly questionType = signal<DeclensionQuestionType | 'mixed'>('mixed');
  readonly selectedCases = signal<GermanCase[]>([]);
  readonly theme = signal<string>('');

  // Session state
  readonly session = signal<SessionItem[]>([]);
  readonly currentIndex = signal(0);
  readonly sessionActive = signal(false);
  readonly sessionFinished = signal(false);

  // AI loading state
  readonly aiLoading = signal(false);
  readonly aiVerifying = signal(false);
  readonly aiError = signal('');

  readonly allCases: GermanCase[] = CASE_ORDER;
  readonly allQuestionTypes: (DeclensionQuestionType | 'mixed')[] = [
    'mixed', 'article', 'adjective', 'noun', 'phrase',
  ];

  readonly currentQuestion = computed(() => {
    const s = this.session();
    const i = this.currentIndex();
    return i < s.length ? s[i] : null;
  });

  readonly currentNumber = computed(() => this.currentIndex() + 1);
  readonly totalQuestions = computed(() => this.session().length);
  readonly correctCount = computed(
    () => this.session().filter((s) => s.answered && s.correct).length
  );

  readonly scorePercent = computed(() => {
    const total = this.totalQuestions();
    if (total === 0) return 0;
    return Math.round((this.correctCount() / total) * 100);
  });

  readonly masteredCount = computed(
    () => this.declensionService.mastery().filter((m) => m.mastery >= 80).length
  );

  // Reference table data
  readonly referenceGroups = computed(() => this.buildReferenceGroups());

  constructor(
    private readonly declensionService: DeclensionService,
    private readonly aiService: AiService,
    private readonly settingsService: SettingsService
  ) {}

  setMode(mode: TrainerMode): void {
    this.mode.set(mode);
    this.sessionActive.set(false);
    this.sessionFinished.set(false);
    this.session.set([]);
    this.currentIndex.set(0);
    this.aiError.set('');
  }

  toggleCase(c: GermanCase): void {
    this.selectedCases.update((cases) =>
      cases.includes(c) ? cases.filter((x) => x !== c) : [...cases, c]
    );
  }

  clearCases(): void {
    this.selectedCases.set([]);
  }

  async startSession(): Promise<void> {
    if (!this.aiService.hasApiKey()) {
      this.aiError.set('No API key set. Add your OpenRouter API key in Settings.');
      return;
    }

    this.aiLoading.set(true);
    this.aiError.set('');

    try {
      const cases = this.selectedCases().length > 0 ? this.selectedCases() : undefined;
      const exercises = await this.aiService.generateDeclensionExercises({
        questionType: this.questionType(),
        selectedCases: cases,
        theme: this.theme() || undefined,
        count: 10,
      });

      if (exercises.length === 0) {
        this.aiError.set('AI returned no exercises. Try again.');
        return;
      }

      this.session.set(
        exercises.map((ex) => ({
          exercise: ex,
          selectedOption: null,
          answered: false,
          correct: false,
          feedback: null,
        }))
      );
      this.currentIndex.set(0);
      this.sessionActive.set(true);
      this.sessionFinished.set(false);
    } catch (err) {
      this.aiError.set(err instanceof Error ? err.message : 'Failed to generate exercises.');
    } finally {
      this.aiLoading.set(false);
    }
  }

  async selectOption(option: string): Promise<void> {
    const item = this.currentQuestion();
    if (!item || item.answered) return;

    item.selectedOption = option;
    this.aiVerifying.set(true);

    // Use AI to verify the answer
    try {
      const result = await this.aiService.verifyDeclensionAnswer(
        option,
        item.exercise.correctAnswer,
        {
          sentenceWithBlank: item.exercise.sentenceWithBlank,
          caseReq: item.exercise.caseReq,
          genderLabel: item.exercise.genderLabel,
          focusType: item.exercise.focusType,
          explanation: item.exercise.explanation,
        }
      );
      item.correct = result.correct;
      item.feedback = result;
    } catch {
      // Fallback: simple string comparison if AI verification fails
      const isCorrect = option === item.exercise.correctAnswer;
      item.correct = isCorrect;
      item.feedback = {
        correct: isCorrect,
        expectedAnswer: item.exercise.correctAnswer,
        explanation: isCorrect
          ? 'Correct! ' + item.exercise.explanation
          : `Not quite. The correct answer is "${item.exercise.correctAnswer}". ${item.exercise.explanation}`,
        score: isCorrect ? 100 : 0,
      };
    }

    // Only mark as answered AFTER AI verification completes
    item.answered = true;
    this.aiVerifying.set(false);

    this.session.update((items) =>
      items.map((it, i) => (i === this.currentIndex() ? item : it))
    );

    // Record mastery
    const key = this.masteryKeyFor(item.exercise);
    if (key) {
      this.declensionService.recordAnswer(key, item.correct);
    }
  }

  nextQuestion(): void {
    if (this.currentIndex() + 1 >= this.session().length) {
      this.sessionActive.set(false);
      this.sessionFinished.set(true);
      return;
    }
    this.currentIndex.update((i) => i + 1);
  }

  async restart(): Promise<void> {
    await this.startSession();
  }

  closeSession(): void {
    this.sessionActive.set(false);
    this.sessionFinished.set(false);
    this.session.set([]);
    this.currentIndex.set(0);
    this.aiError.set('');
  }

  private masteryKeyFor(ex: GeneratedDeclensionExercise): string | null {
    const caseReq = ex.caseReq as GermanCase;
    const genderMap: Record<string, DeclensionGender | 'plural'> = {
      'Maskulin': 'masculine',
      'Feminin': 'feminine',
      'Neutrum': 'neuter',
      'Plural': 'plural',
    };
    const gender = genderMap[ex.genderLabel] ?? 'masculine';

    switch (ex.focusType) {
      case 'article':
        return DeclensionService.articleKey(caseReq, gender, 'definite');
      case 'adjective':
        return DeclensionService.adjectiveKey(caseReq, gender, 'weak');
      case 'noun':
        return DeclensionService.nounKey(caseReq, gender);
      case 'phrase':
        return DeclensionService.articleKey(caseReq, gender, 'definite');
      default:
        return null;
    }
  }

  getCaseLabel(c: GermanCase): string { return CASE_LABELS_SHORT[c]; }
  getCaseQuestionRu(c: GermanCase): string { return CASE_QUESTIONS_RU[c]; }
  getGenderLabel(g: DeclensionGender | 'plural'): string { return GENDER_LABELS[g]; }
  getMasteryValue(key: string): number { return this.declensionService.getMasteryValue(key); }

  getMasteryClass(mastery: number): string {
    if (mastery >= 80) return 'mastery-high';
    if (mastery >= 40) return 'mastery-mid';
    return 'mastery-low';
  }

  getTranslation(ex: { translationEn: string; translationRu: string }): string {
    return this.settingsService.translationLanguage() === 'ru' ? ex.translationRu : ex.translationEn;
  }

  private buildReferenceGroups() {
    return [
      {
        id: 'articles',
        title: 'Definite Articles (der/die/das)',
        subtitle: 'The article carries the case information',
        header: ['', 'Maskulin', 'Feminin', 'Neutrum', 'Plural'],
        rows: CASE_ORDER.map((c) => ({
          caseLabel: CASE_LABELS_SHORT[c],
          case: c,
          cells: GENDER_ORDER.map((g) => ARTICLE_TABLE.definite[c][g]),
        })),
      },
      {
        id: 'ein-words',
        title: 'ein / kein / mein (ein-words)',
        subtitle: 'Same endings for ein, kein, mein, dein, sein, ihr, unser, euer',
        header: ['', 'Maskulin', 'Feminin', 'Neutrum', 'Plural'],
        rows: CASE_ORDER.map((c) => ({
          caseLabel: CASE_LABELS_SHORT[c],
          case: c,
          cells: GENDER_ORDER.map((g) => 'ein' + ARTICLE_TABLE.indefinite[c][g]),
        })),
      },
      {
        id: 'adj-strong',
        title: 'Adjective Endings — Strong (no article)',
        subtitle: 'e.g. "großer Hund", "gute Frau", "gutes Kind"',
        header: ['', 'Maskulin', 'Feminin', 'Neutrum', 'Plural'],
        rows: CASE_ORDER.map((c) => ({
          caseLabel: CASE_LABELS_SHORT[c],
          case: c,
          cells: GENDER_ORDER.map((g) => '-' + ADJECTIVE_TABLE.strong[c][g]),
        })),
      },
      {
        id: 'adj-weak',
        title: 'Adjective Endings — Weak (after der/die/das)',
        subtitle: 'e.g. "der große Hund", "die gute Frau"',
        header: ['', 'Maskulin', 'Feminin', 'Neutrum', 'Plural'],
        rows: CASE_ORDER.map((c) => ({
          caseLabel: CASE_LABELS_SHORT[c],
          case: c,
          cells: GENDER_ORDER.map((g) => '-' + ADJECTIVE_TABLE.weak[c][g]),
        })),
      },
      {
        id: 'adj-mixed',
        title: 'Adjective Endings — Mixed (after ein/kein/mein)',
        subtitle: 'e.g. "ein großer Hund", "meine gute Frau"',
        header: ['', 'Maskulin', 'Feminin', 'Neutrum', 'Plural'],
        rows: CASE_ORDER.map((c) => ({
          caseLabel: CASE_LABELS_SHORT[c],
          case: c,
          cells: GENDER_ORDER.map((g) => '-' + ADJECTIVE_TABLE.mixed[c][g]),
        })),
      },
    ];
  }

  readonly caseGapNotes = CASE_GAP_NOTES;
  readonly exampleNouns = EXAMPLE_NOUNS;
  readonly exampleAdjectives = EXAMPLE_ADJECTIVES;
}