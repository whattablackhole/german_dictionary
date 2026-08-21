import { DifficultyLevel } from './word';

export type StoryExerciseType = 'mc' | 'cloze' | 'sentence';

export interface StoryExercise {
  id: string;
  storyId: string;
  /** The German word this exercise trains */
  word: string;
  type: StoryExerciseType;
  level: DifficultyLevel;

  // Multiple-choice: choose the correct translation from 4 options
  mcPrompt?: string;
  mcOptions?: string[];
  mcCorrect?: string;

  // Cloze: fill in the missing German word in a sentence
  clozeSentence?: string;
  /** Exact substrings of clozeSentence to blank (e.g. ["Schuhe"]) */
  clozeBlankWords?: string[];
  clozeHint?: string;

  // Sentence translation: translate a whole sentence into German
  sentenceGerman?: string;
  sentenceNative?: string;
}