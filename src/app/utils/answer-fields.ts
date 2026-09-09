import { Word } from '../models/word';

/** One typed-answer input on a Native → German card. */
export interface AnswerField {
  label: string;
  /** Human-readable expected answer (e.g. "der Baum"). */
  expectedRaw: string;
  /** Case-insensitive normalized key used for scoring. */
  expectedKey: string;
  value: string;
  correct: boolean | null;
}

/**
 * Builds the typed-answer inputs for a Native → German card:
 * - Nouns: "Artikel + Wort" (der Baum) and "Plural (oder -)" (die Bäume, or "-" when
 *   the noun has no plural ending / no plural form is stored).
 * - Verbs: Infinitiv, 3. Person Präsens, Präteritum, Partizip II (or "-" when missing).
 * - Everything else: a single "Wort" input.
 */
export function buildAnswerFields(word: Word): AnswerField[] {
  const fields: AnswerField[] = [];
  const push = (label: string, expectedRaw: string): void => {
    fields.push({
      label,
      expectedRaw,
      expectedKey: normalizeAnswer(expectedRaw),
      value: '',
      correct: null,
    });
  };

  if (word.partOfSpeech === 'noun') {
    const gender = word.gender ?? '';
    push('Artikel + Wort', gender ? `${gender} ${word.german}` : word.german);
    const formation = word.pluralFormation;
    const plural = word.pluralForm?.trim() ?? '';
    if (formation === '-' || plural === '' || plural === '—') {
      push('Plural (oder -)', '-');
    } else if (plural.toLowerCase().startsWith('die ')) {
      push('Plural (oder -)', plural);
    } else {
      push('Plural (oder -)', `die ${plural}`);
    }
  } else if (word.partOfSpeech === 'verb') {
    push('Infinitiv', word.infinitive?.trim() || word.german);
    push('3. Person Präsens', word.presentThirdPerson?.trim() || '-');
    push('Präteritum', word.simplePast?.trim() || '-');
    push('Partizip II', word.pastParticiple?.trim() || '-');
  } else {
    push('Wort', word.german);
  }

  return fields;
}

/**
 * Normalizes a typed answer for case-insensitive, whitespace-tolerant comparison:
 * trims, collapses internal whitespace, strips a trailing period, lowercases.
 */
export function normalizeAnswer(value: string): string {
  let text = value.trim().replace(/\s+/g, ' ');
  if (text.endsWith('.')) {
    text = text.slice(0, -1).trim();
  }
  return text.toLowerCase();
}