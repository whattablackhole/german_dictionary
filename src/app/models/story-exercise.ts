import { DifficultyLevel } from './word';

export type StoryExerciseType = 'mc' | 'mc-sentence' | 'cloze' | 'sentence';

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
  /** Direction of an mc exercise. 'de-native' (default): prompt is the German word, options are native translations.
   *  'native-de': prompt is the native word, options are German forms. */
  mcDirection?: 'de-native' | 'native-de';

  // mc-sentence — pick the correct German word to fill a blanked sentence
  mcSentence?: string;
  mcSentenceOptions?: string[];
  mcSentenceCorrect?: string;

  // Cloze: fill in the missing German word in a sentence
  clozeSentence?: string;
  /** Exact substrings of clozeSentence to blank (e.g. ["Schuhe"]) */
  clozeBlankWords?: string[];
  clozeHint?: string;

  // Sentence translation: translate a whole sentence into German
  sentenceGerman?: string;
  sentenceNative?: string;
}