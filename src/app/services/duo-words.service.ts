import { Injectable } from '@angular/core';
import { DUO_UNITS, DUO_WORDS } from '../data/duo-words';
import { DuoUnit, DuoWord } from '../models/flashcards';

/**
 * Статический словарь Duolingo для режима карточек.
 * Данные генерируются из duo-words.txt (npm run gen:duo-words) —
 * никакой сети, парсинга и кэша на рантайме не нужно.
 */
@Injectable({ providedIn: 'root' })
export class DuoWordsService {
  /** Все юниты курса (в порядке прохождения). */
  readonly units: DuoUnit[] = DUO_UNITS;

  /** Номер последнего юнита в словаре. */
  readonly maxUnit: number = DUO_UNITS.length
    ? DUO_UNITS[DUO_UNITS.length - 1].order
    : 0;

  /** Все слова словаря. */
  readonly words: DuoWord[] = DUO_WORDS;

  /** Слова юнитов 1..maxUnit, уникальные (первое вхождение), в порядке словаря. */
  poolUpTo(maxUnit: number): DuoWord[] {
    const seen = new Set<string>();
    const pool: DuoWord[] = [];
    for (const w of DUO_WORDS) {
      if (w.unit > maxUnit) continue;
      const key = w.german.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(w);
    }
    return pool;
  }

  /** Перемешанная колода для сессии: слова юнитов 1..maxUnit. */
  buildDeck(maxUnit: number, size: number, shuffleSeed?: number): DuoWord[] {
    return shuffled(this.poolUpTo(maxUnit), shuffleSeed).slice(
      0,
      Math.max(1, size)
    );
  }
}

/**
 * Дополнительные переводы слова — всё, кроме основного `russian`.
 * «печенье, печеньями, печенье» → ['печеньями'] (дубликаты и пустые
 * значения отфильтрованы, сравнение без учёта регистра и пробелов).
 */
export function altTranslations(word: DuoWord): string[] {
  const seen = new Set<string>([word.russian.trim().toLowerCase()]);
  const out: string[] = [];
  for (const part of word.translationsRaw.split(',')) {
    const translation = part.trim();
    const key = translation.toLowerCase();
    if (!translation || seen.has(key)) continue;
    seen.add(key);
    out.push(translation);
  }
  return out;
}

/** Fisher-Yates с опциональным seed (для тестов). */
export function shuffled<T>(arr: T[], seed?: number): T[] {
  const out = arr.slice();
  let s = seed ?? Date.now();
  const rnd = () => {
    // mulberry32
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}