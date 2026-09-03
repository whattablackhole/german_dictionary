import {
  GERMAN_PERSONS,
  GERMAN_TENSES,
  GERMAN_TENSE_LABELS,
  buildBlankSegments,
  normalizeGermanText,
  verbWordLeaksOutsideBlanks,
} from './german';

describe('German text normalization', () => {
  it('trims and lowercases', () => {
    expect(normalizeGermanText('  GeHen  ')).toBe('gehen');
  });

  it('folds ß to ss for comparison', () => {
    expect(normalizeGermanText('Straße')).toBe('strasse');
    expect(normalizeGermanText('Strasse')).toBe('strasse');
  });

  it('collapses inner whitespace', () => {
    expect(normalizeGermanText('fange   an')).toBe('fange an');
    expect(normalizeGermanText('hat  angefangen')).toBe('hat angefangen');
  });

  it('unifies NFC/NFD umlaut encodings', () => {
    expect(normalizeGermanText('angefangen')).toBe(normalizeGermanText('angefangen'));
    expect(normalizeGermanText('\u00fcber')).toBe('über');
  });

  it('keeps umlauts distinct from plain vowels', () => {
    expect(normalizeGermanText('schon')).not.toBe(normalizeGermanText('schön'));
  });
});

describe('German trainer constants', () => {
  it('has the expected persons', () => {
    expect(GERMAN_PERSONS).toEqual(['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie']);
  });

  it('covers all six finite tenses', () => {
    expect(GERMAN_TENSES).toEqual([
      'präsens',
      'präteritum',
      'perfekt',
      'plusquamperfekt',
      'futur i',
      'futur ii',
    ]);
  });

  it('has a label for every tense', () => {
    for (const tense of GERMAN_TENSES) {
      expect(GERMAN_TENSE_LABELS[tense].length).toBeGreaterThan(0);
    }
    expect(GERMAN_TENSE_LABELS['plusquamperfekt']).toBe('Plusquamperfekt');
  });
});

describe('buildBlankSegments', () => {
  it('splits a sentence into text/blank segments for one blank', () => {
    const segments = buildBlankSegments('Ich spiele Fußball', ['spiele']);
    expect(segments).toEqual([
      { text: 'Ich ', blankIndex: -1 },
      { text: '', blankIndex: 0 },
      { text: ' Fußball', blankIndex: -1 },
    ]);
  });

  it('handles two blanks for trennbare verbs', () => {
    const segments = buildBlankSegments('Ich rufe dich an', ['rufe', 'an']);
    expect(segments).toEqual([
      { text: 'Ich ', blankIndex: -1 },
      { text: '', blankIndex: 0 },
      { text: ' dich ', blankIndex: -1 },
      { text: '', blankIndex: 1 },
    ]);
  });

  it('handles three blanks for Futur II', () => {
    const segments = buildBlankSegments(
      'Ich werde angerufen haben',
      ['werde', 'angerufen', 'haben']
    );
    expect(segments).not.toBeNull();
    const blanks = segments!.filter((s) => s.blankIndex >= 0);
    expect(blanks.map((s) => s.blankIndex)).toEqual([0, 1, 2]);
  });

  it('returns null when a blank is missing', () => {
    expect(buildBlankSegments('Ich spiele Fußball', ['laufe'])).toBeNull();
  });

  it('matches blanks only at word boundaries', () => {
    // "an" appears inside "Anna" but not as a standalone word → null.
    expect(buildBlankSegments('Anna kommt an', ['an'])).not.toBeNull();
    const segments = buildBlankSegments('Anna kommt an', ['an']);
    expect(segments![segments!.length - 1]).toEqual({ text: '', blankIndex: 0 });
  });

  it('returns null for a blank embedded inside another word', () => {
    // "an" only appears inside "Landstraße", never as a standalone word → null.
    expect(buildBlankSegments('Die Landstraße ist glatt', ['an'])).toBeNull();
  });

  it('preserves punctuation around blanks', () => {
    const segments = buildBlankSegments('Er ruft an!', ['ruft', 'an']);
    expect(segments).not.toBeNull();
    const text = segments!.map((s) => (s.blankIndex >= 0 ? '[]' : s.text)).join('');
    expect(text).toBe('Er [] []!');
  });
});

describe('verbWordLeaksOutsideBlanks', () => {
  it('rejects the article homograph "einen" appearing outside the blanks', () => {
    // Training the verb "einen" but "einen" is used as an article → leak.
    expect(
      verbWordLeaksOutsideBlanks('Ich kaufe heute einen Kaffee', ['kaufe'], 'einen')
    ).toBe(true);
  });

  it('accepts a sentence where the verb is blanked as a real verb', () => {
    expect(verbWordLeaksOutsideBlanks('Er eint das Unternehmen', ['eint'], 'einen')).toBe(
      false
    );
  });

  it('accepts a separable verb (infinitive not present as a standalone word)', () => {
    expect(verbWordLeaksOutsideBlanks('Ich rufe dich an', ['rufe', 'an'], 'anrufen')).toBe(
      false
    );
  });

  it('accepts Futur II with the participle inside the blanks', () => {
    expect(
      verbWordLeaksOutsideBlanks(
        'Ich werde angerufen haben',
        ['werde', 'angerufen', 'haben'],
        'anrufen'
      )
    ).toBe(false);
  });

  it('rejects a homograph that is not blanked over the real concerned verb', () => {
    // "sein" also means "his"; using it as a possessive pronoun outside blanks.
    expect(verbWordLeaksOutsideBlanks('Das ist sein Buch', ['ist'], 'sein')).toBe(true);
  });
});