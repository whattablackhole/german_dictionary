import { Injectable } from '@angular/core';

const GRAMMAR_TOPICS: string[] = [
  // Cases
  'Nominative case (Nominativ)',
  'Accusative case (Akkusativ)',
  'Dative case (Dativ)',
  'Genitive case (Genitiv)',
  'Two-way prepositions (Wechselpräpositionen)',
  'Prepositions with accusative',
  'Prepositions with dative',
  'Prepositions with genitive',

  // Articles & Nouns
  'Definite articles (der, die, das)',
  'Indefinite articles (ein, eine)',
  'Negative article (kein, keine)',
  'Possessive articles (mein, dein, sein...)',
  'Demonstrative articles (dieser, diese, dieses)',
  'Noun gender',
  'Noun plurals',
  'Compound nouns',
  'Weak nouns (n-Deklination)',
  'Masculine noun declension',

  // Adjectives
  'Adjective declension (strong)',
  'Adjective declension (weak)',
  'Adjective declension (mixed)',
  'Comparative adjectives',
  'Superlative adjectives',
  'Adjectives as nouns',
  'Participial adjectives',
  'Color adjectives',

  // Pronouns
  'Personal pronouns (ich, du, er...)',
  'Reflexive pronouns (mich, mir, sich)',
  'Possessive pronouns (meiner, deiner...)',
  'Demonstrative pronouns (der, die, das as pronoun)',
  'Interrogative pronouns (wer, was, welcher)',
  'Indefinite pronouns (man, jemand, niemand)',
  'Relative pronouns (der, die, das)',
  'Pronominal adverbs (damit, darauf, davon)',
  'Reciprocal pronouns (einander)',

  // Verbs
  'Present tense (Präsens)',
  'Simple past (Präteritum / Imperfekt)',
  'Present perfect (Perfekt)',
  'Past perfect (Plusquamperfekt)',
  'Future tense (Futur I)',
  'Future perfect (Futur II)',
  'Separable prefix verbs',
  'Inseparable prefix verbs',
  'Modal verbs (können, müssen, dürfen...)',
  'Modal verbs in past tense',
  'Modal verbs with double infinitive',
  'Reflexive verbs',
  'Reciprocal verbs',
  'Verbs with fixed prepositions',
  'Verbs with accusative object',
  'Verbs with dative object',
  'Verbs with genitive object',
  'Verbs with two objects (dative + accusative)',
  'Stative passive (Zustandspassiv)',
  'Processual passive (Vorgangspassiv)',
  'Passive with modal verbs',
  'Passive substitute forms (bekommen, gehören)',
  'Imperative mood',
  'Subjunctive I (Konjunktiv I - indirect speech)',
  'Subjunctive II (Konjunktiv II - would/could)',
  'Subjunctive II for polite requests',
  'Subjunctive II for unreal conditions',
  'Infinitive with "zu"',
  'Infinitive without "zu"',
  'Infinitive clauses (um...zu, ohne...zu)',
  'Participles as adjectives',
  'Present participle (Partizip I)',
  'Past participle (Partizip II)',
  'Double infinitive construction',

  // Sentence Structure
  'Word order (main clauses)',
  'Word order (subordinate clauses)',
  'Inverted word order (verb second)',
  'Verb at the end (Nebensatz)',
  'Coordinating conjunctions (und, oder, aber)',
  'Subordinating conjunctions (weil, dass, obwohl)',
  'Two-part conjunctions (nicht nur...sondern auch)',
  'Relative clauses',
  'Indirect questions',
  'Indirect speech',
  'Conditional clauses (wenn, falls)',
  'Causal clauses (weil, da)',
  'Concessive clauses (obwohl, trotzdem)',
  'Final clauses (damit, um...zu)',
  'Temporal clauses (als, wenn, während)',
  'Modal clauses (indem, dadurch...dass)',
  'Consecutive clauses (so...dass, sodass)',
  'Comparative clauses (als, wie, je...desto)',
  'Participle clauses',
  'Extended participial phrases',

  // Numbers & Time
  'Cardinal numbers',
  'Ordinal numbers',
  'Fractions and decimals',
  'Time expressions (Uhrzeit)',
  'Dates (Datum)',
  'Days of the week',
  'Months and seasons',
  'Duration (seit, für, lang)',
  'Frequency adverbs (immer, oft, selten)',
  'Temporal prepositions (an, in, um, vor, nach)',

  // Negation & Questions
  'Negation with "nicht"',
  'Negation with "kein"',
  'Position of "nicht" in sentences',
  'Yes/no questions',
  'W-questions (wer, was, wo, wann, warum)',
  'Tag questions (oder?, nicht wahr?)',

  // Adverbs & Particles
  'Adverbs of manner',
  'Adverbs of place (hier, da, dort)',
  'Adverbs of direction (hin, her)',
  'Modal particles (doch, ja, mal, eben)',
  'Focus particles (nur, sogar, besonders)',
  'Comparison of adverbs',
  'Connecting adverbs (trotzdem, außerdem, jedoch)',

  // Prepositions
  'Local prepositions (in, auf, unter, neben)',
  'Temporal prepositions (vor, nach, während)',
  'Causal prepositions (wegen, aufgrund)',
  'Modal prepositions (mit, ohne, durch)',
  'Prepositional contractions (im, ins, zur, vom)',
  'Postpositions (entlang, gegenüber, zufolge)',

  // Special Topics
  'Da-compounds (davon, darauf, damit)',
  'Wo-compounds (wovon, worauf, womit)',
  'Formal address (Sie) vs informal (du/ihr)',
  'Diminutives (-chen, -lein)',
  'Prefixes and suffixes for nouns',
  'Prefixes for verbs (be-, ent-, er-, ver-, zer-)',
  'Collective nouns',
  'Abstract nouns',
  'Nominalization of verbs and adjectives',
  'False friends (German-English)',
  'Regional variations (Austrian, Swiss German)',
  'Common idioms and fixed expressions',
  'Colloquial contractions (hab ich, kannste)',
  'Punctuation rules',
  'Capitalization rules',
];

@Injectable({ providedIn: 'root' })
export class GrammarTopicService {
  getAllTopics(): string[] {
    return [...GRAMMAR_TOPICS];
  }

  searchTopics(query: string): string[] {
    if (!query.trim()) {
      return GRAMMAR_TOPICS;
    }
    const lower = query.toLowerCase();
    return GRAMMAR_TOPICS.filter((t) => t.toLowerCase().includes(lower));
  }
}