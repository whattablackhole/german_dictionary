export type Gender = 'der' | 'die' | 'das';

export type TranslationLanguage = 'ru' | 'en';

export type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'interjection'
  | 'numeral'
  | 'phrase';

export interface Word {
  id: string;
  german: string;
  partOfSpeech: PartOfSpeech;
  gender: Gender | null;
  translationEn: string;
  translationRu: string;
  level: DifficultyLevel;
  mastery: number;
  usageCount: number;
  createdAt: string;
}