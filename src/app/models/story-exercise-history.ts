import { DifficultyLevel } from './word';
import { StoryExercise } from './story-exercise';

export interface StoryExerciseResult {
  exerciseId: string;
  answered: boolean;
  correct: boolean;
  feedback: string;
  /** The option the user picked for multiple-choice questions. */
  selectedOption: string | null;
  /** The user's typed answer for cloze / sentence questions. */
  userInput: string;
  /** Score (0-100) returned by AI verification for sentence questions. */
  translationScore: number | null;
  /** The corrected German sentence from AI verification. */
  translationCorrected: string | null;
}

export interface StoryExerciseHistoryEntry {
  id: string;
  storyId: string;
  storyTitle: string;
  level: DifficultyLevel;
  /** When the session was completed (or last answered). */
  completedAt: string;
  /** The exercise set, stored so the session can be replayed later. */
  exercises: StoryExercise[];
  /** Per-question results, parallel to `exercises`. */
  results: StoryExerciseResult[];
  correctCount: number;
  totalCount: number;
  scorePercent: number;
}