import { Injectable, signal } from '@angular/core';
import { Story } from '../models/story';
import { StoryExercise } from '../models/story-exercise';

@Injectable({ providedIn: 'root' })
export class StoryExerciseService {
  /** The story the current exercise session was generated from. */
  readonly story = signal<Story | null>(null);
  /** The shuffled exercises for the current session. */
  readonly exercises = signal<StoryExercise[]>([]);

  setSession(story: Story, exercises: StoryExercise[]): void {
    this.story.set(story);
    this.exercises.set(exercises);
  }

  clear(): void {
    this.story.set(null);
    this.exercises.set([]);
  }
}