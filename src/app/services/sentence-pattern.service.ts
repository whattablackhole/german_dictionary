import { Injectable } from '@angular/core';
import { SentencePattern, PatternHistory, PatternSubmission, SentenceFeedback, SENTENCE_PATTERNS } from '../models/sentence-pattern';

const STORAGE_KEY = 'german-dictionary-pattern-history';

@Injectable({ providedIn: 'root' })
export class SentencePatternService {
  getAllPatterns(): SentencePattern[] {
    return SENTENCE_PATTERNS;
  }

  getPatternById(id: string): SentencePattern | undefined {
    return SENTENCE_PATTERNS.find((p) => p.id === id);
  }

  getHistories(): Record<string, PatternHistory> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, PatternHistory>;
    } catch {
      return {};
    }
  }

  getHistory(patternId: string): PatternHistory {
    const histories = this.getHistories();
    return (
      histories[patternId] ?? {
        patternId,
        mastery: 0,
        submissions: [],
      }
    );
  }

  getMastery(patternId: string): number {
    return this.getHistory(patternId).mastery;
  }

  addSubmission(patternId: string, feedback: SentenceFeedback): PatternSubmission {
    const submission: PatternSubmission = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      sentence: '', // will be set separately
      feedback,
    };
    const histories = this.getHistories();
    const history = histories[patternId] ?? {
      patternId,
      mastery: 0,
      submissions: [],
    };
    history.submissions.push(submission);
    history.mastery = Math.max(0, Math.min(100, history.mastery + feedback.masteryDelta));
    histories[patternId] = history;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(histories));
    return submission;
  }

  updateSubmissionSentence(patternId: string, submissionId: string, sentence: string): void {
    const histories = this.getHistories();
    const history = histories[patternId];
    if (!history) return;
    const sub = history.submissions.find((s) => s.id === submissionId);
    if (sub) {
      sub.sentence = sentence;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(histories));
    }
  }

  /** Seed random words from the user's vocabulary for display */
  seedWords(allWords: { german: string; translationEn: string; translationRu: string }[], count: number = 40): { german: string; translationEn: string; translationRu: string }[] {
    const shuffled = [...allWords].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}