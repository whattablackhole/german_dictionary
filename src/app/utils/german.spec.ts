import {
  GERMAN_PERSONS,
  GERMAN_TENSES,
  GERMAN_TENSE_LABELS,
  buildBlankSegments,
  isVerbFormLike,
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

describe('sentence-drill validation for "werden" (regression)', () => {
  const refs = {
    presentThirdPerson: 'wird',
    simplePast: 'wurde',
    pastParticiple: 'geworden',
  };

  // The exact 8 drills the AI returned for "werden" before the bug was fixed
  // (only "Sie werden … werden" used to survive, everything else was dropped).
  const drills: { fullSentence: string; blankWords: string[] }[] = [
    { fullSentence: 'Ich werde nach dem langen Arbeitstag langsam müde.', blankWords: ['werde'] },
    { fullSentence: 'Du wirst nach dem Training richtig hungrig.', blankWords: ['wirst'] },
    { fullSentence: 'Er wurde vor dem Gespräch plötzlich sehr nervös.', blankWords: ['wurde'] },
    { fullSentence: 'Wir sind nach dem Umzug gute Nachbarn geworden.', blankWords: ['sind', 'geworden'] },
    { fullSentence: 'Es ist nach dem Regen wieder hell geworden.', blankWords: ['ist', 'geworden'] },
    { fullSentence: 'Ihr wart nach der Wanderung ein richtig gutes Team geworden.', blankWords: ['wart', 'geworden'] },
    { fullSentence: 'Sie werden bald viel selbstständiger werden.', blankWords: ['werden', 'werden'] },
    { fullSentence: 'Bis zum Sommer werde ich viel selbstständiger geworden sein.', blankWords: ['werde', 'geworden', 'sein'] },
  ];

  for (const d of drills) {
    it(`keeps the drill "${d.fullSentence}"`, () => {
      expect(buildBlankSegments(d.fullSentence, d.blankWords)).not.toBeNull();
      expect(
        d.blankWords.some((w) => isVerbFormLike(w, 'werden', refs))
      ).toBe(true);
      expect(verbWordLeaksOutsideBlanks(d.fullSentence, d.blankWords, 'werden')).toBe(
        false
      );
    });
  }
});

describe('isVerbFormLike', () => {
  const werdenRefs = {
    presentThirdPerson: 'wird',
    simplePast: 'wurde',
    pastParticiple: 'geworden',
  };

  it('accepts inflected forms that do not contain the infinitive (the "werden" case)', () => {
    expect(isVerbFormLike('werde', 'werden', werdenRefs)).toBe(true);
    expect(isVerbFormLike('wirst', 'werden', werdenRefs)).toBe(true);
    expect(isVerbFormLike('wurde', 'werden', werdenRefs)).toBe(true);
    expect(isVerbFormLike('geworden', 'werden', werdenRefs)).toBe(true);
    expect(isVerbFormLike('werden', 'werden', werdenRefs)).toBe(true);
  });

  it('accepts regularly conjugated forms without any reference inflections', () => {
    expect(isVerbFormLike('mache', 'machen')).toBe(true);
    expect(isVerbFormLike('machst', 'machen')).toBe(true);
    expect(isVerbFormLike('macht', 'machen')).toBe(true);
    expect(isVerbFormLike('machte', 'machen')).toBe(true);
    expect(isVerbFormLike('gemacht', 'machen')).toBe(true);
  });

  it('accepts ablaut/umlaut changes in Present and Präteritum', () => {
    expect(
      isVerbFormLike('esse', 'essen', {
        presentThirdPerson: 'isst',
        simplePast: 'aß',
        pastParticiple: 'gegessen',
      })
    ).toBe(true);
    expect(
      isVerbFormLike('läuft', 'laufen', {
        presentThirdPerson: 'läuft',
        simplePast: 'lief',
        pastParticiple: 'gelaufen',
      })
    ).toBe(true);
  });

  it('accepts the separated parts and the participle of trennbare verbs', () => {
    const refs = {
      presentThirdPerson: 'ruft an',
      simplePast: 'rief an',
      pastParticiple: 'angerufen',
    };
    expect(isVerbFormLike('rufe', 'anrufen', refs)).toBe(true);
    expect(isVerbFormLike('an', 'anrufen', refs)).toBe(true);
    expect(isVerbFormLike('rief', 'anrufen', refs)).toBe(true);
    expect(isVerbFormLike('angerufen', 'anrufen', refs)).toBe(true);
  });

  it('accepts suppletive forms of the fully irregular verbs', () => {
    const seinRefs = {
      presentThirdPerson: 'ist',
      simplePast: 'war',
      pastParticiple: 'gewesen',
    };
    expect(isVerbFormLike('bin', 'sein', seinRefs)).toBe(true);
    expect(isVerbFormLike('sind', 'sein', seinRefs)).toBe(true);
    expect(isVerbFormLike('war', 'sein', seinRefs)).toBe(true);
    expect(isVerbFormLike('hast', 'haben')).toBe(true);
    expect(isVerbFormLike('hatte', 'haben')).toBe(true);
  });

  it('rejects a sein-auxiliary blank on its own (the participle carries the drill)', () => {
    expect(isVerbFormLike('ist', 'werden', werdenRefs)).toBe(false);
    expect(isVerbFormLike('sind', 'werden', werdenRefs)).toBe(false);
  });

  it('rejects blanks belonging to a different verb or a non-verb word', () => {
    expect(isVerbFormLike('gehe', 'werden', werdenRefs)).toBe(false);
    expect(isVerbFormLike('kaufe', 'laufen')).toBe(false);
    expect(isVerbFormLike('müde', 'werden', werdenRefs)).toBe(false);
    expect(isVerbFormLike('', 'werden', werdenRefs)).toBe(false);
  });
});