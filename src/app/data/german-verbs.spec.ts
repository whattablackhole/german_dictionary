import {
  GERMAN_VERBS,
  GERMAN_PREFIX_GROUPS,
  extractPrefix,
  isSeparablePrefix,
} from './german-verbs';

describe('german-verbs data module', () => {
  it('contains at least 2000 verbs (including prefixed ones)', () => {
    expect(GERMAN_VERBS.length).toBeGreaterThanOrEqual(2000);
  });

  it('has unique infinitives', () => {
    const seen = new Set<string>();
    for (const verb of GERMAN_VERBS) {
      expect(seen.has(verb.infinitive)).toBe(false);
      seen.add(verb.infinitive);
    }
  });

  it('is sorted by frequencyRank ascending', () => {
    for (let i = 1; i < GERMAN_VERBS.length; i++) {
      expect(GERMAN_VERBS[i].frequencyRank).toBeGreaterThanOrEqual(
        GERMAN_VERBS[i - 1].frequencyRank
      );
    }
  });

  it('contains plain, separable and inseparable verbs', () => {
    const plain = GERMAN_VERBS.filter((v) => !v.prefix);
    const separable = GERMAN_VERBS.filter((v) => v.separable === true);
    const inseparable = GERMAN_VERBS.filter((v) => v.prefix && v.separable === false);

    expect(plain.length).toBeGreaterThan(500);
    expect(separable.length).toBeGreaterThan(100);
    expect(inseparable.length).toBeGreaterThan(50);
  });

  it('includes essential verbs such as sein, machen, verstehen, anfangen', () => {
    const infinitives = new Set(GERMAN_VERBS.map((v) => v.infinitive));
    for (const word of ['sein', 'machen', 'kommen', 'gehen', 'verstehen', 'anfangen']) {
      expect(infinitives.has(word)).toBe(true);
    }
  });

  it('keeps the separable flag consistent with the prefix', () => {
    const knownPrefixes = new Set(GERMAN_PREFIX_GROUPS.map((g) => g.prefix));
    for (const verb of GERMAN_VERBS) {
      if (!verb.prefix) {
        expect(verb.separable).toBeUndefined();
      } else if (knownPrefixes.has(verb.prefix)) {
        expect(typeof verb.separable).toBe('boolean');
      }
      // Rare prefixes outside the standard table (e.g. "übrig") stay unclassified.
    }
  });

  it('has the correct trennbar/untrennbar prefix defaults', () => {
    expect(isSeparablePrefix('an')).toBe(true);
    expect(isSeparablePrefix('auf')).toBe(true);
    expect(isSeparablePrefix('ab')).toBe(true);
    expect(isSeparablePrefix('ver')).toBe(false);
    expect(isSeparablePrefix('be')).toBe(false);
    expect(isSeparablePrefix('er')).toBe(false);
  });

  it('extractPrefix detects prefixed verbs and skips plain ones', () => {
    expect(extractPrefix('anfangen')).toBe('an');
    expect(extractPrefix('abholen')).toBe('ab');
    expect(extractPrefix('verstehen')).toBe('ver');
    expect(extractPrefix('wiederholen')).toBe('wieder');
    expect(extractPrefix('machen')).toBeUndefined();
    // "ge-" is not a real prefix here: the stem "hen" is too short.
    expect(extractPrefix('gehen')).toBeUndefined();
    // "gehören" genuinely is "ge-" + "hören" (inseparable) and must be detected.
    expect(extractPrefix('gehören')).toBe('ge');
  });

  it('exposes every prefix used in the catalog through GERMAN_PREFIX_GROUPS', () => {
    const known = new Set(GERMAN_PREFIX_GROUPS.map((g) => g.prefix));
    // "übrig" is a prefix from the curated list that is not in the standard groups.
    for (const verb of GERMAN_VERBS) {
      expect(verb.prefix === undefined || known.has(verb.prefix) || verb.prefix === 'übrig')
        .toBe(true);
    }
  });
});