import { Injectable, signal } from '@angular/core';
import {
  CASE_LABELS,
  GermanCase,
  PrepositionExample,
  PrepositionFlashcard,
  PrepositionRule,
  PREPOSITION_RULES,
  VerbPrepositionPair,
  VERB_PREPOSITION_PAIRS,
} from '../models/preposition-rule';

const STORAGE_KEY = 'german-dictionary-preposition-mastery';

export interface PairMastery {
  pairId: string;
  mastery: number; // 0-100
  attempts: number;
  correct: number;
  lastPracticedAt: number | null;
}

/** AI-generated exercise (blanked preposition in a sentence) */
export interface AiPrepositionExercise {
  sentenceWithBlank: string;
  correctPreposition: string;
  correctCase: GermanCase;
  hintEn: string;
  hintRu: string;
  explanation: string;
  options: string[];
}

@Injectable({ providedIn: 'root' })
export class PrepositionService {
  private readonly storage = new Map<string, PairMastery>();

  // Writable signals for reactive state
  readonly masteredPairs = signal<PairMastery[]>([]);

  constructor() {
    this.loadFromStorage();
  }

  // ─────────────────────────────────────────────
  // RULES
  // ─────────────────────────────────────────────

  getAllRules(): PrepositionRule[] {
    return PREPOSITION_RULES;
  }

  getRuleById(id: string): PrepositionRule | undefined {
    return PREPOSITION_RULES.find((r) => r.id === id);
  }

  // ─────────────────────────────────────────────
  // VERB-PREPOSITION PAIRS
  // ─────────────────────────────────────────────

  getAllPairs(): VerbPrepositionPair[] {
    return VERB_PREPOSITION_PAIRS;
  }

  getPairsByLevel(level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'): VerbPrepositionPair[] {
    if (!level) return VERB_PREPOSITION_PAIRS;
    return VERB_PREPOSITION_PAIRS.filter((p) => p.level === level);
  }

  getPairById(id: string): VerbPrepositionPair | undefined {
    return VERB_PREPOSITION_PAIRS.find((p) => p.id === id);
  }

  /** Randomly select N pairs not yet mastered (mastery < 80), fallback to all */
  selectPairsForSession(count: number, level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'): VerbPrepositionPair[] {
    const pairs = this.getPairsByLevel(level);
    const notMastered = pairs.filter((p) => {
      const m = this.storage.get(p.id);
      return !m || m.mastery < 80;
    });
    const pool = notMastered.length > 0 ? notMastered : pairs;
    return this.shuffle(pool).slice(0, count);
  }

  // ─────────────────────────────────────────────
  // MASTERY TRACKING
  // ─────────────────────────────────────────────

  getMastery(pairId: string): PairMastery {
    return (
      this.storage.get(pairId) ?? {
        pairId,
        mastery: 0,
        attempts: 0,
        correct: 0,
        lastPracticedAt: null,
      }
    );
  }

  getMasteryValue(pairId: string): number {
    return this.getMastery(pairId).mastery;
  }

  /** Record an answer for a pair. correct = boolean. Updates mastery by +/- delta. */
  recordAnswer(pairId: string, correct: boolean): void {
    const current = this.getMastery(pairId);
    const attempts = current.attempts + 1;
    const correctCount = current.correct + (correct ? 1 : 0);
    // Simple mastery: percentage of recent attempts, weighted
    const masteries = [...this.masteredPairs()];
    const newer = {
      pairId,
      mastery: Math.max(0, Math.min(100, current.mastery + (correct ? 10 : -15))),
      attempts,
      correct: correctCount,
      lastPracticedAt: Date.now(),
    };
    this.storage.set(pairId, newer);
    this.masteredPairs.set([
      ...masteries.filter((m) => m.pairId !== pairId),
      newer,
    ]);
    this.saveToStorage();
  }

  /** Reset mastery for a pair (or all if no id given) */
  resetMastery(pairId?: string): void {
    if (pairId) {
      this.storage.delete(pairId);
    } else {
      this.storage.clear();
    }
    this.refreshFromStorage();
    this.saveToStorage();
  }

  // ─────────────────────────────────────────────
  // FLASHCARD GENERATION (no AI needed)
  // ─────────────────────────────────────────────

  /**
   * Build a flashcard from a verb-preposition pair.
   * The user must recall the preposition AND the case.
   */
  buildVerbCard(pair: VerbPrepositionPair): PrepositionFlashcard {
    const distractors = this.pickDistractorPrepositions(pair.preposition, 3);
    const options = this.shuffle([pair.preposition, ...distractors]);
    return {
      id: `verb-${pair.id}`,
      title: pair.verb,
      prompt: `${pair.verb} ___ + ${CASE_LABELS[pair.case]}`,
      correctPreposition: pair.preposition,
      correctCase: pair.case,
      prepositionOptions: options,
      example: pair.example,
      gapNote: pair.translationGapNote,
      ruleTag: 'verb-fixed',
      isRuleCard: false,
    };
  }

  /** Build a rule-quiz card from a two-way preposition example (motion vs location) */
  buildTwoWayCard(rule: PrepositionRule, example: PrepositionExample): PrepositionFlashcard {
    // Replace the preposition in the German sentence with a blank
    const blanked = this.blankPreposition(example.german);
    const preposition = this.extractPreposition(example.german);
    const isMotion = example.translationEn.includes('motion');
    return {
      id: `rule-${rule.id}-${preposition}-${isMotion ? 'motion' : 'location'}`,
      title: `${rule.name} — ${isMotion ? 'Wohin? (motion)' : 'Wo? (location)'}`,
      prompt: blanked,
      correctPreposition: preposition,
      correctCase: isMotion ? 'accusative' : 'dative',
      prepositionOptions: this.shuffle([
        preposition,
        ...this.pickDistractorPrepositions(preposition, 3),
      ]),
      example,
      gapNote: isMotion
        ? 'WOHIN? → motion → Akkusativ. "Ich lege das Buch auf DEN Tisch."'
        : 'WO? → location → Dativ. "Das Buch liegt auf DEM Tisch."',
      ruleTag: rule.id,
      isRuleCard: true,
    };
  }

  /** Build a multiple-choice card for any rule example (choose the correct preposition) */
  buildRuleCard(rule: PrepositionRule, example: PrepositionExample): PrepositionFlashcard {
    const blanked = this.blankPreposition(example.german);
    const preposition = this.extractPreposition(example.german);
    return {
      id: `rule-${rule.id}-${preposition}`,
      title: rule.name,
      prompt: blanked,
      correctPreposition: preposition,
      correctCase: this.caseForRule(rule, example),
      prepositionOptions: this.shuffle([
        preposition,
        ...this.pickDistractorPrepositions(preposition, 3),
      ]),
      example,
      gapNote: rule.tips,
      ruleTag: rule.id,
      isRuleCard: true,
    };
  }

  /** Generate a session of cards from a specific rule (mode 1) */
  buildRuleSession(ruleId: string, count = 8): PrepositionFlashcard[] {
    const rule = this.getRuleById(ruleId);
    if (!rule) return [];

    const cards: PrepositionFlashcard[] = [];
    for (const ex of this.shuffle(rule.examples)) {
      if (cards.length >= count) break;
      if (rule.id === 'two-way') {
        cards.push(this.buildTwoWayCard(rule, ex));
      } else {
        cards.push(this.buildRuleCard(rule, ex));
      }
    }
    return cards;
  }

  /** Generate a session of verb-preposition cards (mode 3) */
  buildVerbSession(count = 8, level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'): PrepositionFlashcard[] {
    const pairs = this.selectPairsForSession(count, level);
    return pairs.map((p) => this.buildVerbCard(p));
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  caseForRule(rule: PrepositionRule, ex: PrepositionExample): GermanCase {
    switch (rule.category) {
      case 'accusative':
        return 'accusative';
      case 'dative':
        return 'dative';
      case 'genitive':
        return 'genitive';
      default: {
        // For contractions, the article inside tells us the case
        const low = ex.german.toLowerCase();
        if (/\b(am|im|beim|vom|zum|zur)\b/.test(low)) return 'dative';
        if (/\b(ins|ans)\b/.test(low)) return 'accusative';
        // For two-way: check if it's motion (wohin) or location (wo)
        return ex.translationEn.includes('motion') ? 'accusative' : 'dative';
      }
    }
  }

  private caseForPreposition(prep: string): GermanCase {
    const acc = ['durch', 'für', 'gegen', 'ohne', 'um'];
    const dat = ['aus', 'bei', 'mit', 'nach', 'seit', 'von', 'zu'];
    const gen = ['während', 'wegen', 'trotz', 'statt', 'außerhalb', 'innerhalb'];
    const p = prep.toLowerCase();
    if (acc.includes(p)) return 'accusative';
    if (dat.includes(p)) return 'dative';
    if (gen.includes(p)) return 'genitive';
    return 'accusative'; // default for two-way
  }

  /** Replace the preposition in a German sentence with a blank "___" */
  private blankPreposition(sentence: string): string {
    // Common prepositions to look for
    const preps = [
      'während', 'außerhalb', 'innerhalb', 'hinter', 'zwischen', 'zwischen',
      'neben', 'gegen', 'über', 'unter', 'ohne', 'durch', 'wegen', 'trotz',
      'statt', 'beim', 'vom', 'zum', 'zur', 'ans', 'am', 'ins', 'im',
      'für', 'mit', 'nach', 'von', 'aus', 'bei', 'vor', 'auf', 'an', 'zu', 'in', 'um',
    ];
    const words = sentence.split(/\s+/);
    // Find first preposition (also handle contractions like "im" "am")
    for (let i = 0; i < words.length; i++) {
      const clean = words[i].replace(/[.,!?;:«»"']/g, '');
      const matches = preps.some((p) => clean.toLowerCase() === p.toLowerCase());
      // Also match word+punctuation
      if (matches) {
        // Preserve punctuation
        const punct = words[i].match(/[.,!?;:«»"']/)?.[0] ?? '';
        const isUpper = words[i][0] === words[i][0]?.toUpperCase();
        words[i] = `___${punct}`;
        return words.join(' ');
      }
    }
    return sentence;
  }

  /** Extract the preposition from a German sentence (best effort) */
  private extractPreposition(sentence: string): string {
    const preps = [
      'während', 'außerhalb', 'innerhalb', 'hinter', 'zwischen',
      'neben', 'gegen', 'über', 'unter', 'ohne', 'durch', 'wegen', 'trotz',
      'statt', 'beim', 'vom', 'zum', 'zur', 'ans', 'am', 'ins', 'im',
      'für', 'mit', 'nach', 'von', 'aus', 'bei', 'vor', 'auf', 'an', 'zu', 'in', 'um',
    ];
    const words = sentence.split(/\s+/);
    for (const word of words) {
      const clean = word.replace(/[.,!?;:«»"']/g, '').toLowerCase();
      const found = preps.find((p) => p === clean);
      if (found) return found;
    }
    return '';
  }

  private pickDistractorPrepositions(correct: string, count: number): string[] {
    const all = [
      'auf', 'an', 'in', 'über', 'unter', 'mit', 'von', 'für',
      'nach', 'zu', 'aus', 'bei', 'um', 'gegen', 'durch', 'vor',
      'hinter', 'neben', 'zwischen', 'ohne', 'seit', 'während', 'wegen', 'trotz',
    ].filter((p) => p !== correct);
    return this.shuffle(all).slice(0, count);
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ─────────────────────────────────────────────
  // STORAGE
  // ─────────────────────────────────────────────

  private saveToStorage(): void {
    try {
      const data = Array.from(this.storage.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage may be unavailable
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as PairMastery[];
      for (const m of data) {
        this.storage.set(m.pairId, m);
      }
      this.masteredPairs.set(data);
    } catch {
      // ignore corrupt storage
    }
  }

  private refreshFromStorage(): void {
    this.masteredPairs.set(Array.from(this.storage.values()));
  }
}