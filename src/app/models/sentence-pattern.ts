import { SeparableVerbData, SEPARABLE_VERBS } from '../data/separable-verbs';

export interface SentencePattern {
  id: string;
  name: string;
  level: number; // 1-12 progression
  description: string;
  wordOrderDiagram: string; // visual diagram like "Subject + Verb + Object"
  examples: string[]; // example sentences
  tips: string; // explanation of the grammar rule
  keywords: string[]; // frequently used words for this pattern (weil, dass, etc.)
  /** Optional list of separable verbs to display in the tips section */
  separableVerbs?: SeparableVerbData[];
}

export interface PatternSubmission {
  id: string;
  timestamp: number;
  sentence: string;
  feedback: SentenceFeedback;
}

export interface SentenceFeedback {
  patternCorrect: boolean;
  patternErrors: string[];
  vocabCorrect: boolean;
  unknownWords: string[];
  tips: string[];
  masteryDelta: number; // -10 to +10
}

export interface PatternHistory {
  patternId: string;
  mastery: number; // 0-100
  submissions: PatternSubmission[];
}

export const SENTENCE_PATTERNS: SentencePattern[] = [
  {
    id: 'main-clause',
    name: 'Main Clause (Subject + Verb + Object)',
    level: 1,
    description: 'The basic German sentence structure — verb is always in position 2.',
    wordOrderDiagram: 'Subject + Verb + Object/Adverb',
    tips: 'In a main clause, the conjugated verb ALWAYS goes in the second position. The subject can be first, but the verb must be second. Time expressions often come before objects.',
    examples: [
      'Der Hund frisst das Brot.',
      'Ich gehe morgen in die Schule.',
      'Meine Katze schläft auf dem Sofa.',
    ],
    keywords: ['der', 'die', 'das', 'ein', 'eine', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'sie', 'Sie', 'und'],
  },
  {
    id: 'modal-verbs',
    name: 'Modal Verbs (können, müssen, dürfen...)',
    level: 2,
    description: 'Modal verb in position 2, main verb in infinitive form at the end of the sentence.',
    wordOrderDiagram: 'Subject + ModalVerb + Object(s) + MainVerb(Infinitiv)',
    tips: 'The modal verb is conjugated and in position 2. The main verb stays in infinitive form and goes to the VERY END of the sentence. Common modals: können (can), müssen (must), dürfen (may), wollen (want), sollen (should), mögen (like).',
    examples: [
      'Ich kann den Hund sehen.',
      'Du musst morgen in die Schule gehen.',
      'Wir dürfen hier nicht essen.',
    ],
    keywords: ['können', 'müssen', 'dürfen', 'wollen', 'sollen', 'mögen', 'nicht', 'auch'],
  },
  {
    id: 'separable-verbs',
    name: 'Separable Prefix Verbs (anrufen, aufwachen...)',
    level: 3,
    description: 'The prefix separates and goes to the end of the sentence in present tense.',
    wordOrderDiagram: 'Subject + Verb(present) + Object(s) + Prefix',
    tips: 'Many German verbs have separable prefixes (auf-, an-, mit-, nach-, vor-, zu-, etc.). In present tense, the prefix goes to the VERY END. Remember: the "ge-" in past participle goes between the prefix and the stem (e.g. "aufgewacht").',
    examples: [
      'Ich wache um 7 Uhr auf.',
      'Er ruft seine Mutter an.',
      'Wir kommen morgen mit.',
    ],
    keywords: ['aufwachen', 'anrufen', 'mitkommen', 'aufräumen', 'einkaufen', 'ausgehen', 'vorhaben', 'anfangen'],
    separableVerbs: SEPARABLE_VERBS,
  },
  {
    id: 'coordinating-conjunctions',
    name: 'Coordinating Conjunctions (und, oder, aber, sondern, denn)',
    level: 4,
    description: 'Connect two main clauses. The word order stays the same after the conjunction.',
    wordOrderDiagram: 'MainClause + Conjunction + MainClause (same word order)',
    tips: 'Coordinating conjunctions do NOT change word order. Both clauses have normal main clause structure (verb in position 2). "Aber" = but (contrast), "denn" = because (reason), "oder" = or, "sondern" = but rather (after negation).',
    examples: [
      'Ich habe einen Hund, aber keine Katze.',
      'Er geht nach Hause, denn er ist müde.',
      'Ich kaufe nicht das Brot, sondern den Kuchen.',
    ],
    keywords: ['und', 'oder', 'aber', 'sondern', 'denn', 'auch', 'nicht', 'kein'],
  },
  {
    id: 'weil-da',
    name: '"weil" and "da" — Verb at the End',
    level: 5,
    description: 'Subordinating conjunctions send the conjugated verb to the END of the clause.',
    wordOrderDiagram: 'MainClause + [weil/da + Subject + Object(s) + Verb(END)]',
    tips: '"weil" and "da" are subordinating conjunctions. They push the conjugated verb to the VERY END of their clause. "da" is more formal, "weil" is more common in spoken German. When the subordinate clause comes first: "Weil es regnet, bleibe ich zu Hause." (verb in position 2 in main clause!)',
    examples: [
      'Ich bleibe zu Hause, weil es regnet.',
      'Da ich müde bin, gehe ich früh ins Bett.',
      'Er lernt Deutsch, weil er in Berlin wohnt.',
    ],
    keywords: ['weil', 'da', 'deshalb', 'darum', 'denn', 'müde', 'denn'],
  },
  {
    id: 'dass',
    name: '"dass" — That-Clauses (Verb at End)',
    level: 6,
    description: '"dass" introduces a subordinate clause. The verb goes to the end.',
    wordOrderDiagram: 'MainClause + [dass + Subject + Object(s) + Verb(END)]',
    tips: '"dass" = "that". It always sends the conjugated verb to the end. Common verbs that introduce "dass": wissen (to know), denken (to think), glauben (to believe), sagen (to say), hoffen (to hope).',
    examples: [
      'Ich weiß, dass der Hund frisst.',
      'Er sagt, dass er morgen kommt.',
      'Ich glaube, dass das Wetter schön ist.',
    ],
    keywords: ['dass', 'wissen', 'denken', 'glauben', 'sagen', 'hoffen', 'finden'],
  },
  {
    id: 'wenn-falls',
    name: '"wenn" and "falls" — Conditional Clauses',
    level: 7,
    description: '"wenn/falls" introduce conditional subordinate clauses. Verb goes to end.',
    wordOrderDiagram: '[Wenn/Falls + Subject + Object(s) + Verb(END)] + MainClause(verb in position 2)',
    tips: '"wenn" = when/if (conditional), "falls" = in case. When the "wenn" clause comes FIRST, the main clause starts with the verb (position 2)! Example: "Wenn es regnet, bleibe ich zu Hause." NOT: "Wenn es regnet, ich bleibe zu Hause."',
    examples: [
      'Wenn es regnet, bleibe ich zu Hause.',
      'Ich komme, wenn ich Zeit habe.',
      'Falls du Hilfe brauchst, ruf mich an.',
    ],
    keywords: ['wenn', 'falls', 'dann', 'sonst', 'oder'],
  },
  {
    id: 'modal-subordinate',
    name: 'Modal Verbs in Subordinate Clauses',
    level: 8,
    description: 'Two verbs at the end: modal in infinitive + main verb in infinitive.',
    wordOrderDiagram: 'MainClause + [weil/dass/wenn + Subject + Object(s) + MainVerb(Inf) + ModalVerb(Inf)]',
    tips: 'When you combine a modal verb with a subordinate clause, BOTH verbs go to the end in infinitive form. The main verb comes BEFORE the modal. This is called the "double infinitive" construction.',
    examples: [
      'Ich kann nicht kommen, weil ich arbeiten muss.',
      'Er sagt, dass er das Buch lesen kann.',
      'Wenn du morgen kommen kannst, freue ich mich.',
    ],
    keywords: ['können', 'müssen', 'dürfen', 'wollen', 'sollen', 'mögen', 'weil', 'dass', 'wenn'],
  },
  {
    id: 'relative-clauses',
    name: 'Relative Clauses (der, die, das)',
    level: 9,
    description: 'Relative pronouns introduce additional information about a noun. Verb goes to end.',
    wordOrderDiagram: 'Noun + [RelativePronoun(der/die/das) + Object(s) + Verb(END)]',
    tips: 'The relative pronoun matches the gender/number of the noun it refers to. The verb in the relative clause goes to the END. "der" for masculine, "die" for feminine/plural, "das" for neuter. In dative: "dem", "der", "dem". In accusative: "den", "die", "das".',
    examples: [
      'Der Hund, der braun ist, frisst das Brot.',
      'Das Haus, das am Ende der Straße ist, ist alt.',
      'Die Frau, die in Berlin wohnt, kommt morgen.',
    ],
    keywords: ['der', 'die', 'das', 'den', 'dem', 'welcher', 'welche', 'welches'],
  },
  {
    id: 'um-zu',
    name: '"um...zu" — Purpose Clauses',
    level: 10,
    description: '"um...zu" expresses purpose ("in order to"). Verb in infinitive at the end.',
    wordOrderDiagram: 'MainClause + [um + Object(s) + zu + Verb(Infinitiv)]',
    tips: '"um...zu" = "in order to". The subject of the main clause and the purpose clause must be the same! "Ich gehe in den Supermarkt, um Brot zu kaufen." NOT: "um das Brot kaufen" (wrong — "zu" goes before the infinitive).',
    examples: [
      'Ich gehe in die Stadt, um Brot zu kaufen.',
      'Er lernt Deutsch, um in Berlin zu arbeiten.',
      'Wir fahren nach Hause, um zu schlafen.',
    ],
    keywords: ['um', 'zu', 'damit', 'weil', 'denn'],
  },
  {
    id: 'adjective-declension',
    name: 'Adjective Declension (der große Hund, ein großer Hund)',
    level: 11,
    description: 'Adjectives before nouns change their endings based on gender, case, and article type.',
    wordOrderDiagram: 'Article + Adjective(declined) + Noun (with matching gender/case)',
    tips: 'Three declension patterns: (1) After "der/die/das" — weak endings (-e, -en). (2) After "ein/kein/mein" — mixed endings (combines strong + weak). (3) No article — strong endings (match the article endings). Nominative masculine: der große Hund / ein großer Hund. Accusative masculine: den großen Hund / einen großen Hund.',
    examples: [
      'Der große Hund frisst das kleine Brot.',
      'Ich sehe einen schönen Garten.',
      'Mit meiner neuen Freundin gehe ich ins Kino.',
    ],
    keywords: ['groß', 'klein', 'schön', 'neu', 'alt', 'gut', 'schlecht', 'schnell', 'langsam', 'teuer', 'billig'],
  },
  {
    id: 'passive',
    name: 'Passive Voice (werden + Partizip II)',
    level: 12,
    description: 'The passive voice emphasizes the action, not who does it. "werden" + past participle.',
    wordOrderDiagram: 'Object(wird Nominative) + werden(conjugated) + (von + Agent) + Partizip II',
    tips: 'Processual passive (Vorgangspassiv): "Das Brot wird gegessen." — focuses on the action. "werden" is conjugated, past participle stays at the end. "von" + dative = by whom. Stative passive (Zustandspassiv): "Das Brot ist gegessen." — focuses on the result/state.',
    examples: [
      'Das Brot wird gegessen.',
      'Das Haus wird von meinem Vater gebaut.',
      'Die Tür ist geschlossen.',
    ],
    keywords: ['werden', 'wurde', 'worden', 'von', 'durch', 'geöffnet', 'geschlossen', 'gemacht', 'gesehen'],
  },
];