import {
  Component,
  OnInit,
  input,
  output,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AiService, TranslationResult } from '../../services/ai.service';
import { SpeechService } from '../../services/speech.service';
import { StoryExercise, StoryExerciseType } from '../../models/story-exercise';
import { StoryExerciseResult } from '../../models/story-exercise-history';
import { withShuffledOptions } from '../../services/story-exercise-builder';

interface SessionItem {
  exercise: StoryExercise;
  selectedOption: string | null;
  answered: boolean;
  correct: boolean;
  feedback: string;
  translation: TranslationResult | null;
  /** The user's typed answer for cloze / sentence questions. */
  userAnswer: string;
  /** Which mastery button was pressed (shown when showMasteryActions is on). */
  masteryFeedback: number | null;
}

/**
 * A reusable exercise player that renders and grades any list of `StoryExercise`
 * (multiple-choice, cloze, sentence translation). Shared by the Stories page and
 * the Word Practice page so both offer the exact same exercise types and logic.
 */
@Component({
  selector: 'app-exercise-list',
  imports: [
    FormsModule,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './exercise-list.component.html',
  styleUrl: './exercise-list.component.scss',
})
export class ExerciseListComponent implements OnInit {
  readonly exercises = input<StoryExercise[]>([]);

  ngOnInit(): void {
    this.start();
  }

  /** Emitted when the user answers all questions and reaches the results screen. */
  readonly complete = output<StoryExerciseResult[]>();
  /** Emitted when the user quits mid-session (payload are the results so far). */
  readonly quit = output<StoryExerciseResult[]>();

  /** When true, shows mastery self-assessment buttons on each answered question. */
  readonly showMasteryActions = input(false);
  /** Emitted with the practiced word and the delta (-10 | 10 | 100) when the user self-adjusts mastery. */
  readonly masteryAdjust = output<{ word: string; delta: number }>();

  readonly session = signal<SessionItem[]>([]);
  readonly currentIndex = signal(0);
  readonly sessionActive = signal(false);
  readonly sessionFinished = signal(false);
  readonly verifying = signal(false);
  readonly submitError = signal('');
  readonly userInput = signal('');

  readonly currentItem = computed(() => {
    const s = this.session();
    const i = this.currentIndex();
    return i < s.length ? s[i] : null;
  });

  readonly currentNumber = computed(() => this.currentIndex() + 1);
  readonly totalQuestions = computed(() => this.session().length);
  readonly correctCount = computed(
    () => this.session().filter((s) => s.correct).length
  );

  readonly scorePercent = computed(() => {
    const total = this.totalQuestions();
    return total === 0 ? 0 : Math.round((this.correctCount() / total) * 100);
  });

  constructor(
    private readonly aiService: AiService,
    private readonly speechService: SpeechService
  ) {}

  start(): void {
    const exercises = this.exercises();
    if (exercises.length === 0) {
      return;
    }
    this.session.set(
      exercises.map((e) => ({
        // Re-shuffle options once per session so the correct answer never
        // sits at a predictable position, even for exercises replayed from
        // stored history. Grading uses the independent `*Correct` field, so
        // this is safe, and `restart()` reuses this session (no re-shuffling).
        exercise: withShuffledOptions(e),
        selectedOption: null,
        answered: false,
        correct: false,
        feedback: '',
        translation: null,
        userAnswer: '',
        masteryFeedback: null,
      }))
    );
    this.currentIndex.set(0);
    this.sessionActive.set(true);
    this.sessionFinished.set(false);
    this.submitError.set('');
    this.userInput.set('');
  }

  typeLabel(type: StoryExerciseType): string {
    switch (type) {
      case 'mc': return 'Choose the correct translation';
      case 'mc-sentence': return 'Select the correct German word';
      case 'mc-plural': return 'Select the correct plural form';
      case 'mc-verb-past': return 'Select the correct past form';
      case 'mc-verb-perfect': return 'Select the correct past perfect form';
      case 'mc-comparative': return 'Select the correct comparative form';
      case 'mc-superlative': return 'Select the correct superlative form';
      case 'cloze': return 'Fill in the missing word';
      case 'sentence': return 'Translate the sentence';
      default: return '';
    }
  }

  typeIcon(type: StoryExerciseType): string {
    switch (type) {
      case 'mc': return 'checklist';
      case 'mc-sentence': return 'rule';
      case 'mc-plural': return 'groups';
      case 'mc-verb-past': return 'history';
      case 'mc-verb-perfect': return 'task_alt';
      case 'mc-comparative': return 'trending_up';
      case 'mc-superlative': return 'offline_pin';
      case 'cloze': return 'edit_note';
      case 'sentence': return 'translate';
      default: return 'quiz';
    }
  }

  /** Compute character ranges for the blank substrings within the sentence. */
  private computeBlankRanges(
    sentence: string,
    blanks: string[]
  ): { start: number; end: number }[] {
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

  buildClozeSentence(ex: StoryExercise): string {
    const ranges = this.computeBlankRanges(ex.clozeSentence ?? '', ex.clozeBlankWords ?? []);
    const sorted = [...ranges].sort((a, b) => b.start - a.start);
    let result = ex.clozeSentence ?? '';
    for (const r of sorted) {
      result = result.slice(0, r.start) + '___' + result.slice(r.end);
    }
    return result;
  }

  expectedClozeAnswer(ex: StoryExercise): string {
    const ranges = this.computeBlankRanges(ex.clozeSentence ?? '', ex.clozeBlankWords ?? []);
    return ranges.map((r) => (ex.clozeSentence ?? '').slice(r.start, r.end)).join(' ');
  }

  buildFilledClozeSentence(ex: StoryExercise, answer: string): string {
    const ranges = this.computeBlankRanges(ex.clozeSentence ?? '', ex.clozeBlankWords ?? []);
    if (ranges.length > 1) {
      const parts = answer.split(/\s+/);
      const sorted = [...ranges].sort((a, b) => b.start - a.start);
      let result = ex.clozeSentence ?? '';
      for (let i = 0; i < sorted.length; i++) {
        const part = parts[parts.length - 1 - i] ?? '';
        result = result.slice(0, sorted[i].start) + part + result.slice(sorted[i].end);
      }
      return result.charAt(0).toUpperCase() + result.slice(1);
    }
    const sorted = [...ranges].sort((a, b) => b.start - a.start);
    let result = ex.clozeSentence ?? '';
    for (const r of sorted) {
      result = result.slice(0, r.start) + answer + result.slice(r.end);
    }
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  selectOption(option: string): void {
    const item = this.currentItem();
    if (!item || item.answered || !this.isMcType(item.exercise.type)) return;
    const correctAnswer = this.getMcCorrect(item.exercise);
    const correct = option === correctAnswer;
    item.selectedOption = option;
    this.answerItem(
      item,
      correct,
      correct
        ? ''
        : `Not quite. The correct answer is "${correctAnswer}".`
    );
  }

  /** Whether an exercise type uses the card-style option-button UI. */
  private isMcType(type: StoryExerciseType): boolean {
    return (
      type === 'mc' ||
      type === 'mc-sentence' ||
      type === 'mc-plural' ||
      type === 'mc-verb-past' ||
      type === 'mc-verb-perfect' ||
      type === 'mc-comparative' ||
      type === 'mc-superlative'
    );
  }

  /** Returns the answer options for any card-style exercise. */
  getMcOptions(ex: StoryExercise): string[] {
    switch (ex.type) {
      case 'mc': return ex.mcOptions ?? [];
      case 'mc-sentence': return ex.mcSentenceOptions ?? [];
      case 'mc-plural': return ex.mcPluralOptions ?? [];
      case 'mc-verb-past': return ex.mcVerbPastOptions ?? [];
      case 'mc-verb-perfect': return ex.mcVerbPerfectOptions ?? [];
      case 'mc-comparative': return ex.mcComparativeOptions ?? [];
      case 'mc-superlative': return ex.mcSuperlativeOptions ?? [];
      default: return [];
    }
  }

  /** Returns the question prompt text for any card-style exercise. */
  getMcPrompt(ex: StoryExercise): string {
    switch (ex.type) {
      case 'mc': return ex.mcPrompt ?? '';
      case 'mc-sentence': return ex.mcSentence ?? '';
      case 'mc-plural': return ex.mcPluralPrompt ?? '';
      case 'mc-verb-past': return ex.mcVerbPastPrompt ?? '';
      case 'mc-verb-perfect': return ex.mcVerbPerfectPrompt ?? '';
      case 'mc-comparative': return ex.mcComparativePrompt ?? '';
      case 'mc-superlative': return ex.mcSuperlativePrompt ?? '';
      default: return '';
    }
  }

  /** Returns the correct answer label for any card-style exercise. */
  private getMcCorrect(ex: StoryExercise): string {
    switch (ex.type) {
      case 'mc': return ex.mcCorrect ?? '';
      case 'mc-sentence': return ex.mcSentenceCorrect ?? '';
      case 'mc-plural': return ex.mcPluralCorrect ?? '';
      case 'mc-verb-past': return ex.mcVerbPastCorrect ?? '';
      case 'mc-verb-perfect': return ex.mcVerbPerfectCorrect ?? '';
      case 'mc-comparative': return ex.mcComparativeCorrect ?? '';
      case 'mc-superlative': return ex.mcSuperlativeCorrect ?? '';
      default: return '';
    }
  }

  checkCloze(): void {
    const item = this.currentItem();
    if (!item || item.answered || item.exercise.type !== 'cloze') return;
    const answer = this.userInput().trim();
    if (!answer) return;
    const correct =
      answer.toLowerCase() === this.expectedClozeAnswer(item.exercise).toLowerCase();
    item.userAnswer = answer;
    this.answerItem(
      item,
      correct,
      correct
        ? ''
        : `You typed "${answer}". The correct word is "${this.expectedClozeAnswer(item.exercise)}".`
    );
    this.speechService.speak(
      this.buildFilledClozeSentence(item.exercise, this.expectedClozeAnswer(item.exercise))
    );
  }

  async submitSentence(): Promise<void> {
    const item = this.currentItem();
    if (!item || item.answered || item.exercise.type !== 'sentence') return;
    const answer = this.userInput().trim();
    if (!answer) return;

    item.userAnswer = answer;
    this.verifying.set(true);
    this.submitError.set('');
    try {
      const result = await this.aiService.verifyTranslation(
        answer,
        item.exercise.sentenceGerman ?? ''
      );
      item.translation = result;
      const rawFeedback =
        result.feedback ||
        (result.correct
          ? ''
          : `The correct sentence is "${item.exercise.sentenceGerman}".`);
      this.answerItem(
        item,
        result.correct,
        // Avoid duplicating the "Correct!" header for correct answers
        result.correct ? this.stripLeadingCorrect(rawFeedback) : rawFeedback
      );
    } catch (err) {
      this.submitError.set(
        err instanceof Error ? err.message : 'Verification failed. Try again.'
      );
    } finally {
      this.verifying.set(false);
    }
  }

  private answerItem(
    item: SessionItem,
    correct: boolean,
    feedback: string
  ): void {
    item.correct = correct;
    item.feedback = feedback;
    item.answered = true;
    this.session.update((items) =>
      items.map((it, i) => (i === this.currentIndex() ? item : it))
    );
  }

  /** Removes a leading "Correct!" (with optional punctuation/spaces) from feedback text. */
  private stripLeadingCorrect(text: string): string {
    return text.replace(/^\s*(Correct!|Correct)\s*[.!:]?\s*/i, '').trim();
  }

  nextQuestion(): void {
    this.submitError.set('');
    this.userInput.set('');
    if (this.currentIndex() + 1 >= this.session().length) {
      this.sessionActive.set(false);
      this.sessionFinished.set(true);
      this.complete.emit(this.buildResults());
      return;
    }
    this.currentIndex.update((i) => i + 1);
  }

  restart(): void {
    this.session.set(
      this.session().map((it) => ({
        ...it,
        selectedOption: null,
        answered: false,
        correct: false,
        feedback: '',
        translation: null,
        userAnswer: '',
        masteryFeedback: null,
      }))
    );
    this.currentIndex.set(0);
    this.sessionActive.set(true);
    this.sessionFinished.set(false);
    this.submitError.set('');
    this.userInput.set('');
  }

  /** Records a mastery self-assessment and emits it so the parent can update the word. */
  adjustMastery(delta: number): void {
    const item = this.currentItem();
    if (!item) return;
    item.masteryFeedback = delta;
    this.session.update((items) =>
      items.map((it, i) => (i === this.currentIndex() ? item : it))
    );
    this.masteryAdjust.emit({ word: item.exercise.word, delta });
  }

  quitSession(): void {
    this.quit.emit(this.buildResults());
  }

  private buildResults(): StoryExerciseResult[] {
    return this.session().map((it) => ({
      exerciseId: it.exercise.id,
      answered: it.answered,
      correct: it.correct,
      feedback: it.feedback,
      selectedOption: it.selectedOption,
      userInput: it.userAnswer,
      translationScore: it.translation?.score ?? null,
      translationCorrected: it.translation?.correctedText ?? null,
    }));
  }

  getErrorText(
    input: string,
    error: { startIndex: number; endIndex: number }
  ): string {
    return input.substring(error.startIndex, error.endIndex);
  }
}
