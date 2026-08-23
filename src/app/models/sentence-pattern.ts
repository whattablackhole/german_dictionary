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
  {
    id: 'perfekt',
    name: 'Perfekt (Present Perfect — haben/sein + Partizip II)',
    level: 13,
    description: 'The most common past tense in spoken German. Auxiliary verb "haben"/"sein" + past participle at the end.',
    wordOrderDiagram: 'Subject + haben/sein(conjugated) + Object(s) + Partizip II(END)',
    tips: 'In a main clause the auxiliary "haben" or "sein" is in position 2, and the past participle goes to the VERY END. Most verbs use "haben". Verbs of motion or change of state use "sein" (gehen, fahren, kommen, bleiben, sterben). "Ich bin gegangen" (not "ich habe gegangen"!).',
    examples: [
      'Ich habe den Hund gesehen.',
      'Wir sind gestern in die Stadt gegangen.',
      'Sie hat das Buch gekauft.',
    ],
    keywords: ['haben', 'sein', 'gegangen', 'gesehen', 'gekauft', 'gemacht', 'gegessen', 'gekommen', 'gefahren'],
  },
  {
    id: 'praeteritum',
    name: 'Präteritum (Simple Past)',
    level: 14,
    description: 'The narrative past tense, used mostly in writing and with the verbs sein, haben and the modal verbs.',
    wordOrderDiagram: 'Subject + Verb(past) + Object/Adverb',
    tips: 'The Präteritum is the past tense of written German (stories, news). In speech it is mostly used only for "sein", "haben" and modal verbs: Ich war, ich hatte, ich konnte. Regular weak verbs add "-te": machte. Strong verbs change their vowel: Ich ging, ich sah.',
    examples: [
      'Ich war gestern im Kino.',
      'Er hatte einen guten Tag.',
      'Wir gingen jeden Tag in die Schule.',
    ],
    keywords: ['war', 'hatte', 'ging', 'sah', 'konnte', 'musste', 'wollte', 'machte', 'lernte'],
  },
  {
    id: 'futur',
    name: 'Future Tense (werden + Infinitiv)',
    level: 15,
    description: 'Expresses future actions. "werden" is conjugated and the main verb stays in infinitive at the end.',
    wordOrderDiagram: 'Subject + werden(conjugated) + Object/Adverb + Infinitiv(END)',
    tips: 'To form the future, conjugate "werden" in position 2 and put the main verb in infinitive at the end of the sentence: "Ich werde morgen lernen." In everyday German the present tense is often used instead to talk about the future (Ich lerne morgen).',
    examples: [
      'Ich werde morgen Deutsch lernen.',
      'Wir werden nächstes Jahr nach Berlin fahren.',
      'Sie wird gleich ankommen.',
    ],
    keywords: ['werde', 'wirst', 'wird', 'werden', 'infinitiv', 'morgen', 'nächstes', 'gleich', 'bald'],
  },
  {
    id: 'reflexive-verbs',
    name: 'Reflexive Verbs (sich freuen, sich waschen)',
    level: 16,
    description: 'Verbs that need a reflexive pronoun (sich) referring back to the subject.',
    wordOrderDiagram: 'Subject + Verb + ReflexivePronoun(sich/mich) + Object(s)',
    tips: 'Reflexive verbs always carry the reflexive pronoun "sich". In the nominative it becomes mich/dich/sich...: Ich freue mich, du freust dich, er freut sich. Some verbs are "echt reflexiv" (always with sich, e.g. sich beeilen), others only sometimes (wasch dich vs. ich wasche das Auto).',
    examples: [
      'Ich freue mich auf das Wochenende.',
      'Sie interessiert sich für Sprachen.',
      'Wir waschen uns die Hände.',
    ],
    keywords: ['mich', 'dich', 'sich', 'uns', 'euch', 'freuen', 'interessieren', 'waschen', 'beeilen', 'erinnern'],
  },
  {
    id: 'dative-verbs',
    name: 'Dative Verbs (helfen, gefallen, danken)',
    level: 17,
    description: 'Verbs that take a dative object — the person receives the action without "zu/an/für".',
    wordOrderDiagram: 'Subject + Verb + DativeObject(der/dem) + (AccusativeObject)',
    tips: 'Some German verbs always take the dative, not the accusative: helfen, gefallen, danken, gehören, glauben, passen. "Ich helfe dem Mann." (not "den Mann"!). Personal pronouns in dative: mir, dir, ihm, ihr, uns, euch, ihnen.',
    examples: [
      'Ich helfe dem Mann.',
      'Das Buch gefällt mir sehr gut.',
      'Sie dankt ihrer Mutter für das Geschenk.',
    ],
    keywords: ['helfen', 'gefallen', 'danken', 'gehören', 'glauben', 'passen', 'mir', 'dir', 'ihm', 'ihr', 'uns'],
  },
  {
    id: 'da-compounds',
    name: 'da-Compounds (damit, dafür, darauf)',
    level: 18,
    description: 'Pronominal adverbs that replace "preposition + noun" for things or whole ideas.',
    wordOrderDiagram: 'Verb + da-Compound (damit/darauf/daran) + ...',
    tips: 'When a verb takes a preposition (warten auf, sich interessieren für, denken an), for THINGS you replace "preposition + das" with a da-compound: auf das → darauf, für das → dafür, daran, damit. For people you keep it separate: "Ich warte auf dich." "Ich warte darauf."',
    examples: [
      'Ich warte darauf.',
      'Sie interessiert sich dafür.',
      'Er denkt oft daran.',
    ],
    keywords: ['darauf', 'damit', 'dafür', 'darüber', 'daran', 'darum', 'warten', 'interessieren', 'denken', 'sprechen'],
  },
  {
    id: 'konjunktiv-ii',
    name: 'Subjunctive II (Konjunktiv II — würde + Infinitiv)',
    level: 19,
    description: 'Expresses unreal conditions, polite requests, and hypothetical situations.',
    wordOrderDiagram: '[Wenn + Subject + ... + Verb(Prät. Konj.)] + Hauptsatz(würde...) ODER Subject + würde + Infinitiv(END)',
    tips: 'Konjunktiv II is used for hypothetical/unreal statements: "Wenn ich Geld hätte, würde ich reisen." Form with würde + infinitive is most common: "Ich würde gerne kommen." For können/mögen/haben: "Ich hätte Zeit, ich könnte helfen."',
    examples: [
      'Wenn ich Geld hätte, würde ich nach Italien reisen.',
      'Ich würde gerne morgen kommen.',
      'Hätte ich Zeit, könnte ich dir helfen.',
    ],
    keywords: ['würde', 'hätte', 'könnte', 'sollte', 'wollte', 'müsste', 'wäre', 'wenn', 'gerne'],
  },
  {
    id: 'indirect-questions',
    name: 'Indirect Questions (W-Fragen im Nebensatz)',
    level: 20,
    description: 'Embedded questions in a main clause. Verb goes to the end of the subordinate clause.',
    wordOrderDiagram: 'MainClause + [W-Wort (wer/was/wo) + Subject + Object(s) + Verb(END)]',
    tips: 'Indirect questions use W-words (wo, wann, wie, was, warum) or "ob" for yes/no questions. The verb goes to the END: "Ich weiß nicht, wo er wohnt." "ob" = whether: "Ich frage mich, ob er kommt." Word order in the main clause stays normal.',
    examples: [
      'Ich weiß nicht, wo er wohnt.',
      'Sie fragt, wann der Zug kommt.',
      'Ich frage mich, ob das stimmt.',
    ],
    keywords: ['ob', 'wer', 'was', 'wo', 'wann', 'wie', 'warum', 'fragen', 'wissen', 'überlegen'],
  },
  {
    id: 'um-zu-damit',
    name: '"damit" — Purpose Clauses',
    level: 21,
    description: '"damit" expresses purpose when the subject differs. Verb in subordinate clause goes to the end.',
    wordOrderDiagram: 'MainClause + [damit + Subject + Object(s) + Verb(END)]',
    tips: 'Use "um...zu" only when BOTH clauses share the same subject. When the subject differs, use "damit" + a full subordinate clause with the verb at the end: "Ich kaufe Brot, damit du essen kannst." (subject changes: ich → du).',
    examples: [
      'Ich kaufe Brot, damit du essen kannst.',
      'Sie lernt Deutsch, damit sie in Berlin arbeitet.',
      'Er spricht langsam, damit alle ihn verstehen.',
    ],
    keywords: ['damit', 'um', 'zu', 'können', 'verstehen', 'arbeiten', 'weil', 'denn'],
  },
  {
    id: 'obwohl-trotzdem',
    name: '"obwohl" — Concession (Although)',
    level: 21,
    description: '"obwohl" introduces a concessive subordinate clause. Verb goes to the end.',
    wordOrderDiagram: 'Hauptsatz + [obwohl + Subject + Object(s) + Verb(END)]',
    tips: '"obwohl" = "although", expresses a contrast that is unexpected. The verb in the obwohl-clause goes to the END: "Ich gehe spazieren, obwohl es regnet." Note the contrast: the main clause still stands despite the subordinate clause.',
    examples: [
      'Ich gehe spazieren, obwohl es regnet.',
      'Obwohl er müde ist, arbeitet er weiter.',
      'Sie kauft das Buch, obwohl sie wenig Geld hat.',
    ],
    keywords: ['obwohl', 'trotzdem', 'dennoch', 'zwar', 'müde', 'wetter', 'obgleich'],
  },
  {
    id: 'temporal-subordinators',
    name: 'Temporal Clauses (als, wenn, während, bevor, nachdem)',
    level: 22,
    description: 'Time clauses with subordinating conjunctions. Verb goes to the end.',
    wordOrderDiagram: '[Zeitwort (als/wenn/nachdem) + Subject + ... + Verb(END)] + Hauptsatz',
    tips: 'Time conjunctions send the verb to the end. Use "als" for one-time events in the past, "wenn" for repeated/habitual or future events: "Als ich jung war...", "Wenn ich Zeit habe...". "bevor" = before, "nachdem" = after, "während" = while, "bis" = until.',
    examples: [
      'Als ich jung war, spielte ich Fußball.',
      'Bevor ich schlafe, lese ich ein Buch.',
      'Nachdem er gegessen hat, geht er spazieren.',
    ],
    keywords: ['als', 'wenn', 'bevor', 'nachdem', 'während', 'bis', 'sobald', 'seitdem'],
  },
  {
    id: 'zweiteilige-konjunktionen',
    name: 'Two-Part Conjunctions (entweder...oder, weder...noch)',
    level: 23,
    description: 'Paired conjunctions that join two equally balanced elements.',
    wordOrderDiagram: 'entweder...oder / weder...noch / nicht nur...sondern auch / zwar...aber',
    tips: 'Two-part conjunctions add balance and emphasis. "sowohl...als auch" = both...and, "entweder...oder" = either...or, "weder...noch" = neither...nor, "nicht nur...sondern auch" = not only...but also, "zwar...aber" = admittedly...but. Word order after the first part can stay normal or invert.',
    examples: [
      'Entweder gehen wir ins Kino oder wir bleiben zu Hause.',
      'Ich habe weder Zeit noch Geld.',
      'Sie spricht sowohl Deutsch als auch Englisch.',
    ],
    keywords: ['entweder', 'oder', 'weder', 'noch', 'sowohl', 'als', 'auch', 'nicht nur', 'zwar', 'aber'],
  },
  {
    id: 'imperative',
    name: 'Imperative (Command Form)',
    level: 24,
    description: 'Commands and requests. The verb comes first.',
    wordOrderDiagram: 'Verb(imperative) + Object/Adverb (+ bitte)',
    tips: 'The imperative puts the verb FIRST. Informal singular (du): "Komm!" (drop -st). Add -e sometimes: "Mache!" Plural (ihr): "Kommt!" Formal (Sie): "Kommen Sie!" Use "bitte" to soften: "Komm bitte!"',
    examples: [
      'Komm bitte hierher!',
      'Seid leise!',
      'Sprechen Sie langsam, bitte!',
    ],
    keywords: ['Komm', 'Geh', 'Bleib', 'Mach', 'Sei', 'Seid', 'Kommen Sie', 'bitte', 'nicht'],
  },
  {
    id: 'comparative-superlative',
    name: 'Comparative and Superlative (als, am -sten)',
    level: 25,
    description: 'Compare two or more things using als, am...sten and wie.',
    wordOrderDiagram: 'Subject + Verb + Adjective(Comparative) + als + Obj2   |   Subject + Verb + am + Superlativ',
    tips: 'Comparative: add "-er" and compare with "als": "Das Auto ist größer als das Fahrrad." (Gleichheit: "so groß wie"). Superlative: "am ... -sten": "Das ist der beste Film." / "Er ist am schnellsten." Irregular forms: gut→besser→am besten, gern→lieber→am liebsten, hoch→höher→am höchsten.',
    examples: [
      'Das Auto ist schneller als das Fahrrad.',
      'Er ist der beste Schüler in der Klasse.',
      'Sie läuft am schnellsten.',
    ],
    keywords: ['als', 'wie', 'am', 'schön', 'schnell', 'gut', 'besser', 'beste', 'größer', 'als-vergleich'],
  },
];