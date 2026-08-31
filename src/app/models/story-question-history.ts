import { DifficultyLevel } from './word';
import { StoryQuestion } from './story-question';

export interface StoryQuestionResult {
  questionId: string;
  answered: boolean;
  correct: boolean;
  /** Score (0-100) returned by AI verification. */
  score: number | null;
  /** The user's typed answer. */
  userInput: string;
  /** AI feedback text. */
  feedback: string;
  /** The corrected German answer from AI verification. */
  correctedAnswer: string | null;
}

export interface StoryQuestionHistoryEntry {
  id: string;
  storyId: string;
  storyTitle: string;
  level: DifficultyLevel;
  /** When the session was completed (or last answered). */
  completedAt: string;
  /** The question set, stored so the session can be replayed later. */
  questions: StoryQuestion[];
  /** Per-question results, parallel to `questions`. */
  results: StoryQuestionResult[];
  correctCount: number;
  totalCount: number;
  scorePercent: number;
}