import { Injectable, signal } from '@angular/core';
import { GermanCase } from '../models/preposition-rule';
import {
  DeclensionGender,
  DeclensionType,
  ArticleType,
} from '../models/case-declension';

const STORAGE_KEY = 'german-dictionary-declension-mastery';

export interface DeclensionMastery {
  /** e.g. "article:dative:masculine" */
  key: string;
  mastery: number;
  attempts: number;
  correct: number;
  lastPracticedAt: number | null;
}

@Injectable({ providedIn: 'root' })
export class DeclensionService {
  readonly mastery = signal<DeclensionMastery[]>([]);
  private readonly masteryMap = new Map<string, DeclensionMastery>();

  constructor() {
    this.loadFromStorage();
  }

  // ── MASTERY ──

  getMastery(key: string): DeclensionMastery {
    return (
      this.masteryMap.get(key) ?? {
        key,
        mastery: 0,
        attempts: 0,
        correct: 0,
        lastPracticedAt: null,
      }
    );
  }

  getMasteryValue(key: string): number {
    return this.getMastery(key).mastery;
  }

  recordAnswer(key: string, correct: boolean): void {
    const current = this.getMastery(key);
    const updated: DeclensionMastery = {
      ...current,
      attempts: current.attempts + 1,
      correct: current.correct + (correct ? 1 : 0),
      mastery: Math.max(0, Math.min(100, current.mastery + (correct ? 10 : -15))),
      lastPracticedAt: Date.now(),
    };
    this.masteryMap.set(key, updated);
    this.mastery.set(Array.from(this.masteryMap.values()));
    this.saveToStorage();
  }

  resetAll(): void {
    this.masteryMap.clear();
    this.mastery.set([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.masteryMap.values())));
    } catch {
      // ignore
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as DeclensionMastery[];
      for (const m of data) {
        this.masteryMap.set(m.key, m);
      }
      this.mastery.set(Array.from(this.masteryMap.values()));
    } catch {
      // ignore
    }
  }

  // ── MASTERY KEY HELPERS ──

  static articleKey(caseReq: GermanCase, gender: DeclensionGender | 'plural', articleType: ArticleType): string {
    return `article:${caseReq}:${gender}:${articleType}`;
  }

  static adjectiveKey(caseReq: GermanCase, gender: DeclensionGender | 'plural', declType: DeclensionType): string {
    return `adjective:${caseReq}:${gender}:${declType}`;
  }

  static nounKey(caseReq: GermanCase, gender: DeclensionGender | 'plural'): string {
    return `noun:${caseReq}:${gender}`;
  }
}