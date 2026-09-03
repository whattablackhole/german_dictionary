/**
 * Normalizes German text for safe comparisons in language exercises:
 * trims, lowercases, collapses inner whitespace, folds ß → ss and
 * NFC-normalizes umlauts. Strings that differ only in these aspects
 * compare as equal.
 */
export function normalizeGermanText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\u00df/g, 'ss')
    .normalize('NFC');
}

/** Standard German conjugation persons used by the verb trainer. */
export const GERMAN_PERSONS = [
  'ich',
  'du',
  'er/sie/es',
  'wir',
  'ihr',
  'sie',
] as const;

/** All finite tenses covered by the verb trainer. */
export const GERMAN_TENSES = [
  'präsens',
  'präteritum',
  'perfekt',
  'plusquamperfekt',
  'futur i',
  'futur ii',
] as const;

export type GermanPerson = (typeof GERMAN_PERSONS)[number];
export type GermanTense = (typeof GERMAN_TENSES)[number];

/** Human-readable labels for the tense chips. */
export const GERMAN_TENSE_LABELS: Record<GermanTense, string> = {
  präsens: 'Präsens',
  präteritum: 'Präteritum',
  perfekt: 'Perfekt',
  plusquamperfekt: 'Plusquamperfekt',
  'futur i': 'Futur I',
  'futur ii': 'Futur II',
};

export interface BlankSegment {
  /** Literal sentence text before/between/after blanks (may be empty). */
  text: string;
  /** 0-based index into the blanks array, or -1 for plain text. */
  blankIndex: number;
}

/**
 * Finds `blank` in `rest` starting at `from`, only at word boundaries
 * (not preceded/followed by a letter or digit). Returns the index or -1.
 */
function findBlankAtWordBoundary(
  rest: string,
  from: number,
  blank: string
): number {
  let idx = from;
  while (idx !== -1) {
    idx = rest.indexOf(blank, idx);
    if (idx === -1) break;
    const before = idx === 0 ? '' : rest[idx - 1];
    const after =
      idx + blank.length < rest.length ? rest[idx + blank.length] : '';
    if (!/[a-zäöüß0-9]/i.test(before) && !/[a-zäöüß0-9]/i.test(after)) {
      return idx;
    }
    idx += 1;
  }
  return -1;
}

/**
 * Splits a sentence into alternating text/blank segments. Each blank is
 * matched word-by-word in order and only at word boundaries (so the blank
 * "an" never matches inside "Anna" or "Fahrbahn"). Returns null when any
 * blank cannot be located — such a sentence is rejected by the caller.
 */
export function buildBlankSegments(
  sentence: string,
  blanks: string[]
): BlankSegment[] | null {
  const segments: BlankSegment[] = [];
  let pos = 0;

  for (let i = 0; i < blanks.length; i++) {
    const blank = blanks[i];
    if (!blank) return null;
    const idx = findBlankAtWordBoundary(sentence, pos, blank);
    if (idx === -1) return null;

    if (idx > pos) {
      segments.push({ text: sentence.slice(pos, idx), blankIndex: -1 });
    }
    segments.push({ text: '', blankIndex: i });
    pos = idx + blank.length;
  }

  if (pos < sentence.length) {
    segments.push({ text: sentence.slice(pos), blankIndex: -1 });
  }
  return segments;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns true when `infinitive` occurs in `sentence` as a standalone word at
 * a position that is NOT covered by one of the `blanks`. This rejects AI
 * sentences where a homograph of the trained verb sneaks in outside the blanks
 * (e.g. the article "einen" in "Ich kaufe einen Kaffee" while training the
 * verb "einen") — the trained infinitive must only ever appear inside blanks.
 */
export function verbWordLeaksOutsideBlanks(
  sentence: string,
  blanks: string[],
  infinitive: string
): boolean {
  const lower = sentence.toLowerCase();
  const target = infinitive.toLowerCase();
  const segments = buildBlankSegments(
    lower,
    blanks.map((b) => b.toLowerCase())
  );
  // Blanks not found → sentence is already unusable, treat it as a leak.
  if (!segments) return true;

  let masked = '';
  for (const seg of segments) {
    if (seg.blankIndex >= 0) {
      masked += ' '.repeat(blanks[seg.blankIndex].length);
    } else {
      masked += seg.text;
    }
  }

  const re = new RegExp(
    `(^|[^a-zäöüß])${escapeRegExp(target)}(?=$|[^a-zäöüß])`
  );
  return re.test(masked);
}