import { Component, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ExerciseListComponent } from '../../components/exercise-list/exercise-list.component';
import { StoryExerciseService } from '../../services/story-exercise.service';
import { StoryExerciseHistoryService } from '../../services/story-exercise-history.service';
import { Story } from '../../models/story';
import { StoryExerciseResult } from '../../models/story-exercise-history';

@Component({
  selector: 'app-story-exercises',
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    ExerciseListComponent,
  ],
  templateUrl: './story-exercises.component.html',
  styleUrl: './story-exercises.component.scss',
})
export class StoryExercisesComponent {
  readonly story: Signal<Story | null>;

  constructor(
    readonly storyExerciseService: StoryExerciseService,
    private readonly historyService: StoryExerciseHistoryService,
    private readonly router: Router
  ) {
    this.story = storyExerciseService.story;
  }

  /** Persists a completed session to exercise history. */
  onComplete(results: StoryExerciseResult[]): void {
    this.saveResults(results);
  }

  /** Quits mid-session: persists results so far and returns to Stories. */
  onQuit(results: StoryExerciseResult[]): void {
    this.saveResults(results);
    this.storyExerciseService.clear();
    this.router.navigate(['/stories']);
  }

  backToStories(): void {
    this.storyExerciseService.clear();
    this.router.navigate(['/stories']);
  }

  /** Persists the given session results (skips runs with no answered questions). */
  private saveResults(results: StoryExerciseResult[]): void {
    const story = this.storyExerciseService.story();
    if (!story) return;
    if (results.every((r) => !r.answered)) return;

    this.historyService.addSession(
      story,
      this.storyExerciseService.exercises(),
      results
    );
  }
}
