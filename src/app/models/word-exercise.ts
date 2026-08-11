import { DifficultyLevel } from './word';

export interface BlankRange {
  start: number;
  end: number;
}

export interface WordExercise {
  id: string;
  wordId: string;
  fullSentence: string;
  targetWord: string;
  wordHint: string;
  /** Character ranges in fullSentence to blank (e.g., [{start:4, end:8}]) */
  blankRanges: BlankRange[];
  /** Whether the blank target has an article (der/die/das) immediately before it */
  hasArticle: boolean;
  level: DifficultyLevel;
  domain: string;
  grammarTopics: string[];
  createdAt: string;
  sessionCount: number;
}