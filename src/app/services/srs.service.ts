import { Injectable } from '@angular/core';
import { Word } from '../models/word';
import { WordService } from './word.service';

export type SrsGrade = 0 | 1 | 2 | 3 | 4 | 5;

export interface SrsReviewResult {
  word: Word;
  grade: SrsGrade;
  previousInterval: number;
  newInterval: number;
  previousEase: number;
  newEase: number;
  streakBefore: number;
  streakAfter: number;
}

@Injectable({ providedIn: 'root' })
export class SrsService {
  constructor(private readonly wordService: WordService) {}

  /**
   * Returns all words that are due for review (srsNextReview <= now).
   * Sorted by next review ascending (most overdue first).
   */
  getDueWords(): Word[] {
    const now = new Date();
    // Compare against start of today so all words due today appear
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return this.wordService
      .getWords()
      .filter((w) => {
        const nextReview = new Date(w.srsNextReview);
        return nextReview <= today;
      })
      .sort(
        (a, b) =>
          new Date(a.srsNextReview).getTime() -
          new Date(b.srsNextReview).getTime()
      );
  }

  /**
   * Returns the number of words due for review today.
   */
  getDueCount(): number {
    return this.getDueWords().length;
  }

  /**
   * Returns all words that have been reviewed at least once (srsInterval > 0),
   * sorted by next review date ascending.
   */
  getScheduledWords(): Word[] {
    return this.wordService
      .getWords()
      .filter((w) => w.srsInterval > 0)
      .sort(
        (a, b) =>
          new Date(a.srsNextReview).getTime() -
          new Date(b.srsNextReview).getTime()
      );
  }

  /**
   * Returns words that have never been reviewed (new words).
   */
  getNewWords(): Word[] {
    return this.wordService.getWords().filter((w) => w.srsInterval === 0);
  }

  /**
   * Core SM-2 algorithm.
   *
   * grade:
   *   0 = complete blackout (forgot everything)
   *   1 = forgot, but remembered after seeing the answer
   *   2 = remembered with significant effort (hesitant)
   *   3 = remembered with some difficulty
   *   4 = remembered correctly after some thought
   *   5 = perfect recall (immediate)
   */
  recordReview(wordId: string, grade: SrsGrade): SrsReviewResult {
    const words = this.wordService.getWords();
    const word = words.find((w) => w.id === wordId);
    if (!word) {
      throw new Error(`Word with id "${wordId}" not found`);
    }

    const previousInterval = word.srsInterval;
    const previousEase = word.srsEase;
    const streakBefore = word.srsConsecutiveCorrect;

    let interval = previousInterval;
    let ease = previousEase;
    let streak = streakBefore;

    if (grade < 2) {
      // Failed review — reset progress
      streak = 0;
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
    } else {
      // Successful review — grow interval
      streak += 1;

      if (streak === 1) {
        interval = 1;
      } else if (streak === 2) {
        interval = 3;
      } else {
        interval = Math.round(interval * ease);
      }

      // Adjust ease based on grade quality
      // Grade 3 = no change, grade 4 = +0.15, grade 5 = +0.3, grade 2 = -0.15
      ease = Math.max(1.3, ease + 0.15 * (grade - 3));
    }

    // Cap maximum interval at 365 days (1 year)
    const cappedInterval = Math.min(interval, 365);

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + cappedInterval);

    // Round ease to 2 decimal places
    const roundedEase = Math.round(ease * 100) / 100;

    // Update mastery to reflect SRS progress
    const mastery = this.calculateMastery(cappedInterval, streak);

    const updatedWord: Word = {
      ...word,
      srsInterval: cappedInterval,
      srsNextReview: nextReview.toISOString(),
      srsEase: roundedEase,
      srsConsecutiveCorrect: streak,
      mastery,
    };

    this.wordService.updateWord(wordId, updatedWord);

    return {
      word: updatedWord,
      grade,
      previousInterval,
      newInterval: cappedInterval,
      previousEase,
      newEase: roundedEase,
      streakBefore,
      streakAfter: streak,
    };
  }

  /**
   * Calculates a mastery percentage (0–100) from SRS data.
   *
   * - Streak 0 = 0–10%
   * - Streak 1 = 15%
   * - Streak 2 with interval 3 = 30%
   * - Streak 3 with interval ~7+ = 50%
   * - Streak 5+ with interval 30+ = 80%
   * - Streak 10+ with interval 90+ = 100%
   */
  private calculateMastery(interval: number, streak: number): number {
    if (streak === 0) return Math.min(10, interval * 5);
    if (streak === 1) return 15;
    if (streak === 2) return Math.min(30, 15 + interval * 5);
    if (interval >= 90 && streak >= 10) return 100;
    if (interval >= 30 && streak >= 5) return Math.min(90, 50 + streak * 5);
    if (interval >= 7 && streak >= 3) return 50;
    return 15 + streak * 8;
  }

  /**
   * Resets SRS data for a word back to defaults (never reviewed).
   */
  resetWord(wordId: string): void {
    const words = this.wordService.getWords();
    const word = words.find((w) => w.id === wordId);
    if (!word) return;

    const now = new Date().toISOString();
    this.wordService.updateWord(wordId, {
      ...word,
      srsInterval: 0,
      srsNextReview: now,
      srsEase: 2.5,
      srsConsecutiveCorrect: 0,
    });
  }
}