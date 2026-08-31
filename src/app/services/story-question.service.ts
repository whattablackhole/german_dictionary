import { Injectable, signal } from '@angular/core';
import { Story } from '../models/story';
import { StoryQuestion } from '../models/story-question';

@Injectable({ providedIn: 'root' })
export class StoryQuestionService {
  /** The story the current question session was generated from. */
  readonly story = signal<Story | null>(null);
  /** The questions for the current session. */
  readonly questions = signal<StoryQuestion[]>([]);

  setSession(story: Story, questions: StoryQuestion[]): void {
    this.story.set(story);
    this.questions.set(questions);
  }

  clear(): void {
    this.story.set(null);
    this.questions.set([]);
  }
}