import { Component, OnInit, Signal, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Story } from '../../models/story';
import { StoryQuestion } from '../../models/story-question';
import { StoryQuestionResult } from '../../models/story-question-history';
import { AiService, StoryAnswerFeedback } from '../../services/ai.service';
import { SpeechService } from '../../services/speech.service';
import { StoryQuestionService } from '../../services/story-question.service';
import { StoryQuestionHistoryService } from '../../services/story-question-history.service';

interface SessionItem {
  question: StoryQuestion;
  userInput: string;
  answered: boolean;
  correct: boolean;
  feedback: string;
  grade: StoryAnswerFeedback | null;
  showTranslation: boolean;
  showHint: boolean;
}

/**
 * Story Questions mode: active-recall comprehension questions about a story.
 * The user reads a German question, types a German answer from memory, and the
 * AI grades it (score 0-100 + feedback + corrected German).
 */
@Component({
  selector: 'app-story-questions',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './story-questions.component.html',
  styleUrl: './story-questions.component.scss',
})
export class StoryQuestionsComponent implements OnInit {
  readonly story: Signal<Story | null>;

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
    readonly storyQuestionService: StoryQuestionService,
    private readonly historyService: StoryQuestionHistoryService,
    private readonly aiService: AiService,
    private readonly speechService: SpeechService,
    private readonly router: Router
  ) {
    this.story = storyQuestionService.story;
  }

  ngOnInit(): void {
    this.start();
  }

  start(): void {
    const questions = this.storyQuestionService.questions();
    if (questions.length === 0) {
      return;
    }
    this.session.set(
      questions.map((q) => ({
        question: q,
        userInput: '',
        answered: false,
        correct: false,
        feedback: '',
        grade: null,
        showTranslation: false,
        showHint: false,
      }))
    );
    this.currentIndex.set(0);
    this.sessionActive.set(true);
    this.sessionFinished.set(false);
    this.userInput.set('');
    this.submitError.set('');
  }

  /** Toggles the native translation of the current question. */
  toggleTranslation(): void {
    const item = this.currentItem();
    if (!item) return;
    item.showTranslation = !item.showTranslation;
    this.session.update((items) =>
      items.map((it, i) => (i === this.currentIndex() ? item : it))
    );
  }

  /** Toggles the hint for the current question. */
  toggleHint(): void {
    const item = this.currentItem();
    if (!item) return;
    item.showHint = !item.showHint;
    this.session.update((items) =>
      items.map((it, i) => (i === this.currentIndex() ? item : it))
    );
  }

  speak(text: string): void {
    if (text) {
      this.speechService.speak(text);
    }
  }

  /** Sends the typed answer to the AI for grading. */
  async submitAnswer(): Promise<void> {
    const item = this.currentItem();
    if (!item || item.answered) return;

    const answer = this.userInput().trim();
    if (!answer) return;

    item.userInput = answer;
    this.verifying.set(true);
    this.submitError.set('');
    try {
      const grade = await this.aiService.checkStoryAnswer(
        answer,
        item.question.question,
        item.question.answer
      );
      item.grade = grade;
      item.correct = grade.correct;
      item.feedback =
        grade.feedback ||
        (grade.correct
          ? ''
          : `The model answer is "${item.question.answer}".`);
      item.answered = true;
      item.showTranslation = true;
      this.session.update((items) =>
        items.map((it, i) => (i === this.currentIndex() ? item : it))
      );
    } catch (err) {
      this.submitError.set(
        err instanceof Error ? err.message : 'Verification failed. Try again.'
      );
    } finally {
      this.verifying.set(false);
    }
  }

  nextQuestion(): void {
    this.submitError.set('');
    this.userInput.set('');
    if (this.currentIndex() + 1 >= this.session().length) {
      this.sessionActive.set(false);
      this.sessionFinished.set(true);
      this.saveResults(this.buildResults());
      return;
    }
    this.currentIndex.update((i) => i + 1);
  }

  restart(): void {
    this.session.set(
      this.session().map((it) => ({
        ...it,
        userInput: '',
        answered: false,
        correct: false,
        feedback: '',
        grade: null,
        showTranslation: false,
        showHint: false,
      }))
    );
    this.currentIndex.set(0);
    this.sessionActive.set(true);
    this.sessionFinished.set(false);
    this.submitError.set('');
    this.userInput.set('');
  }

  /** Quits mid-session: persists results so far and returns to the story page
   *  the question session was generated from. */
  quitSession(): void {
    this.saveResults(this.buildResults());
    this.goBackToStory();
  }

  backToStories(): void {
    this.goBackToStory();
  }

  /** Navigates back to the specific story page for this session's story
   *  (falls back to the stories list when no session story is known). */
  private goBackToStory(): void {
    const story = this.storyQuestionService.story();
    this.storyQuestionService.clear();
    if (story) {
      this.router.navigate(['/stories', story.id]);
    } else {
      this.router.navigate(['/stories']);
    }
  }

  /** Persists the given session results (skips runs with no answered questions). */
  private saveResults(results: StoryQuestionResult[]): void {
    const story = this.storyQuestionService.story();
    if (!story) return;
    if (results.every((r) => !r.answered)) return;

    this.historyService.addSession(
      story,
      this.storyQuestionService.questions(),
      results
    );
  }

  private buildResults(): StoryQuestionResult[] {
    return this.session().map((it) => ({
      questionId: it.question.id,
      answered: it.answered,
      correct: it.correct,
      score: it.grade?.score ?? null,
      userInput: it.userInput,
      feedback: it.feedback,
      correctedAnswer: it.grade?.correctedText ?? null,
    }));
  }
}