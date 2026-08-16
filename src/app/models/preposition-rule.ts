export type GermanCase = 'nominative' | 'accusative' | 'dative' | 'genitive';
export type PrepositionCategory =
  | 'accusative'
  | 'dative'
  | 'genitive'
  | 'two-way'
  | 'contractions'
  | 'verb-fixed';

export interface PrepositionExample {
  german: string;
  translationEn: string;
  translationRu: string;
}

export interface PrepositionRule {
  id: string;
  name: string;
  category: PrepositionCategory;
  iconName: string;
  prepositions: string[];
  description: string;
  tips: string;
  examples: PrepositionExample[];
}

export interface VerbPrepositionPair {
  id: string;
  verb: string;
  preposition: string;
  case: GermanCase;
  translationEn: string;
  translationRu: string;
  example: PrepositionExample;
  /** Explains why this preposition is easy to miss when reading (translation gap) */
  translationGapNote: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
}

export interface PrepositionFlashcard {
  id: string;
  /** Prompt shown to the user, e.g. "denken ___" or a sentence with a blank */
  prompt: string;
  /** For verb cards: the verb. For rule cards: the rule name */
  title: string;
  correctPreposition: string;
  correctCase: GermanCase;
  prepositionOptions: string[];
  example: PrepositionExample;
  /** Translation-gap insight to reveal after answering */
  gapNote?: string;
  /** Which rule this card trains (e.g. "two-way") */
  ruleTag?: string;
  isRuleCard: boolean;
}

// ─────────────────────────────────────────────
// PREPOSITION RULES (Mode 1)
// ─────────────────────────────────────────────

export const PREPOSITION_RULES: PrepositionRule[] = [
  {
    id: 'accusative',
    name: 'Accusative Prepositions',
    category: 'accusative',
    iconName: 'arrow_forward',
    prepositions: ['durch', 'für', 'gegen', 'ohne', 'um'],
    description:
      'These prepositions ALWAYS take the accusative case, regardless of motion or location.',
    tips: 'Mnemonic: DOFUGU — durch, ohne, für, um, gegen, ohne... When you see one of these prepositions, the article changes: der → den, ein → einen. This is a hard rule, no exceptions.',
    examples: [
      {
        german: 'Ich gehe durch den Park.',
        translationEn: 'I walk through the park.',
        translationRu: 'Я иду через парк.',
      },
      {
        german: 'Das Geschenk ist für dich.',
        translationEn: 'The gift is for you.',
        translationRu: 'Подарок для тебя.',
      },
      {
        german: 'Wir spielen gegen die Mannschaft.',
        translationEn: 'We play against the team.',
        translationRu: 'Мы играем против команды.',
      },
      {
        german: 'Er trinkt Kaffee ohne Zucker.',
        translationEn: 'He drinks coffee without sugar.',
        translationRu: 'Он пьёт кофе без сахара.',
      },
      {
        german: 'Wir gehen um den See.',
        translationEn: 'We walk around the lake.',
        translationRu: 'Мы идём вокруг озера.',
      },
    ],
  },
  {
    id: 'dative',
    name: 'Dative Prepositions',
    category: 'dative',
    iconName: 'swap_horiz',
    prepositions: ['aus', 'bei', 'mit', 'nach', 'seit', 'von', 'zu'],
    description:
      'These prepositions ALWAYS take the dative case. They are among the most frequent German prepositions.',
    tips: 'Mnemonic: ABMNSVZ — aus, bei, mit, nach, seit, von, zu. After these: der → dem, die → der, das → dem. Watch for contractions: bei + dem = beim, von + dem = vom, zu + dem = zum, zu + der = zur.',
    examples: [
      {
        german: 'Ich komme aus der Schweiz.',
        translationEn: 'I come from Switzerland.',
        translationRu: 'Я из Швейцарии.',
      },
      {
        german: 'Ich wohne bei meinen Eltern.',
        translationEn: 'I live with my parents.',
        translationRu: 'Я живу у родителей.',
      },
      {
        german: 'Er fährt mit dem Auto.',
        translationEn: 'He drives by car.',
        translationRu: 'Он едет на машине.',
      },
      {
        german: 'Nach der Arbeit gehe ich ins Kino.',
        translationEn: 'After work I go to the cinema.',
        translationRu: 'После работы я иду в кино.',
      },
      {
        german: 'Seit dem Sommer wohne ich hier.',
        translationEn: 'I have lived here since summer.',
        translationRu: 'С лета я живу здесь.',
      },
    ],
  },
  {
    id: 'genitive',
    name: 'Genitive Prepositions',
    category: 'genitive',
    iconName: 'fact_check',
    prepositions: ['während', 'wegen', 'trotz', 'statt', 'außerhalb', 'innerhalb'],
    description:
      'These prepositions take the genitive case. They are more formal and common in written German.',
    tips: 'Many are interchangeable with dative in spoken German, but in written German the genitive is correct. der → des, die → der, das → des: während des Tages, wegen des Wetters. Common: wegen (because of), trotz (despite), während (during).',
    examples: [
      {
        german: 'Während des Films schlief er.',
        translationEn: 'He slept during the movie.',
        translationRu: 'Он спал во время фильма.',
      },
      {
        german: 'Wegen des Regens bleiben wir zu Hause.',
        translationEn: 'Because of the rain we stay at home.',
        translationRu: 'Из-за дождя мы остаёмся дома.',
      },
      {
        german: 'Trotz des Wetters gehen wir spazieren.',
        translationEn: 'Despite the weather we go for a walk.',
        translationRu: 'Несмотря на погоду, мы идём гулять.',
      },
      {
        german: 'Statt des Buches kaufe ich eine Zeitung.',
        translationEn: 'Instead of the book I buy a newspaper.',
        translationRu: 'Вместо книги я покупаю газету.',
      },
    ],
  },
  {
    id: 'two-way',
    name: 'Two-Way Prepositions (Wechselpräpositionen)',
    category: 'two-way',
    iconName: 'sync_alt',
    prepositions: ['in', 'an', 'auf', 'über', 'unter', 'vor', 'hinter', 'neben', 'zwischen'],
    description:
      'These prepositions take EITHER accusative OR dative. The case changes the meaning: accusative = motion/direction (wohin?), dative = location/position (wo?).',
    tips: 'Ask the question! "Wohin?" (where to?) → accusative: Ich gehe in den Park. "Wo?" (where?) → dative: Ich bin im Park. IN = im (in dem) or ins (in das), AN = am (an dem) or ans (an das).',
    examples: [
      {
        german: 'Ich lege das Buch auf den Tisch.',
        translationEn: 'I put the book on the table. (motion → accusative)',
        translationRu: 'Я кладу книгу на стол. (движение)',
      },
      {
        german: 'Das Buch liegt auf dem Tisch.',
        translationEn: 'The book is lying on the table. (location → dative)',
        translationRu: 'Книга лежит на столе. (место)',
      },
      {
        german: 'Er geht in die Schule.',
        translationEn: 'He goes into the school. (motion → accusative)',
        translationRu: 'Он идёт в школу. (движение)',
      },
      {
        german: 'Er ist in der Schule.',
        translationEn: 'He is at school. (location → dative)',
        translationRu: 'Он в школе. (место)',
      },
      {
        german: 'Die Katze springt auf den Tisch.',
        translationEn: 'The cat jumps onto the table. (motion)',
        translationRu: 'Кошка прыгает на стол. (движение)',
      },
      {
        german: 'Die Katze sitzt auf dem Tisch.',
        translationEn: 'The cat is sitting on the table. (location)',
        translationRu: 'Кошка сидит на столе. (место)',
      },
    ],
  },
  {
    id: 'contractions',
    name: 'Preposition + Article Contractions',
    category: 'contractions',
    iconName: 'link',
    prepositions: ['am', 'im', 'ins', 'zum', 'zur', 'beim', 'vom', 'ans'],
    description:
      'Prepositions frequently merge with the following article. You MUST recognize these instantly while reading or they will confuse you.',
    tips: 'am = an + dem, im = in + dem, ins = in + das, zum = zu + dem, zur = zu + der, beim = bei + dem, vom = von + dem, ans = an + das. When you see "am", the "an + dem" already tells you it is dative! The case information is hidden inside the contraction.',
    examples: [
      {
        german: 'Ich bin am Bahnhof.',
        translationEn: 'I am at the station. (an + dem)',
        translationRu: 'Я на вокзале.',
      },
      {
        german: 'Wir treffen uns im Café.',
        translationEn: 'We meet in the café. (in + dem)',
        translationRu: 'Мы встречаемся в кафе.',
      },
      {
        german: 'Ich gehe ins Kino.',
        translationEn: 'I go to the cinema. (in + das)',
        translationRu: 'Я иду в кино.',
      },
      {
        german: 'Er kommt zum Abendessen.',
        translationEn: 'He comes for dinner. (zu + dem)',
        translationRu: 'Он придёт на ужин.',
      },
      {
        german: 'Sie geht zur Arbeit.',
        translationEn: 'She goes to work. (zu + der)',
        translationRu: 'Она идёт на работу.',
      },
      {
        german: 'Wir treffen uns beim Bäcker.',
        translationEn: 'We meet at the bakery. (bei + dem)',
        translationRu: 'Мы встречаемся у пекаря.',
      },
    ],
  },
  {
    id: 'verb-fixed',
    name: 'Verbs with Fixed Prepositions',
    category: 'verb-fixed',
    iconName: 'psychology',
    prepositions: ['auf', 'an', 'für', 'über', 'von', 'mit', 'um', 'nach', 'zu', 'vor'],
    description:
      'Many German verbs REQUIRE a specific preposition + case. The preposition is not optional and does NOT map 1:1 to English or Russian.',
    tips: 'Learn the verb + preposition + case as ONE unit: denken an + Akk, warten auf + Akk, sich freuen über + Akk, träumen von + Dat. This is the hardest part of German prepositions — the preposition is often "invisible" in your native language.',
    examples: [
      {
        german: 'Ich warte auf den Bus.',
        translationEn: 'I am waiting for the bus.',
        translationRu: 'Я жду автобус.',
      },
      {
        german: 'Sie denkt an ihre Familie.',
        translationEn: 'She is thinking of her family.',
        translationRu: 'Она думает о своей семье.',
      },
      {
        german: 'Das Buch handelt von einem Jungen.',
        translationEn: 'The book is about a boy.',
        translationRu: 'Книга о мальчике.',
      },
      {
        german: 'Ich interessiere mich für Musik.',
        translationEn: 'I am interested in music.',
        translationRu: 'Я интересуюсь музыкой.',
      },
      {
        german: 'Er träumt von einer Reise.',
        translationEn: 'He dreams of a journey.',
        translationRu: 'Он мечтает о путешествии.',
      },
    ],
  },
  {
    id: 'time',
    name: 'Prepositions of Time',
    category: 'two-way',
    iconName: 'schedule',
    prepositions: ['um', 'an', 'in', 'seit', 'bis', 'ab', 'für', 'während'],
    description:
      'Time expressions use specific prepositions often with fixed cases: um + Uhrzeit, an + Tag, in + Monat/Jahr, seit + point in time, für + duration.',
    tips: 'um 8 Uhr (at 8 o\'clock), am Montag (on Monday), im Januar (in January), im Sommer (in summer), im Jahr 2024 (in 2024), seit Montag (since Monday), für zwei Wochen (for two weeks), in zwei Wochen (in two weeks). Note the different in/since pairs.',
    examples: [
      {
        german: 'Der Unterricht beginnt um 9 Uhr.',
        translationEn: 'The lesson starts at 9 o\'clock.',
        translationRu: 'Урок начинается в 9 часов.',
      },
      {
        german: 'Am Montag habe ich frei.',
        translationEn: 'On Monday I am free.',
        translationRu: 'В понедельник я свободен.',
      },
      {
        german: 'Im Sommer fahren wir nach Italien.',
        translationEn: 'In summer we go to Italy.',
        translationRu: 'Летом мы едем в Италию.',
      },
      {
        german: 'Ich wohne hier seit 2020.',
        translationEn: 'I have lived here since 2020.',
        translationRu: 'Я живу здесь с 2020 года.',
      },
      {
        german: 'Er ist für eine Woche verreist.',
        translationEn: 'He is away for a week.',
        translationRu: 'Он уехал на неделю.',
      },
    ],
  },
  {
    id: 'place',
    name: 'Prepositions of Place (Where? Where to? Where from?)',
    category: 'two-way',
    iconName: 'place',
    prepositions: ['in', 'an', 'auf', 'bei', 'nach', 'zu', 'aus', 'von'],
    description:
      'Location prepositions answer three questions: wo? (where are you), wohin? (where are you going), woher? (where are you coming from).',
    tips: 'wo? → in/auf/an/bei + Dativ. wohin? → in/an/auf + Akkusativ, or nach/zu for places. woher? → aus/von + Dativ. Countries without articles: nach + Land (wohin), aus + Land (woher). Cities: nach Berlin, aus Berlin.',
    examples: [
      {
        german: 'Ich wohne in Berlin.',
        translationEn: 'I live in Berlin.',
        translationRu: 'Я живу в Берлине.',
      },
      {
        german: 'Ich fahre nach München.',
        translationEn: 'I am going to Munich.',
        translationRu: 'Я еду в Мюнхен.',
      },
      {
        german: 'Ich komme aus Hamburg.',
        translationEn: 'I come from Hamburg.',
        translationRu: 'Я из Гамбурга.',
      },
      {
        german: 'Wir gehen zum Bahnhof.',
        translationEn: 'We are going to the station.',
        translationRu: 'Мы идём на вокзал.',
      },
      {
        german: 'Das Bild hängt an der Wand.',
        translationEn: 'The picture hangs on the wall.',
        translationRu: 'Картина висит на стене.',
      },
    ],
  },
];

// ─────────────────────────────────────────────
// VERB + PREPOSITION PAIRS (Mode 3)
// ─────────────────────────────────────────────

export const VERB_PREPOSITION_PAIRS: VerbPrepositionPair[] = [
  {
    id: 'warten-auf',
    verb: 'warten',
    preposition: 'auf',
    case: 'accusative',
    translationEn: 'to wait for',
    translationRu: 'ждать (кого/что)',
    example: {
      german: 'Ich warte auf den Bus.',
      translationEn: 'I am waiting for the bus.',
      translationRu: 'Я жду автобус.',
    },
    translationGapNote:
      'Russian has NO preposition here: «ждать автобус». German requires WARTEN AUF. This is why you will forget "auf" when forming sentences.',
    level: 'A1',
  },
  {
    id: 'denken-an',
    verb: 'denken',
    preposition: 'an',
    case: 'accusative',
    translationEn: 'to think of / about',
    translationRu: 'думать о (ком/чём)',
    example: {
      german: 'Sie denkt an ihre Familie.',
      translationEn: 'She is thinking of her family.',
      translationRu: 'Она думает о своей семье.',
    },
    translationGapNote:
      'Russian «думать О» uses a different preposition + case. German uses AN + Akkusativ. When reading, your brain reads «думает о» and skips "an".',
    level: 'A1',
  },
  {
    id: 'handeln-von',
    verb: 'handeln',
    preposition: 'von',
    case: 'dative',
    translationEn: 'to deal with / to be about',
    translationRu: 'говорить о, быть о (чём)',
    example: {
      german: 'Ihre Lieder handeln von tiefen und philosophischen Themen.',
      translationEn: 'Their songs deal with deep and philosophical themes.',
      translationRu: 'Их песни о глубоких и философских темах.',
    },
    translationGapNote:
      'The preposition is INVISIBLE in Russian: «песни о темах» → «Lieder handeln von Themen». English uses "deal with". German requires VON + Dativ. Learn "handeln von" as one unit.',
    level: 'B1',
  },
  {
    id: 'sich-freuen-auf',
    verb: 'sich freuen',
    preposition: 'auf',
    case: 'accusative',
    translationEn: 'to look forward to',
    translationRu: 'радоваться предстоящему, ждать с нетерпением',
    example: {
      german: 'Ich freue mich auf den Urlaub.',
      translationEn: 'I am looking forward to the vacation.',
      translationRu: 'Я с нетерпением жду отпуск.',
    },
    translationGapNote:
      'Russian has no preposition: «жду отпуск с нетерпением». English has "forward TO" but the German equivalent is AUF + Akkusativ. Easy to forget "auf".',
    level: 'A2',
  },
  {
    id: 'sich-freuen-über',
    verb: 'sich freuen',
    preposition: 'über',
    case: 'accusative',
    translationEn: 'to be happy/excited about (something that happened)',
    translationRu: 'радоваться (свершившемуся)',
    example: {
      german: 'Ich freue mich über dein Geschenk.',
      translationEn: 'I am happy about your gift.',
      translationRu: 'Я рад твоему подарку.',
    },
    translationGapNote:
      'Compare with "sich freuen AUF" (future) vs "sich freuen ÜBER" (past/current). Russian uses «рад ЧЕМУ» (dative) — German requires ÜBER + Akkusativ.',
    level: 'A2',
  },
  {
    id: 'sich-interessieren-fuer',
    verb: 'sich interessieren',
    preposition: 'für',
    case: 'accusative',
    translationEn: 'to be interested in',
    translationRu: 'интересоваться (чем)',
    example: {
      german: 'Ich interessiere mich für Geschichte.',
      translationEn: 'I am interested in history.',
      translationRu: 'Я интересуюсь историей.',
    },
    translationGapNote:
      'Russian «интересоваться ЧЕМ» (instrumental case, no preposition!) — German requires FÜR + Akkusativ. The preposition vanishes in Russian.',
    level: 'A2',
  },
  {
    id: 'traeumen-von',
    verb: 'träumen',
    preposition: 'von',
    case: 'dative',
    translationEn: 'to dream of/about',
    translationRu: 'мечтать о, видеть во сне',
    example: {
      german: 'Er träumt von einer großen Reise.',
      translationEn: 'He dreams of a big journey.',
      translationRu: 'Он мечтает о большом путешествии.',
    },
    translationGapNote:
      'Russian «мечтать О» vs German TRÄUMEN VON. Different preposition, different case. Reading: you see «мечтает о» and skip "von".',
    level: 'A2',
  },
  {
    id: 'glauben-an',
    verb: 'glauben',
    preposition: 'an',
    case: 'accusative',
    translationEn: 'to believe in',
    translationRu: 'верить в (кого/что)',
    example: {
      german: 'Ich glaube an dich.',
      translationEn: 'I believe in you.',
      translationRu: 'Я верю в тебя.',
    },
    translationGapNote:
      'Russian «верить В + Accusative» matches German GLAUBEN AN + Akkusativ, but the prepositions differ («в» → «an»). Easy to confuse.',
    level: 'A2',
  },
  {
    id: 'sich-kuemmern-um',
    verb: 'sich kümmern',
    preposition: 'um',
    case: 'accusative',
    translationEn: 'to take care of',
    translationRu: 'заботиться о (ком)',
    example: {
      german: 'Sie kümmert sich um ihre Großmutter.',
      translationEn: 'She takes care of her grandmother.',
      translationRu: 'Она заботится о своей бабушке.',
    },
    translationGapNote:
      'Russian «заботиться О» → German SICH KÜMMERN UM. Note: "um" means "around" normally, but with kümmern it means "of/about".',
    level: 'A2',
  },
  {
    id: 'sich-ärgern-über',
    verb: 'sich ärgern',
    preposition: 'über',
    case: 'accusative',
    translationEn: 'to be annoyed at/about',
    translationRu: 'злиться на (кого/что)',
    example: {
      german: 'Ich ärgere mich über das Wetter.',
      translationEn: 'I am annoyed about the weather.',
      translationRu: 'Я злюсь на погоду.',
    },
    translationGapNote:
      'Russian «злиться НА» → German SICH ÄRGERN ÜBER. Russian uses «на», German uses «über» — the prepositions do not match.',
    level: 'B1',
  },
  {
    id: 'angst-haben-vor',
    verb: 'Angst haben',
    preposition: 'vor',
    case: 'dative',
    translationEn: 'to be afraid of',
    translationRu: 'бояться (кого/чего)',
    example: {
      german: 'Ich habe Angst vor Spinnen.',
      translationEn: 'I am afraid of spiders.',
      translationRu: 'Я боюсь пауков.',
    },
    translationGapNote:
      'Russian «бояться ЧЕГО» has NO preposition (genitive). German requires ANGST HABEN VOR + Dativ. The preposition only appears in German!',
    level: 'A2',
  },
  {
    id: 'abhaengen-von',
    verb: 'abhängen',
    preposition: 'von',
    case: 'dative',
    translationEn: 'to depend on',
    translationRu: 'зависеть от (чего)',
    example: {
      german: 'Der Erfolg hängt von der Vorbereitung ab.',
      translationEn: 'Success depends on preparation.',
      translationRu: 'Успех зависит от подготовки.',
    },
    translationGapNote:
      'German DEPENDS ON → ABHÄNGEN VON. Separable verb: "hängt ... ab" with "von" in the middle. Russian «зависеть ОТ» — different preposition!',
    level: 'B1',
  },
  {
    id: 'sich-beschaeftigen-mit',
    verb: 'sich beschäftigen',
    preposition: 'mit',
    case: 'dative',
    translationEn: 'to occupy oneself with',
    translationRu: 'заниматься (чем)',
    example: {
      german: 'Ich beschäftige mich mit Musik.',
      translationEn: 'I occupy myself with music.',
      translationRu: 'Я занимаюсь музыкой.',
    },
    translationGapNote:
      'Russian «заниматься ЧЕМ» (instrumental, no preposition) → German SICH BESCHÄFTIGEN MIT + Dativ. The "mit" appears only in German.',
    level: 'B1',
  },
  {
    id: 'sich-gewöhnen-an',
    verb: 'sich gewöhnen',
    preposition: 'an',
    case: 'accusative',
    translationEn: 'to get used to',
    translationRu: 'привыкать к (чему)',
    example: {
      german: 'Ich gewöhne mich an das neue Leben.',
      translationEn: 'I am getting used to the new life.',
      translationRu: 'Я привыкаю к новой жизни.',
    },
    translationGapNote:
      'Russian «привыкать К» → German SICH GEWÖHNEN AN. Both languages have a preposition, but they are different!',
    level: 'B1',
  },
  {
    id: 'sich-erinnern-an',
    verb: 'sich erinnern',
    preposition: 'an',
    case: 'accusative',
    translationEn: 'to remember',
    translationRu: 'помнить о (ком/чём)',
    example: {
      german: 'Ich erinnere mich an meinen ersten Schultag.',
      translationEn: 'I remember my first school day.',
      translationRu: 'Я помню свой первый школьный день.',
    },
    translationGapNote:
      'English "remember" has NO preposition. Russian «помнить» has none either (or «о»). German REQUIRES SICH ERINNERN AN + Akkusativ.',
    level: 'B1',
  },
  {
    id: 'sich-verlassen-auf',
    verb: 'sich verlassen',
    preposition: 'auf',
    case: 'accusative',
    translationEn: 'to rely on',
    translationRu: 'полагаться на (кого/что)',
    example: {
      german: 'Du kannst dich auf mich verlassen.',
      translationEn: 'You can rely on me.',
      translationRu: 'Ты можешь на меня положиться.',
    },
    translationGapNote:
      'Russian «полагаться НА» → German SICH VERLASSEN AUF. Both use a preposition but they are different words.',
    level: 'B1',
  },
  {
    id: 'teilnehmen-an',
    verb: 'teilnehmen',
    preposition: 'an',
    case: 'dative',
    translationEn: 'to participate in',
    translationRu: 'участвовать в (чём)',
    example: {
      german: 'Wir nehmen an dem Kurs teil.',
      translationEn: 'We participate in the course.',
      translationRu: 'Мы участвуем в курсе.',
    },
    translationGapNote:
      'Russian «участвовать В» → German TEILNEHMEN AN + Dativ. Also a separable verb: "nehmen ... teil" with "an" following. Two things to remember: AN + Dativ AND the particle order.',
    level: 'B1',
  },
  {
    id: 'sich-verlieben-in',
    verb: 'sich verlieben',
    preposition: 'in',
    case: 'accusative',
    translationEn: 'to fall in love with',
    translationRu: 'влюбляться в (кого)',
    example: {
      german: 'Er verliebt sich in seine Kollegin.',
      translationEn: 'He falls in love with his colleague.',
      translationRu: 'Он влюбляется в свою коллегу.',
    },
    translationGapNote:
      'Russian «влюбляться В» matches, but German "in" here takes ACCUSATIVE even though the person is a location metaphorically. Watch the case!',
    level: 'B1',
  },
  {
    id: 'sich-vorbereiten-auf',
    verb: 'sich vorbereiten',
    preposition: 'auf',
    case: 'accusative',
    translationEn: 'to prepare for',
    translationRu: 'готовиться к (чему)',
    example: {
      german: 'Ich bereite mich auf die Prüfung vor.',
      translationEn: 'I am preparing for the exam.',
      translationRu: 'Я готовлюсь к экзамену.',
    },
    translationGapNote:
      'Russian «готовиться К» → German SICH VORBEREITEN AUF + Akkusativ. Different preposition in each language — "auf" is invisible when reading Russian.',
    level: 'B1',
  },
  {
    id: 'sich-wundern-ueber',
    verb: 'sich wundern',
    preposition: 'über',
    case: 'accusative',
    translationEn: 'to be surprised at',
    translationRu: 'удивляться (чему)',
    example: {
      german: 'Ich wundere mich über seine Antwort.',
      translationEn: 'I am surprised at his answer.',
      translationRu: 'Я удивляюсь его ответу.',
    },
    translationGapNote:
      'Russian «удивляться ЧЕМУ» (dative, no preposition) → German SICH WUNDERN ÜBER + Akkusativ.',
    level: 'B1',
  },
  {
    id: 'zweifeln-an',
    verb: 'zweifeln',
    preposition: 'an',
    case: 'dative',
    translationEn: 'to doubt',
    translationRu: 'сомневаться в (чём)',
    example: {
      german: 'Ich zweifle an seiner Entscheidung.',
      translationEn: 'I doubt his decision.',
      translationRu: 'Я сомневаюсь в его решении.',
    },
    translationGapNote:
      'English "doubt" has no preposition. Russian «сомневаться В» → German ZWEIFELN AN + Dativ.',
    level: 'B2',
  },
  {
    id: 'bitten-um',
    verb: 'bitten',
    preposition: 'um',
    case: 'accusative',
    translationEn: 'to ask for',
    translationRu: 'просить о (чём)',
    example: {
      german: 'Er bittet um Hilfe.',
      translationEn: 'He asks for help.',
      translationRu: 'Он просит о помощи.',
    },
    translationGapNote:
      'Russian «просить О» → German BITTEN UM. English "ask FOR" — three languages, three different prepositions!',
    level: 'A2',
  },
  {
    id: 'danken-fuer',
    verb: 'danken',
    preposition: 'für',
    case: 'accusative',
    translationEn: 'to thank for',
    translationRu: 'благодарить за (что)',
    example: {
      german: 'Ich danke dir für deine Hilfe.',
      translationEn: 'I thank you for your help.',
      translationRu: 'Я благодарю тебя за помощь.',
    },
    translationGapNote:
      'Russian «благодарить ЗА» → German DANKEN FÜR. Note: danken takes DATIVE for the person (dir) + FÜR + Accusative for the thing.',
    level: 'A2',
  },
  {
    id: 'fragen-nach',
    verb: 'fragen',
    preposition: 'nach',
    case: 'dative',
    translationEn: 'to ask about',
    translationRu: 'спрашивать о (ком/чём)',
    example: {
      german: 'Er fragt nach dem Weg.',
      translationEn: 'He asks about the way.',
      translationRu: 'Он спрашивает о дороге.',
    },
    translationGapNote:
      'Russian «спрашивать О» → German FRAGEN NACH + Dativ. "Nach" normally means "after/to" — here it means "about".',
    level: 'A2',
  },
  {
    id: 'gehoeren-zu',
    verb: 'gehören',
    preposition: 'zu',
    case: 'dative',
    translationEn: 'to belong to',
    translationRu: 'принадлежать к (чему)',
    example: {
      german: 'Er gehört zu unserer Mannschaft.',
      translationEn: 'He belongs to our team.',
      translationRu: 'Он принадлежит к нашей команде.',
    },
    translationGapNote:
      'Russian «принадлежать К» → German GEHÖREN ZU + Dativ. Similar idea, but "zu" contracts: zu + dem = zum.',
    level: 'B1',
  },
  {
    id: 'hoeren-von',
    verb: 'hören',
    preposition: 'von',
    case: 'dative',
    translationEn: 'to hear about',
    translationRu: 'слышать о (ком/чём)',
    example: {
      german: 'Ich habe von dem Unfall gehört.',
      translationEn: 'I heard about the accident.',
      translationRu: 'Я слышал о происшествии.',
    },
    translationGapNote:
      'Russian «слышать О» → German HÖREN VON + Dativ. With "hören von" you use the perfect tense often: "habe gehört".',
    level: 'A2',
  },
  {
    id: 'lachen-ueber',
    verb: 'lachen',
    preposition: 'über',
    case: 'accusative',
    translationEn: 'to laugh at',
    translationRu: 'смеяться над (кем)',
    example: {
      german: 'Wir lachen über den Witz.',
      translationEn: 'We laugh at the joke.',
      translationRu: 'Мы смеёмся над шуткой.',
    },
    translationGapNote:
      'Russian «смеяться НАД» → German LACHEN ÜBER. Completely different preposition!',
    level: 'B1',
  },
  {
    id: 'schaemen-fuer',
    verb: 'sich schämen',
    preposition: 'für',
    case: 'accusative',
    translationEn: 'to be ashamed of',
    translationRu: 'стыдиться (чего)',
    example: {
      german: 'Ich schäme mich für mein Verhalten.',
      translationEn: 'I am ashamed of my behavior.',
      translationRu: 'Я стыжусь своего поведения.',
    },
    translationGapNote:
      'Russian «стыдиться ЧЕГО» (genitive, no preposition) → German SICH SCHÄMEN FÜR + Akkusativ.',
    level: 'B2',
  },
  {
    id: 'sorgen-fuer',
    verb: 'sorgen',
    preposition: 'für',
    case: 'accusative',
    translationEn: 'to provide for / ensure',
    translationRu: 'заботиться о (чём), обеспечивать',
    example: {
      german: 'Sie sorgt für ihre Kinder.',
      translationEn: 'She provides for her children.',
      translationRu: 'Она заботится о своих детях.',
    },
    translationGapNote:
      'Russian «заботиться О» → German SORGEN FÜR. Compare: "sich kümmern um" also means to take care of — two different verbs with different prepositions!',
    level: 'B1',
  },
  {
    id: 'suchen-nach',
    verb: 'suchen',
    preposition: 'nach',
    case: 'dative',
    translationEn: 'to search for',
    translationRu: 'искать (что)',
    example: {
      german: 'Ich suche nach meinen Schlüsseln.',
      translationEn: 'I am searching for my keys.',
      translationRu: 'Я ищу свои ключи.',
    },
    translationGapNote:
      'Russian «искать ЧТО» has no preposition! German "suchen" can also be used without "nach", but "suchen nach" is common. The preposition feels optional in your head — that is the trap.',
    level: 'B1',
  },
  {
    id: 'verzichten-auf',
    verb: 'verzichten',
    preposition: 'auf',
    case: 'accusative',
    translationEn: 'to do without / give up',
    translationRu: 'отказываться от (чего)',
    example: {
      german: 'Ich verzichte auf Zucker.',
      translationEn: 'I give up sugar.',
      translationRu: 'Я отказываюсь от сахара.',
    },
    translationGapNote:
      'Russian «отказываться ОТ» → German VERZICHTEN AUF. English "give up" has no preposition at all.',
    level: 'B2',
  },
  {
    id: 'zählen-auf',
    verb: 'zählen',
    preposition: 'auf',
    case: 'accusative',
    translationEn: 'to count on',
    translationRu: 'рассчитывать на (кого/что)',
    example: {
      german: 'Ich zähle auf deine Unterstützung.',
      translationEn: 'I count on your support.',
      translationRu: 'Я рассчитываю на твою поддержку.',
    },
    translationGapNote:
      'Russian «рассчитывать НА» → German ZÄHLEN AUF. Both have prepositions but they differ.',
    level: 'B2',
  },
  {
    id: 'entscheiden-fuer',
    verb: 'sich entscheiden',
    preposition: 'für',
    case: 'accusative',
    translationEn: 'to decide on/for',
    translationRu: 'решаться на (что)',
    example: {
      german: 'Ich entscheide mich für das blaue Kleid.',
      translationEn: 'I decide on the blue dress.',
      translationRu: 'Я выбираю синее платье.',
    },
    translationGapNote:
      'Russian «решиться НА» → German SICH ENTSCHEIDEN FÜR. English "decide on". Three different prepositions again!',
    level: 'B1',
  },
  {
    id: 'protestieren-gegen',
    verb: 'protestieren',
    preposition: 'gegen',
    case: 'accusative',
    translationEn: 'to protest against',
    translationRu: 'протестовать против (чего)',
    example: {
      german: 'Die Studenten protestieren gegen die Reform.',
      translationEn: 'The students protest against the reform.',
      translationRu: 'Студенты протестуют против реформы.',
    },
    translationGapNote:
      'Russian «протестовать ПРОТИВ» matches English "against" — but German uses GEGEN + Akkusativ instead of the Russian preposition.',
    level: 'B1',
  },
  {
    id: 'gratulieren-zu',
    verb: 'gratulieren',
    preposition: 'zu',
    case: 'dative',
    translationEn: 'to congratulate on',
    translationRu: 'поздравлять с (чем)',
    example: {
      german: 'Ich gratuliere dir zum Geburtstag.',
      translationEn: 'I congratulate you on your birthday.',
      translationRu: 'Я поздравляю тебя с днём рождения.',
    },
    translationGapNote:
      'Russian «поздравлять С + instrumental» → German GRATULIEREN ZU + Dativ. Note the contraction: zu + dem = ZUM Geburtstag. The case hides in "zum".',
    level: 'A2',
  },
  {
    id: 'einladen-zu',
    verb: 'einladen',
    preposition: 'zu',
    case: 'dative',
    translationEn: 'to invite to',
    translationRu: 'приглашать на (что)',
    example: {
      german: 'Sie lädt mich zum Abendessen ein.',
      translationEn: 'She invites me to dinner.',
      translationRu: 'Она приглашает меня на ужин.',
    },
    translationGapNote:
      'Russian «приглашать НА» → German EINLADEN ZU + Dativ ("zum Abendessen"). Separable verb: lädt ... ein.',
    level: 'A2',
  },
  {
    id: 'passen-zu',
    verb: 'passen',
    preposition: 'zu',
    case: 'dative',
    translationEn: 'to suit / fit',
    translationRu: 'подходить к (чему), идти (кому)',
    example: {
      german: 'Die Schuhe passen zu dem Kleid.',
      translationEn: 'The shoes match the dress.',
      translationRu: 'Туфли подходят к платью.',
    },
    translationGapNote:
      'Russian «подходить К» → German PASSEN ZU + Dativ. Often contracted: "zur Arbeit", "zum Anlass".',
    level: 'B1',
  },
  {
    id: 'bestehen-aus',
    verb: 'bestehen',
    preposition: 'aus',
    case: 'dative',
    translationEn: 'to consist of',
    translationRu: 'состоять из (чего)',
    example: {
      german: 'Das Gericht besteht aus Gemüse.',
      translationEn: 'The dish consists of vegetables.',
      translationRu: 'Блюдо состоит из овощей.',
    },
    translationGapNote:
      'Russian «состоять ИЗ» → German BESTEHEN AUS + Dativ. Note: "bestehen auf" (insist on) is a different verb+preposition pair — same verb, two meanings!',
    level: 'B1',
  },
  {
    id: 'sich-anpassen-an',
    verb: 'sich anpassen',
    preposition: 'an',
    case: 'accusative',
    translationEn: 'to adapt to',
    translationRu: 'приспосабливаться к (чему)',
    example: {
      german: 'Ich passe mich an die neue Situation an.',
      translationEn: 'I adapt to the new situation.',
      translationRu: 'Я приспосабливаюсь к новой ситуации.',
    },
    translationGapNote:
      'Russian «приспосабливаться К» → German SICH ANPASSEN AN. Separable verb (passt ... an) + AN with accusative. Double "an" — one prefix, one preposition!',
    level: 'B2',
  },
  {
    id: 'sich-unterscheiden-von',
    verb: 'sich unterscheiden',
    preposition: 'von',
    case: 'dative',
    translationEn: 'to differ from',
    translationRu: 'отличаться от (чего)',
    example: {
      german: 'Mein Bruder unterscheidet sich von mir.',
      translationEn: 'My brother differs from me.',
      translationRu: 'Мой брат отличается от меня.',
    },
    translationGapNote:
      'Russian «отличаться ОТ» → German SICH UNTERSCHEIDEN VON + Dativ. Similar mapping but "von" is used, not the Russian «от».',
    level: 'B1',
  },
  {
    id: 'vergleichen-mit',
    verb: 'vergleichen',
    preposition: 'mit',
    case: 'dative',
    translationEn: 'to compare with/to',
    translationRu: 'сравнивать с (чем)',
    example: {
      german: 'Ich vergleiche mein Leben mit ihrem.',
      translationEn: 'I compare my life with hers.',
      translationRu: 'Я сравниваю свою жизнь с её.',
    },
    translationGapNote:
      'Russian «сравнивать С» → German VERGLEICHEN MIT + Dativ. Both languages use a preposition, but different words.',
    level: 'B1',
  },
  {
    id: 'sich-streiten-mit',
    verb: 'sich streiten',
    preposition: 'mit',
    case: 'dative',
    translationEn: 'to argue with',
    translationRu: 'ссориться с (кем)',
    example: {
      german: 'Er streitet sich mit seinem Bruder.',
      translationEn: 'He argues with his brother.',
      translationRu: 'Он ссорится со своим братом.',
    },
    translationGapNote:
      'Russian «ссориться С» → German SICH STREITEN MIT + Dativ. Note "mit seinem" — the dative article is in the adjective/pronoun.',
    level: 'B1',
  },
  {
    id: 'schuetzen-vor',
    verb: 'schützen',
    preposition: 'vor',
    case: 'dative',
    translationEn: 'to protect from/against',
    translationRu: 'защищать от (чего)',
    example: {
      german: 'Die Mütze schützt vor der Kälte.',
      translationEn: 'The hat protects from the cold.',
      translationRu: 'Шапка защищает от холода.',
    },
    translationGapNote:
      'Russian «защищать ОТ» → German SCHÜTZEN VOR + Dativ. Note "vor" also means "in front of" — this is a different sense.',
    level: 'B1',
  },
  {
    id: 'sich-sehnen-nach',
    verb: 'sich sehnen',
    preposition: 'nach',
    case: 'dative',
    translationEn: 'to long for',
    translationRu: 'тосковать по (ком)',
    example: {
      german: 'Ich sehne mich nach dem Sommer.',
      translationEn: 'I long for summer.',
      translationRu: 'Я тоскую по лету.',
    },
    translationGapNote:
      'Russian «тосковать ПО» → German SICH SEHNEN NACH + Dativ. English "long FOR" — but German uses "nach".',
    level: 'B2',
  },
  {
    id: 'vertrauen-auf',
    verb: 'vertrauen',
    preposition: 'auf',
    case: 'accusative',
    translationEn: 'to trust in',
    translationRu: 'доверять (кому), полагаться на',
    example: {
      german: 'Ich vertraue auf mein Glück.',
      translationEn: 'I trust in my luck.',
      translationRu: 'Я полагаюсь на удачу.',
    },
    translationGapNote:
      'Russian «доверять КОМУ» (dative, no preposition) → German VERTRAUEN AUF + Akkusativ. The preposition only appears in German.',
    level: 'B2',
  },
  {
    id: 'konzentrieren-auf',
    verb: 'sich konzentrieren',
    preposition: 'auf',
    case: 'accusative',
    translationEn: 'to concentrate on',
    translationRu: 'концентрироваться на (чём)',
    example: {
      german: 'Ich konzentriere mich auf die Aufgabe.',
      translationEn: 'I concentrate on the task.',
      translationRu: 'Я сосредотачиваюсь на задаче.',
    },
    translationGapNote:
      'Russian «сосредотачиваться НА» → German SICH KONZENTRIEREN AUF + Akkusativ. Similar concept, different word.',
    level: 'B1',
  },
  {
    id: 'berichten-ueber',
    verb: 'berichten',
    preposition: 'über',
    case: 'accusative',
    translationEn: 'to report about',
    translationRu: 'сообщать о (чём)',
    example: {
      german: 'Die Zeitung berichtet über die Politik.',
      translationEn: 'The newspaper reports about politics.',
      translationRu: 'Газета сообщает о политике.',
    },
    translationGapNote:
      'Russian «сообщать О» → German BERICHTEN ÜBER + Akkusativ. Common in news and formal contexts.',
    level: 'B1',
  },
  {
    id: 'sprechen-mit',
    verb: 'sprechen',
    preposition: 'mit',
    case: 'dative',
    translationEn: 'to talk with',
    translationRu: 'говорить с (кем)',
    example: {
      german: 'Ich spreche mit meinem Lehrer.',
      translationEn: 'I talk with my teacher.',
      translationRu: 'Я говорю со своим учителем.',
    },
    translationGapNote:
      'Russian «говорить С» matches German SPRECHEN MIT + Dativ. But be careful: "sprechen über + Akk" = talk ABOUT. Two different prepositions for two different meanings!',
    level: 'A1',
  },
  {
    id: 'sprechen-ueber',
    verb: 'sprechen',
    preposition: 'über',
    case: 'accusative',
    translationEn: 'to talk about',
    translationRu: 'говорить о (чём)',
    example: {
      german: 'Wir sprechen über das Wetter.',
      translationEn: 'We talk about the weather.',
      translationRu: 'Мы говорим о погоде.',
    },
    translationGapNote:
      'Russian «говорить О» → German SPRECHEN ÜBER + Akkusativ. Compare with "sprechen mit" (with a person) vs "sprechen über" (about a topic).',
    level: 'A1',
  },
  {
    id: 'erinnern-an',
    verb: 'erinnern',
    preposition: 'an',
    case: 'accusative',
    translationEn: 'to remind of',
    translationRu: 'напоминать о (чём)',
    example: {
      german: 'Das Foto erinnert mich an den Urlaub.',
      translationEn: 'The photo reminds me of the vacation.',
      translationRu: 'Фотография напоминает мне об отпуске.',
    },
    translationGapNote:
      'Russian «напоминать О» → German ERINNERN AN + Akkusativ. Compare: "sich erinnern an" (to remember) — same preposition!',
    level: 'B1',
  },
  {
    id: 'sich-entschuldigen-fuer',
    verb: 'sich entschuldigen',
    preposition: 'für',
    case: 'accusative',
    translationEn: 'to apologize for',
    translationRu: 'извиняться за (что)',
    example: {
      german: 'Ich entschuldige mich für die Verspätung.',
      translationEn: 'I apologize for the delay.',
      translationRu: 'Я извиняюсь за опоздание.',
    },
    translationGapNote:
      'Russian «извиняться ЗА» → German SICH ENTSCHULDIGEN FÜR + Akkusativ.',
    level: 'A2',
  },
  {
    id: 'sich-bedanken-fuer',
    verb: 'sich bedanken',
    preposition: 'für',
    case: 'accusative',
    translationEn: 'to thank for',
    translationRu: 'благодарить за (что)',
    example: {
      german: 'Ich bedanke mich für Ihre Hilfe.',
      translationEn: 'I thank you for your help.',
      translationRu: 'Я благодарю вас за помощь.',
    },
    translationGapNote:
      'Russian «благодарить ЗА» → German SICH BEDANKEN FÜR + Akkusativ. Formal version of "danken für".',
    level: 'A2',
  },
  {
    id: 'sich-bewerben-um',
    verb: 'sich bewerben',
    preposition: 'um',
    case: 'accusative',
    translationEn: 'to apply for',
    translationRu: 'подавать заявку на (что)',
    example: {
      german: 'Er bewirbt sich um den Job.',
      translationEn: 'He applies for the job.',
      translationRu: 'Он подаёт заявку на эту работу.',
    },
    translationGapNote:
      'Russian «подавать заявку НА» → German SICH BEWERBEN UM + Akkusativ. In job contexts, this is very common with "um"!',
    level: 'B1',
  },
];

export const CASE_LABELS: Record<GermanCase, string> = {
  nominative: 'Nominativ',
  accusative: 'Akkusativ',
  dative: 'Dativ',
  genitive: 'Genitiv',
};