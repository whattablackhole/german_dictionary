export type Gender = 'der' | 'die' | 'das';

export type TranslationLanguage = 'ru' | 'en';

export type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export type VerbType = 'strong' | 'weak' | 'mixed';

export type PluralFormation =
  | '-e'
  | '-en'
  | '-er'
  | '-s'
  | '-n'
  | '-'
  | 'umlaut'
  | 'umlaut + -e'
  | 'umlaut + -er'
  | 'umlaut + -en'
  | 'foreign';

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

export interface ExampleSentence {
  german: string;
  translationEn: string;
  translationRu: string;
}

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
  /** Marked as prioritized / "especially important to me" by the user. */
  priority?: boolean;
  createdAt: string;
  // Verb-specific fields (optional)
  verbType?: VerbType;
  /** The dictionary/infinitive form when german is a conjugated form. */
  infinitive?: string;
  presentThirdPerson?: string;
  simplePast?: string;
  pastParticiple?: string;
  // Noun-specific fields (optional)
  pluralForm?: string;
  pluralFormation?: PluralFormation;
  // Spaced repetition (SRS) fields
  srsInterval: number;
  srsNextReview: string;
  srsEase: number;
  srsConsecutiveCorrect: number;
}