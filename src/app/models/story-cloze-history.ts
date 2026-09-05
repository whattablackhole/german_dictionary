import { DifficultyLevel } from './word';
import { StoryCloze } from './story-cloze';

export interface StoryClozeResult {
  /** 0-based index of the sentence in the cloze. */
  sentenceIndex: number;
  /** 0-based position of the blank inside that sentence's removed list. */
  blankIndex: number;
  /** The correct word for this blank. */
  correctWord: string;
  /** The word the user placed here (if any). */
  placedWord: string | null;
  answered: boolean;
  correct: boolean;
}

export interface StoryClozeHistoryEntry {
  id: string;
  storyId: string;
  storyTitle: string;
  level: DifficultyLevel;
  /** When the session was completed (or last answered). */
  completedAt: string;
  /** The cloze task, stored so the session can be replayed later. */
  cloze: StoryCloze;
  /** Per-blank results, parallel to the blank order in `cloze`. */
  results: StoryClozeResult[];
  correctCount: number;
  totalCount: number;
  scorePercent: number;
}