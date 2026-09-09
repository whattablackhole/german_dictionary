import { Word } from '../models/word';
import { buildAnswerFields, normalizeAnswer } from './answer-fields';

function makeWord(overrides: Partial<Word>): Word {
  return {
    id: '1',
    german: 'Haus',
    partOfSpeech: 'noun',
    gender: null,
    translationEn: 'house',
    translationRu: 'дом',
    level: 'A1',
    mastery: 0,
    usageCount: 0,
    createdAt: '2026-08-01T10:00:00.000Z',
    srsInterval: 0,
    srsNextReview: '2026-08-01T10:00:00.000Z',
    srsEase: 2.5,
    srsConsecutiveCorrect: 0,
    ...overrides,
  };
}

describe('buildAnswerFields', () => {
  it('asks for article + word and plural for nouns', () => {
    const fields = buildAnswerFields(
      makeWord({ german: 'Baum', gender: 'der', pluralForm: 'Bäume', pluralFormation: 'umlaut + -e' })
    );
    expect(fields.map((f) => f.label)).toEqual(['Artikel + Wort', 'Plural (oder -)']);
    expect(fields[0].expectedRaw).toBe('der Baum');
    expect(fields[1].expectedRaw).toBe('die Bäume');
  });

  it('expects "-" when the plural is already stored without an article', () => {
    const fields = buildAnswerFields(
      makeWord({ german: 'Milch', gender: 'die', pluralForm: '—', pluralFormation: '-' })
    );
    expect(fields[1].expectedRaw).toBe('-');
  });

  it('expects "-" when the noun has no plural ending (formation "-")', () => {
    const fields = buildAnswerFields(
      makeWord({ german: 'Wasser', gender: 'das', pluralForm: 'Wasser', pluralFormation: '-' })
    );
    expect(fields[1].expectedRaw).toBe('-');
  });

  it('accepts a plural already prefixed with "die "', () => {
    const fields = buildAnswerFields(
      makeWord({ german: 'Auto', gender: 'das', pluralForm: 'die Autos', pluralFormation: '-s' })
    );
    expect(fields[1].expectedRaw).toBe('die Autos');
  });

  it('builds 4 verb form inputs, using "-" for missing forms', () => {
    const fields = buildAnswerFields(
      makeWord({
        german: 'sehen',
        partOfSpeech: 'verb',
        gender: null,
        presentThirdPerson: 'sieht',
        simplePast: 'sah',
        pastParticiple: 'gesehen',
      })
    );
    expect(fields.map((f) => f.label)).toEqual([
      'Infinitiv',
      '3. Person Präsens',
      'Präteritum',
      'Partizip II',
    ]);
    expect(fields.map((f) => f.expectedRaw)).toEqual(['sehen', 'sieht', 'sah', 'gesehen']);
  });

  it('falls back to a single word input for other parts of speech', () => {
    const fields = buildAnswerFields(makeWord({ partOfSpeech: 'adjective', german: 'schnell' }));
    expect(fields).toHaveLength(1);
    expect(fields[0].expectedRaw).toBe('schnell');
  });
});

describe('normalizeAnswer', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizeAnswer('  Der   Baum  ')).toBe('der baum');
  });

  it('strips a trailing period', () => {
    expect(normalizeAnswer('gesehen.')).toBe('gesehen');
  });

  it('accepts case variations of the article', () => {
    expect(normalizeAnswer('DER BAUM') === normalizeAnswer('der Baum')).toBe(true);
  });
});