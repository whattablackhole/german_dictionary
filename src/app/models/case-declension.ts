import { GermanCase } from './preposition-rule';

// ── TYPES ──

export type DeclensionGender = 'masculine' | 'feminine' | 'neuter';
export type DeclensionNumber = 'singular' | 'plural';
export type ArticleType =
  | 'definite'
  | 'indefinite'
  | 'negative'
  | 'possessive'
  | 'demonstrative';
export type DeclensionType = 'strong' | 'weak' | 'mixed';
export type DeclensionQuestionType = 'article' | 'adjective' | 'noun' | 'phrase';

export interface DeclensionQuestion {
  id: string;
  type: DeclensionQuestionType;
  prompt: string;
  correctAnswer: string;
  options: string[];
  caseReq: GermanCase;
  gender: DeclensionGender | 'plural';
  number: DeclensionNumber;
  articleType?: ArticleType;
  declensionType?: DeclensionType;
  contextSentence?: string;
  contextSentenceRu?: string;
  explanation: string;
  nounBase?: string;
}

// ── ARTICLE DECLENSION TABLES ──

export const DEFINITE_ARTICLES: Record<GermanCase, Record<DeclensionGender | 'plural', string>> = {
  nominative: { masculine: 'der', feminine: 'die', neuter: 'das', plural: 'die' },
  accusative: { masculine: 'den', feminine: 'die', neuter: 'das', plural: 'die' },
  dative: { masculine: 'dem', feminine: 'der', neuter: 'dem', plural: 'den' },
  genitive: { masculine: 'des', feminine: 'der', neuter: 'des', plural: 'der' },
};

export const EIN_WORD_ENDINGS: Record<GermanCase, Record<DeclensionGender | 'plural', string>> = {
  nominative: { masculine: '', feminine: 'e', neuter: '', plural: 'e' },
  accusative: { masculine: 'en', feminine: 'e', neuter: '', plural: 'e' },
  dative: { masculine: 'em', feminine: 'er', neuter: 'em', plural: 'en' },
  genitive: { masculine: 'es', feminine: 'er', neuter: 'es', plural: 'er' },
};

export const DIES_WORD_ENDINGS: Record<GermanCase, Record<DeclensionGender | 'plural', string>> = {
  nominative: { masculine: 'er', feminine: 'e', neuter: 'es', plural: 'e' },
  accusative: { masculine: 'en', feminine: 'e', neuter: 'es', plural: 'e' },
  dative: { masculine: 'em', feminine: 'er', neuter: 'em', plural: 'en' },
  genitive: { masculine: 'es', feminine: 'er', neuter: 'es', plural: 'er' },
};

export const ARTICLE_TABLE: Record<ArticleType, Record<GermanCase, Record<DeclensionGender | 'plural', string>>> = {
  definite: DEFINITE_ARTICLES,
  indefinite: EIN_WORD_ENDINGS,
  negative: EIN_WORD_ENDINGS,
  possessive: EIN_WORD_ENDINGS,
  demonstrative: DIES_WORD_ENDINGS,
};

// ── ADJECTIVE DECLENSION TABLES ──

export const STRONG_ADJECTIVE_ENDINGS: Record<GermanCase, Record<DeclensionGender | 'plural', string>> = {
  nominative: { masculine: 'er', feminine: 'e', neuter: 'es', plural: 'e' },
  accusative: { masculine: 'en', feminine: 'e', neuter: 'es', plural: 'e' },
  dative: { masculine: 'em', feminine: 'er', neuter: 'em', plural: 'en' },
  genitive: { masculine: 'en', feminine: 'er', neuter: 'en', plural: 'er' },
};

export const WEAK_ADJECTIVE_ENDINGS: Record<GermanCase, Record<DeclensionGender | 'plural', string>> = {
  nominative: { masculine: 'e', feminine: 'e', neuter: 'e', plural: 'en' },
  accusative: { masculine: 'en', feminine: 'e', neuter: 'e', plural: 'en' },
  dative: { masculine: 'en', feminine: 'en', neuter: 'en', plural: 'en' },
  genitive: { masculine: 'en', feminine: 'en', neuter: 'en', plural: 'en' },
};

export const MIXED_ADJECTIVE_ENDINGS: Record<GermanCase, Record<DeclensionGender | 'plural', string>> = {
  nominative: { masculine: 'er', feminine: 'e', neuter: 'es', plural: 'en' },
  accusative: { masculine: 'en', feminine: 'e', neuter: 'es', plural: 'en' },
  dative: { masculine: 'en', feminine: 'en', neuter: 'en', plural: 'en' },
  genitive: { masculine: 'en', feminine: 'en', neuter: 'en', plural: 'en' },
};

export const ADJECTIVE_TABLE: Record<DeclensionType, Record<GermanCase, Record<DeclensionGender | 'plural', string>>> = {
  strong: STRONG_ADJECTIVE_ENDINGS,
  weak: WEAK_ADJECTIVE_ENDINGS,
  mixed: MIXED_ADJECTIVE_ENDINGS,
};

// ── EXAMPLE ADJECTIVES ──

export interface AdjectiveExample {
  base: string;
  translationEn: string;
  translationRu: string;
}

export const EXAMPLE_ADJECTIVES: AdjectiveExample[] = [
  { base: 'groß', translationEn: 'big', translationRu: 'большой' },
  { base: 'schön', translationEn: 'beautiful', translationRu: 'красивый' },
  { base: 'neu', translationEn: 'new', translationRu: 'новый' },
  { base: 'klein', translationEn: 'small', translationRu: 'маленький' },
  { base: 'alt', translationEn: 'old', translationRu: 'старый' },
  { base: 'gut', translationEn: 'good', translationRu: 'хороший' },
  { base: 'jung', translationEn: 'young', translationRu: 'молодой' },
  { base: 'teuer', translationEn: 'expensive', translationRu: 'дорогой' },
  { base: 'schnell', translationEn: 'fast', translationRu: 'быстрый' },
  { base: 'wichtig', translationEn: 'important', translationRu: 'важный' },
];

// ── EXAMPLE NOUNS ──

export interface NounExample {
  noun: string;
  article: 'der' | 'die' | 'das';
  plural: string;
  genitiveSg?: string;
  nDeklination?: boolean;
  translationEn: string;
  translationRu: string;
}

export const EXAMPLE_NOUNS: NounExample[] = [
  { noun: 'Hund', article: 'der', plural: 'Hunde', genitiveSg: 'es', translationEn: 'dog', translationRu: 'собака' },
  { noun: 'Tisch', article: 'der', plural: 'Tische', genitiveSg: 'es', translationEn: 'table', translationRu: 'стол' },
  { noun: 'Mann', article: 'der', plural: 'Männer', genitiveSg: 'es', translationEn: 'man', translationRu: 'мужчина' },
  { noun: 'Baum', article: 'der', plural: 'Bäume', genitiveSg: 'es', translationEn: 'tree', translationRu: 'дерево' },
  { noun: 'Apfel', article: 'der', plural: 'Äpfel', genitiveSg: 's', translationEn: 'apple', translationRu: 'яблоко' },
  { noun: 'Lehrer', article: 'der', plural: 'Lehrer', genitiveSg: 's', translationEn: 'teacher', translationRu: 'учитель' },
  { noun: 'Student', article: 'der', plural: 'Studenten', genitiveSg: 'en', nDeklination: true, translationEn: 'student', translationRu: 'студент' },
  { noun: 'Herr', article: 'der', plural: 'Herren', genitiveSg: 'n', nDeklination: true, translationEn: 'gentleman', translationRu: 'господин' },
  { noun: 'Junge', article: 'der', plural: 'Jungen', genitiveSg: 'n', nDeklination: true, translationEn: 'boy', translationRu: 'мальчик' },
  { noun: 'Mensch', article: 'der', plural: 'Menschen', genitiveSg: 'en', nDeklination: true, translationEn: 'person', translationRu: 'человек' },
  { noun: 'Kollege', article: 'der', plural: 'Kollegen', genitiveSg: 'n', nDeklination: true, translationEn: 'colleague', translationRu: 'коллега' },
  { noun: 'Name', article: 'der', plural: 'Namen', genitiveSg: 'ns', nDeklination: true, translationEn: 'name', translationRu: 'имя' },
  { noun: 'Frau', article: 'die', plural: 'Frauen', genitiveSg: '', translationEn: 'woman', translationRu: 'женщина' },
  { noun: 'Katze', article: 'die', plural: 'Katzen', genitiveSg: '', translationEn: 'cat', translationRu: 'кошка' },
  { noun: 'Blume', article: 'die', plural: 'Blumen', genitiveSg: '', translationEn: 'flower', translationRu: 'цветок' },
  { noun: 'Stadt', article: 'die', plural: 'Städte', genitiveSg: '', translationEn: 'city', translationRu: 'город' },
  { noun: 'Schule', article: 'die', plural: 'Schulen', genitiveSg: '', translationEn: 'school', translationRu: 'школа' },
  { noun: 'Sprache', article: 'die', plural: 'Sprachen', genitiveSg: '', translationEn: 'language', translationRu: 'язык' },
  { noun: 'Kind', article: 'das', plural: 'Kinder', genitiveSg: 'es', translationEn: 'child', translationRu: 'ребёнок' },
  { noun: 'Haus', article: 'das', plural: 'Häuser', genitiveSg: 'es', translationEn: 'house', translationRu: 'дом' },
  { noun: 'Buch', article: 'das', plural: 'Bücher', genitiveSg: 'es', translationEn: 'book', translationRu: 'книга' },
  { noun: 'Auto', article: 'das', plural: 'Autos', genitiveSg: 's', translationEn: 'car', translationRu: 'автомобиль' },
  { noun: 'Mädchen', article: 'das', plural: 'Mädchen', genitiveSg: 's', translationEn: 'girl', translationRu: 'девочка' },
  { noun: 'Zimmer', article: 'das', plural: 'Zimmer', genitiveSg: 's', translationEn: 'room', translationRu: 'комната' },
];

// ── CONSTANTS ──

export const CASE_LABELS_SHORT: Record<GermanCase, string> = {
  nominative: 'Nominativ', accusative: 'Akkusativ', dative: 'Dativ', genitive: 'Genitiv',
};

export const CASE_ORDER: GermanCase[] = ['nominative', 'accusative', 'dative', 'genitive'];

export const GENDER_ORDER: (DeclensionGender | 'plural')[] = ['masculine', 'feminine', 'neuter', 'plural'];

export const GENDER_LABELS: Record<DeclensionGender | 'plural', string> = {
  masculine: 'Maskulin', feminine: 'Feminin', neuter: 'Neutrum', plural: 'Plural',
};

export const CASE_QUESTIONS_RU: Record<GermanCase, string> = {
  nominative: 'кто? что?', accusative: 'кого? что? (вижу)', dative: 'кому? чему?', genitive: 'кого? чего? (чей?)',
};

export const CASE_GAP_NOTES: Record<GermanCase, string> = {
  nominative: 'Nominativ = the subject. In Russian: «кто? что?». Articles: der/die/das. This is the dictionary form.',
  accusative: 'Akkusativ = direct object. In Russian: «кого? что?» (вижу кого? что?). Only masculine changes: der → den, ein → einen.',
  dative: 'Dativ = indirect object / recipient. In Russian: «кому? чему?» (даю кому?). der → dem, die → der, das → dem.',
  genitive: 'Genitiv = possession. In Russian: «чей? кого? чего?». Masculine & neuter add -s/-es to the noun: des Hundes.',
};