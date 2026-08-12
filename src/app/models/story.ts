import { DifficultyLevel } from './word';

export interface Story {
  id: string;
  title: string;
  german: string;
  translationEn: string;
  translationRu: string;
  level: DifficultyLevel;
  domain: string;
  grammarTopics: string[];
  wordCount: number;
  createdAt: string;
  audioUrl?: string;
}

export interface StoryConfig {
  theme: string;
  level: DifficultyLevel;
  wordTypes: string[];
  grammarTopics: string[];
  sentenceCount: number;
}