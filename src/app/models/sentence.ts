import { DifficultyLevel } from './word';

export interface Sentence {
  id: string;
  german: string;
  translationEn: string;
  translationRu: string;
  level: DifficultyLevel;
  domain: string;
  grammarTopics: string[];
  createdAt: string;
  passedAt: string | null;
  timesPassed: number;
}