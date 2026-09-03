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

// ── Verb-form matching for AI-generated drills ──────────────────────────────

export interface VerbReferenceForms {
  presentThirdPerson?: string;
  simplePast?: string;
  pastParticiple?: string;
}

/**
 * Fully suppletive paradigms that cannot be derived from the infinitive /
 * reference inflections with generic stem heuristics (supplied forms are
 * recognized verbatim).
 */
const IRREGULAR_VERB_FORM_WHITELIST: Record<string, readonly string[]> = {
  sein: ['bin', 'bist', 'ist', 'sind', 'seid', 'sei', 'seien', 'war', 'warst', 'waren', 'wart', 'gewesen'],
  haben: ['habe', 'hast', 'hat', 'haben', 'habt', 'hatte', 'hattest', 'hatten', 'hattet', 'gehabt'],
  werden: ['werde', 'wirst', 'wird', 'werden', 'werdet', 'wurde', 'wurdest', 'wurden', 'wurdet', 'geworden', 'worden'],
  tun: ['tue', 'tust', 'tut', 'tun', 'tat', 'tatst', 'taten', 'tatet', 'getan'],
};

/**
 * Verbal prefixes stripped when deriving verb-stem candidates. Kept in sync
 * with GERMAN_PREFIX_GROUPS in data/german-verbs.ts; duplicated here so this
 * utility module does not drag the (large) generated verb table into the main
 * bundle. Stripping is order-independent (every prefix is checked separately).
 */
const VERB_PREFIXES: readonly string[] = [
  'zurück',
  'zusammen',
  'vorbei',
  'weiter',
  'wieder',
  'hinter',
  'wider',
  'miss',
  'fehl',
  'fest',
  'durch',
  'unter',
  'über',
  'vor',
  'auf',
  'aus',
  'ein',
  'mit',
  'nach',
  'be',
  'bei',
  'ent',
  'er',
  'ver',
  'zer',
  'um',
  'zu',
  'ab',
  'an',
  'los',
  'weg',
  'her',
  'hin',
  'ge',
];

/** Common grammatical endings stripped when deriving the stem of a verb form. */
const VERB_INFLECTION_ENDINGS = ['est', 'et', 'st', 'en', 'e', 't', 'n'] as const;

/** Strips a trailing inflectional ending, e.g. "wirst" → "wir" or "machte" → "macht". */
function stripVerbalEnding(word: string): string {
  for (const end of VERB_INFLECTION_ENDINGS) {
    if (word.length > end.length + 1 && word.endsWith(end)) {
      return word.slice(0, -end.length);
    }
  }
  return word;
}

/**
 * Vowel-free skeleton ("werden" → "wrdn", "esse" → "ss") so ablaut pairs still
 * cluster ("wurde"/"wird"/"werde" all leave a "wr" skeleton).
 */
function consonantSkeleton(word: string): string {
  return word.replace(/[aeiouäöüy]/gi, '');
}

/**
 * Candidate variants for one verb form: the full word, its stripped stem and
 * the prefix-stripped variants (so "rufe" is recognized as a form of
 * "anrufen" and "angerufen" as a form of "rufen").
 */
function verbFormVariants(word: string): string[] {
  const variants = new Set<string>();
  const clean = word
    .toLowerCase()
    .replace(/[^a-zäöüß]/g, '')
    .normalize('NFC');
  if (!clean) return [];
  variants.add(clean);
  variants.add(stripVerbalEnding(clean));
  for (const prefix of VERB_PREFIXES) {
    if (clean.startsWith(prefix) && clean.length > prefix.length + 3) {
      const rest = clean.slice(prefix.length);
      variants.add(rest);
      variants.add(stripVerbalEnding(rest));
    }
  }
  return [...variants];
}

/** True when two forms plausibly belong to the same German verb paradigm. */
function verbFormsMatch(a: string, b: string): boolean {
  for (const A of verbFormVariants(a)) {
    for (const B of verbFormVariants(b)) {
      if (A === B) return true; // identical word or stem
      const skA = consonantSkeleton(A);
      const skB = consonantSkeleton(B);
      const sk = Math.min(3, skA.length, skB.length);
      // Vowel-agnostic leading consonants tolerate ablaut/umlaut:
      // "werde" ~ "wurde", "esse" ~ "isst", "läuft" ~ "laufen".
      if (sk >= 2 && skA.slice(0, sk) === skB.slice(0, sk)) return true;
      // Short letter prefix catches suppletive tails: "hast"/"hatte" ~ "haben".
      const p = Math.min(3, A.length, B.length);
      if (
        p >= 2 &&
        A.slice(0, p) === B.slice(0, p) &&
        Math.abs(A.length - B.length) <= 2
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Returns true when `blank` looks like a plausible inflected form of the
 * trained German `verb`, using the known reference inflections when available.
 * Conjugated forms rarely contain the infinitive string ("werde"/"wirst"/
 * "wurde"/"geworden" for "werden"), so this family check is what keeps those
 * drills instead of dropping them.
 */
export function isVerbFormLike(
  blank: string,
  verb: string,
  references?: VerbReferenceForms
): boolean {
  const b = blank.trim().toLowerCase();
  if (!b) return false;
  const v = verb.trim().toLowerCase();
  if (!v) return false;

  const whitelisted = IRREGULAR_VERB_FORM_WHITELIST[v];
  if (whitelisted?.includes(b)) return true;

  const known = [
    v,
    references?.presentThirdPerson,
    references?.simplePast,
    references?.pastParticiple,
  ]
    .filter((f): f is string => !!f)
    .join(' ')
    .toLowerCase()
    .split(/\s+/);

  return known.some((form) => verbFormsMatch(form, b));
}

/**
 * Cleans an AI-provided reference translation so it reads as a complete
 * sentence. Removes cloze placeholders ("___", "_____"), collapses runs of
 * whitespace around them and trims the result — a safety net for the case
 * where a model still marks the blanked verb instead of spelling it out.
 */
export function cleanReferenceText(text: string): string {
  return text
    .replace(/_+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
