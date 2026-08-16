import { DifficultyLevel } from './word';

export interface DiaryCorrection {
  startIndex: number;
  endIndex: number;
  original: string;
  corrected: string;
  explanation: string;
}

export interface DiaryFollowUpQuestion {
  de: string;
  en: string;
}

export interface DiaryFeedback {
  overall: string;
  corrections: DiaryCorrection[];
  correctedText: string;
  suggestions: string[];
  unknownWords: string[];
  followUpQuestions: DiaryFollowUpQuestion[];
  cefrEstimate: DifficultyLevel;
  encouragements: string;
}

export interface DiaryEntry {
  id: string;
  timestamp: number;
  text: string;
  feedback: DiaryFeedback;
}