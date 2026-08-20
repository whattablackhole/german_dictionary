import { Injectable, signal } from '@angular/core';
import { Word, Gender, DifficultyLevel, PartOfSpeech } from '../models/word';

const STORAGE_KEY = 'german-dictionary-words';

function srsDefaults() {
  const now = new Date().toISOString();
  return {
    srsInterval: 0,
    srsNextReview: now,
    srsEase: 2.5,
    srsConsecutiveCorrect: 0,
  };
}

const SEED_WORDS: Word[] = [
  { id: '1', german: 'Hund', partOfSpeech: 'noun', gender: 'der', translationEn: 'dog', translationRu: 'собака', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-01T10:00:00.000Z', pluralForm: 'Hunde', pluralFormation: '-e', ...srsDefaults() },
  { id: '2', german: 'Katze', partOfSpeech: 'noun', gender: 'die', translationEn: 'cat', translationRu: 'кошка', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-01T10:00:00.000Z', pluralForm: 'Katzen', pluralFormation: '-en', ...srsDefaults() },
  { id: '3', german: 'Haus', partOfSpeech: 'noun', gender: 'das', translationEn: 'house', translationRu: 'дом', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-02T10:00:00.000Z', pluralForm: 'Häuser', pluralFormation: 'umlaut + -er', ...srsDefaults() },
  { id: '4', german: 'Mann', partOfSpeech: 'noun', gender: 'der', translationEn: 'man', translationRu: 'мужчина', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-02T10:00:00.000Z', pluralForm: 'Männer', pluralFormation: 'umlaut + -er', ...srsDefaults() },
  { id: '5', german: 'Frau', partOfSpeech: 'noun', gender: 'die', translationEn: 'woman', translationRu: 'женщина', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-03T10:00:00.000Z', pluralForm: 'Frauen', pluralFormation: '-en', ...srsDefaults() },
  { id: '6', german: 'Kind', partOfSpeech: 'noun', gender: 'das', translationEn: 'child', translationRu: 'ребёнок', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-03T10:00:00.000Z', pluralForm: 'Kinder', pluralFormation: '-er', ...srsDefaults() },
  { id: '7', german: 'Baum', partOfSpeech: 'noun', gender: 'der', translationEn: 'tree', translationRu: 'дерево', level: 'A2', mastery: 0, usageCount: 0, createdAt: '2026-08-04T10:00:00.000Z', pluralForm: 'Bäume', pluralFormation: 'umlaut + -e', ...srsDefaults() },
  { id: '8', german: 'Blume', partOfSpeech: 'noun', gender: 'die', translationEn: 'flower', translationRu: 'цветок', level: 'A2', mastery: 0, usageCount: 0, createdAt: '2026-08-04T10:00:00.000Z', pluralForm: 'Blumen', pluralFormation: '-en', ...srsDefaults() },
  { id: '9', german: 'Auto', partOfSpeech: 'noun', gender: 'das', translationEn: 'car', translationRu: 'автомобиль', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-05T10:00:00.000Z', pluralForm: 'Autos', pluralFormation: '-s', ...srsDefaults() },
  { id: '10', german: 'Tisch', partOfSpeech: 'noun', gender: 'der', translationEn: 'table', translationRu: 'стол', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-05T10:00:00.000Z', pluralForm: 'Tische', pluralFormation: '-e', ...srsDefaults() },
  { id: '11', german: 'Lampe', partOfSpeech: 'noun', gender: 'die', translationEn: 'lamp', translationRu: 'лампа', level: 'A2', mastery: 0, usageCount: 0, createdAt: '2026-08-06T10:00:00.000Z', pluralForm: 'Lampen', pluralFormation: '-en', ...srsDefaults() },
  { id: '12', german: 'Buch', partOfSpeech: 'noun', gender: 'das', translationEn: 'book', translationRu: 'книга', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-06T10:00:00.000Z', pluralForm: 'Bücher', pluralFormation: 'umlaut + -er', ...srsDefaults() },
  { id: '13', german: 'Apfel', partOfSpeech: 'noun', gender: 'der', translationEn: 'apple', translationRu: 'яблоко', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-07T10:00:00.000Z', pluralForm: 'Äpfel', pluralFormation: 'umlaut', ...srsDefaults() },
  { id: '14', german: 'Milch', partOfSpeech: 'noun', gender: 'die', translationEn: 'milk', translationRu: 'молоко', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-07T10:00:00.000Z', pluralForm: '—', pluralFormation: '-', ...srsDefaults() },
  { id: '15', german: 'Wasser', partOfSpeech: 'noun', gender: 'das', translationEn: 'water', translationRu: 'вода', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-08T10:00:00.000Z', pluralForm: 'Wasser', pluralFormation: '-', ...srsDefaults() },
  // Verbs with principal parts
  { id: '16', german: 'sein', partOfSpeech: 'verb', gender: null, translationEn: 'to be', translationRu: 'быть', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-01T10:00:00.000Z', verbType: 'strong', presentThirdPerson: 'ist', simplePast: 'war', pastParticiple: 'gewesen', ...srsDefaults() },
  { id: '17', german: 'haben', partOfSpeech: 'verb', gender: null, translationEn: 'to have', translationRu: 'иметь', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-01T10:00:00.000Z', verbType: 'weak', presentThirdPerson: 'hat', simplePast: 'hatte', pastParticiple: 'gehabt', ...srsDefaults() },
  { id: '18', german: 'fliegen', partOfSpeech: 'verb', gender: null, translationEn: 'to fly', translationRu: 'летать', level: 'A2', mastery: 0, usageCount: 0, createdAt: '2026-08-02T10:00:00.000Z', verbType: 'strong', presentThirdPerson: 'fliegt', simplePast: 'flog', pastParticiple: 'geflogen', ...srsDefaults() },
  { id: '19', german: 'gehen', partOfSpeech: 'verb', gender: null, translationEn: 'to go', translationRu: 'идти', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-02T10:00:00.000Z', verbType: 'strong', presentThirdPerson: 'geht', simplePast: 'ging', pastParticiple: 'gegangen', ...srsDefaults() },
  { id: '20', german: 'machen', partOfSpeech: 'verb', gender: null, translationEn: 'to do/make', translationRu: 'делать', level: 'A1', mastery: 0, usageCount: 0, createdAt: '2026-08-03T10:00:00.000Z', verbType: 'weak', presentThirdPerson: 'macht', simplePast: 'machte', pastParticiple: 'gemacht', ...srsDefaults() },
];

// Type that makes SRS fields optional for addWord (they have defaults)
type WordInput = Omit<Word, 'id' | 'createdAt' | 'srsInterval' | 'srsNextReview' | 'srsEase' | 'srsConsecutiveCorrect'> & {
  srsInterval?: number;
  srsNextReview?: string;
  srsEase?: number;
  srsConsecutiveCorrect?: number;
};

@Injectable({ providedIn: 'root' })
export class WordService {
  readonly words = signal<Word[]>(this.loadWords());

  getWords(): Word[] {
    return this.words();
  }

  getWordsByGender(gender: Gender): Word[] {
    return this.words().filter((w) => w.gender === gender);
  }

  getWordsByPartOfSpeech(parts: PartOfSpeech[]): Word[] {
    if (parts.length === 0) {
      return this.words();
    }
    return this.words().filter((w) => parts.includes(w.partOfSpeech));
  }

  getWordsByDateRange(from: Date | null, to: Date | null): Word[] {
    return this.words().filter((w) => {
      const created = new Date(w.createdAt);
      if (from && created < from) {
        return false;
      }
      if (to) {
        const toEnd = new Date(to);
        toEnd.setHours(23, 59, 59, 999);
        if (created > toEnd) {
          return false;
        }
      }
      return true;
    });
  }

  getWordsByLevels(levels: DifficultyLevel[]): Word[] {
    if (levels.length === 0) {
      return this.words();
    }
    return this.words().filter((w) => levels.includes(w.level));
  }

  private filterPool(
    pool: Word[],
    levels: DifficultyLevel[],
    partsOfSpeech: PartOfSpeech[]
  ): Word[] {
    let result = pool;
    if (levels.length > 0) {
      result = result.filter((w) => levels.includes(w.level));
    }
    if (partsOfSpeech.length > 0) {
      result = result.filter((w) => partsOfSpeech.includes(w.partOfSpeech));
    }
    if (result.length === 0) {
      return pool;
    }
    return result;
  }

  /**
   * Selects up to maxCount words for AI sentence generation.
   * Filters by difficulty + parts of speech, then weighted shuffle by usageCount.
   */
  selectWordsForGeneration(
    levels: DifficultyLevel[],
    maxCount = 50,
    partsOfSpeech: PartOfSpeech[] = []
  ): Word[] {
    const pool = this.filterPool(this.words(), levels, partsOfSpeech);

    if (pool.length <= maxCount) {
      return pool;
    }

    const weighted = pool.map((w) => ({
      word: w,
      weight: 1 / (w.usageCount + 1),
    }));

    const selected: Word[] = [];
    const remaining = [...weighted];

    while (selected.length < maxCount && remaining.length > 0) {
      const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);
      let random = Math.random() * totalWeight;

      for (let i = 0; i < remaining.length; i++) {
        random -= remaining[i].weight;
        if (random <= 0) {
          selected.push(remaining[i].word);
          remaining.splice(i, 1);
          break;
        }
      }
    }

    return selected;
  }

  /**
   * Selects words for cloze practice, weighted by mastery.
   * Low mastery = high priority. Mastered words (100) still get ~10-20% priority.
   */
  selectWordsForPractice(
    levels: DifficultyLevel[],
    maxCount = 50,
    partsOfSpeech: PartOfSpeech[] = []
  ): Word[] {
    const pool = this.filterPool(this.words(), levels, partsOfSpeech);

    if (pool.length <= maxCount) {
      return pool;
    }

    // Weight: (100 - mastery + 20) / 120
    const weighted = pool.map((w) => ({
      word: w,
      weight: (100 - w.mastery + 20) / 120,
    }));

    const selected: Word[] = [];
    const remaining = [...weighted];

    while (selected.length < maxCount && remaining.length > 0) {
      const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);
      let random = Math.random() * totalWeight;

      for (let i = 0; i < remaining.length; i++) {
        random -= remaining[i].weight;
        if (random <= 0) {
          selected.push(remaining[i].word);
          remaining.splice(i, 1);
          break;
        }
      }
    }

    return selected;
  }

  updateMastery(wordId: string, newMastery: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(newMastery)));
    this.words.update((words) =>
      words.map((w) => (w.id === wordId ? { ...w, mastery: clamped } : w))
    );
    this.save();
  }

  incrementUsage(germanWords: string[]): void {
    if (germanWords.length === 0) {
      return;
    }
    const lowerWords = germanWords.map((w) => w.toLowerCase());
    this.words.update((words) =>
      words.map((w) =>
        lowerWords.includes(w.german.toLowerCase())
          ? { ...w, usageCount: w.usageCount + 1 }
          : w
      )
    );
    this.save();
  }

  addWord(word: WordInput): void {
    const now = new Date().toISOString();
    const newWord: Word = {
      ...word,
      id: crypto.randomUUID(),
      createdAt: now,
      srsInterval: word.srsInterval ?? 0,
      srsNextReview: word.srsNextReview ?? now,
      srsEase: word.srsEase ?? 2.5,
      srsConsecutiveCorrect: word.srsConsecutiveCorrect ?? 0,
    };
    this.words.update((words) => [...words, newWord]);
    this.save();
  }

  updateWord(id: string, changes: Partial<Omit<Word, 'id' | 'createdAt'>>): void {
    this.words.update((words) =>
      words.map((w) => (w.id === id ? { ...w, ...changes } : w))
    );
    this.save();
  }

  deleteWord(id: string): void {
    this.words.update((words) => words.filter((w) => w.id !== id));
    this.save();
  }

  private loadWords(): Word[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Word[];
        const fallback = new Date().toISOString();
        return parsed.map((w) => {
          const legacy = w as Word & { translation?: string };
          const seed = SEED_WORDS.find((s) => s.german === w.german);
          const ru = w.translationRu;
          const ruIsEnglish = ru && ru === w.translationEn;
          return {
            ...w,
            createdAt: w.createdAt ?? fallback,
            level: w.level ?? seed?.level ?? 'A1',
            partOfSpeech: w.partOfSpeech ?? 'noun',
            mastery: (w as Word).mastery ?? 0,
            usageCount: (w as Word).usageCount ?? 0,
            gender: w.gender ?? (w.partOfSpeech === 'noun' ? seed?.gender ?? 'der' : null),
            translationEn: w.translationEn ?? legacy.translation ?? seed?.translationEn ?? '',
            translationRu:
              ru && !ruIsEnglish
                ? ru
                : seed?.translationRu ?? legacy.translation ?? '',
            // SRS defaults for legacy data
            srsInterval: (w as Word).srsInterval ?? 0,
            srsNextReview: (w as Word).srsNextReview ?? fallback,
            srsEase: (w as Word).srsEase ?? 2.5,
            srsConsecutiveCorrect: (w as Word).srsConsecutiveCorrect ?? 0,
          };
        });
      } catch {
        // fall through to seed data
      }
    }
    return [...SEED_WORDS];
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.words()));
  }
}