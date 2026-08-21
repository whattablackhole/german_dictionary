import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StoryExerciseService } from '../../services/story-exercise.service';
import { AiService, TranslationResult } from '../../services/ai.service';
import { SpeechService } from '../../services/speech.service';
import { StoryExercise, StoryExerciseType } from '../../models/story-exercise';

interface SessionItem {
  exercise: StoryExercise;
  selectedOption: string | null;
  answered: boolean;
  correct: boolean;
  feedback: string;
  translation: TranslationResult | null;
}

@Component({
  selector: 'app-story-exercises',
  imports: [
    FormsModule,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './story-exercises.component.html',
  styleUrl: './story-exercises.component.scss',
})
export class StoryExercisesComponent implements OnInit {
  readonly story = inject(StoryExerciseService).story;

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
    private readonly storyExerciseService: StoryExerciseService,
    private readonly aiService: AiService,
    private readonly speechService: SpeechService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.start();
  }

  start(): void {
    const exercises = this.storyExerciseService.exercises();
    if (exercises.length === 0) {
      return;
    }
    this.session.set(
      exercises.map((e) => ({
        exercise: e,
        selectedOption: null,
        answered: false,
        correct: false,
        feedback: '',
        translation: null,
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
      case 'cloze': return 'Fill in the missing word';
      case 'sentence': return 'Translate the sentence';
      default: return '';
    }
  }

  typeIcon(type: StoryExerciseType): string {
    switch (type) {
      case 'mc': return 'checklist';
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
    if (!item || item.answered || item.exercise.type !== 'mc') return;
    const correct = option === item.exercise.mcCorrect;
    this.answerItem(
      item,
      correct,
      correct
        ? 'Correct!'
        : `Not quite. The correct translation is "${item.exercise.mcCorrect}".`
    );
  }

  checkCloze(): void {
    const item = this.currentItem();
    if (!item || item.answered || item.exercise.type !== 'cloze') return;
    const answer = this.userInput().trim();
    if (!answer) return;
    const correct =
      answer.toLowerCase() === this.expectedClozeAnswer(item.exercise).toLowerCase();
    this.answerItem(
      item,
      correct,
      correct
        ? 'Correct!'
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

    this.verifying.set(true);
    this.submitError.set('');
    try {
      const result = await this.aiService.verifyTranslation(
        answer,
        item.exercise.sentenceGerman ?? ''
      );
      item.translation = result;
      this.answerItem(
        item,
        result.correct,
        result.feedback ||
          (result.correct
            ? 'Correct!'
            : `The correct sentence is "${item.exercise.sentenceGerman}".`)
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

  nextQuestion(): void {
    this.submitError.set('');
    this.userInput.set('');
    if (this.currentIndex() + 1 >= this.session().length) {
      this.sessionActive.set(false);
      this.sessionFinished.set(true);
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
      }))
    );
    this.currentIndex.set(0);
    this.sessionActive.set(true);
    this.sessionFinished.set(false);
    this.submitError.set('');
    this.userInput.set('');
  }

  quitSession(): void {
    this.backToStories();
  }

  backToStories(): void {
    this.storyExerciseService.clear();
    this.router.navigate(['/stories']);
  }

  getErrorText(
    input: string,
    error: { startIndex: number; endIndex: number }
  ): string {
    return input.substring(error.startIndex, error.endIndex);
  }
}