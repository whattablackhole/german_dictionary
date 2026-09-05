import { DifficultyLevel } from './word';

export type StoryFormat = 'prose' | 'dialog';

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
  /** 'dialog' = the German text is a scripted conversation (one line per speaker). */
  format?: StoryFormat;
}

export interface StoryConfig {
  theme: string;
  level: DifficultyLevel;
  wordTypes: string[];
  grammarTopics: string[];
  sentenceCount: number;
  format?: StoryFormat;
}