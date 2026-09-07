import { Injectable, signal } from '@angular/core';
import {
  VerbTrainerAttempt,
  VerbTrainerOverallStats,
  VerbTrainerStatsRow,
} from '../models/verb-trainer';

const STORAGE_KEY = 'german-dictionary-verb-trainer';

/**
 * Local persistence for verb-trainer attempts. Each attempt stores the
 * verb, the slot (person × tense), the student's answer and the outcome so
 * the trainer can later surface weak points (e.g. umlaut errors, separable
 * prefix mix-ups) without re-sending old data to the AI.
 */
@Injectable({ providedIn: 'root' })
export class VerbTrainerService {
  readonly history = signal<VerbTrainerAttempt[]>(this.load());

  /** History entries for one verb (case-insensitive), newest first. */
  getHistoryByVerb(verb: string): VerbTrainerAttempt[] {
    const key = verb.trim().toLowerCase();
    return this.history()
      .filter((a) => a.verb.toLowerCase() === key)
      .reverse();
  }

  /** Aggregated stats for one verb. */
  getStatsByVerb(verb: string): { total: number; correct: number; accuracy: number } {
    const entries = this.getHistoryByVerb(verb);
    const correct = entries.filter((e) => e.correct).length;
    return {
      total: entries.length,
      correct,
      accuracy: entries.length === 0 ? 0 : Math.round((correct / entries.length) * 100),
    };
  }

  /** Stats across every recorded attempt (all verbs). */
  getOverallStats(): VerbTrainerOverallStats {
    const history = this.history();
    const verbs = new Set(history.map((a) => a.verb.trim().toLowerCase()));
    const correct = history.filter((a) => a.correct).length;
    return {
      verbsTrained: verbs.size,
      totalAttempts: history.length,
      totalCorrect: correct,
      accuracy: history.length === 0 ? 0 : Math.round((correct / history.length) * 100),
    };
  }

  /**
   * Aggregated stats for every trained verb (any recorded attempt), sorted by
   * most attempts first, weakest accuracy next, then alphabetically. Verbs are
   * grouped case-insensitively; the first recorded spelling is kept for display.
   */
  getStatsPerVerb(): VerbTrainerStatsRow[] {
    const byVerb = new Map<string, VerbTrainerStatsRow>();
    for (const a of this.history()) {
      const key = a.verb.trim().toLowerCase();
      let row = byVerb.get(key);
      if (!row) {
        row = { verb: a.verb.trim(), total: 0, correct: 0, accuracy: 0 };
        byVerb.set(key, row);
      }
      row.total += 1;
      if (a.correct) row.correct += 1;
    }
    for (const row of byVerb.values()) {
      row.accuracy = Math.round((row.correct / row.total) * 100);
    }
    return [...byVerb.values()].sort(
      (a, b) => b.total - a.total || a.accuracy - b.accuracy || a.verb.localeCompare(b.verb)
    );
  }

  /** Appends an attempt, keeping at most maxEntries entries in history. */
  record(attempt: VerbTrainerAttempt, maxEntries = 500): void {
    this.history.update((h) => {
      const next = [...h, attempt];
      return next.length > maxEntries ? next.slice(next.length - maxEntries) : next;
    });
    this.save();
  }

  clearHistory(): void {
    this.history.set([]);
    this.save();
  }

  private load(): VerbTrainerAttempt[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as VerbTrainerAttempt[]) : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history()));
    } catch {
      // storage may be unavailable (tests / private mode) — history is best-effort
    }
  }
}